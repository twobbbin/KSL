import asyncio
import base64
import json
import os
import time
from dotenv import load_dotenv
from collections import deque
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import tensorflow as tf
import websockets
from google import genai
from google.genai import types

from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python.vision import (
    HandLandmarker,
    HandLandmarkerOptions,
    PoseLandmarker,
    PoseLandmarkerOptions,
    RunningMode,
)

from bilstm_attention import TemporalAttention
from sentence import build_sentence
from vocabulary import english_to_korean


# ============================================================
# Paths
# ============================================================

BASE_DIR = Path(r"C:\Users\ds2el\Downloads\KSL_KEYPOINTS_v1")

MODEL_PATH = (
    BASE_DIR
    / "outputs"
    / "kfold_v1"
    / "fold_4"
    / "best_model.keras"
)

CLASS_NAMES_PATH = (
    BASE_DIR
    / "outputs"
    / "kfold_v1"
    / "class_names_kfold.json"
)

HAND_MODEL_PATH = Path(
    r"C:\Users\ds2el\KSL\KSL_Guide\hand_landmarker.task"
)

POSE_MODEL_PATH = Path(
    r"C:\Users\ds2el\KSL\KSL_Guide\pose_landmarker_lite.task"
)


# ============================================================
# Recognition config
# ============================================================

MAX_FRAMES = 30            # 모델 입력 길이 (학습 설정과 동일해야 함)
MIN_FRAMES = 12            # 추론을 시작하는 최소 누적 프레임 수
THRESHOLD = 0.7            # 단어 확정 최소 확률 (smoothing 평균 기준)
SMOOTHING = 3              # 최근 N회 예측 확률 평균
CONFIRM_STREAK = 3         # 같은 라벨이 THRESHOLD 이상으로 연속 N회 나와야 확정
COOLDOWN_SEC = 0.4         # 단어 확정 직후 프레임을 쌓지 않는 시간
REQUIRE_HAND_RELEASE = False  # True: 단어 확정 후 손을 내렸다 올려야 다음 단어 인식
                              # False: 손을 내리지 않고 이어서 해도 다음 단어 인식
HAND_TIMEOUT_SEC = 0.8     # 손이 이 시간 이상 안 보이면 버퍼 초기화
HAND_LOST_FRAMES = 3       # 손이 연속 N프레임 안 보이면 "동작 종료"로 판단
WINDOW_SEC = 3.0           # 이보다 오래된 프레임은 버퍼에서 제거
BUFFER_MAXLEN = 120        # 시간 기준으로 자르므로 넉넉하게

N_HAND = 21
N_POSE = 33
FEATURE_DIM = ((N_HAND * 2) + N_POSE) * 3

print("[RUNNING FILE]", Path(__file__).resolve())
print(
    f"[VERSION] v3 | MIN_FRAMES={MIN_FRAMES} THRESHOLD={THRESHOLD} "
    f"SMOOTHING={SMOOTHING} CONFIRM_STREAK={CONFIRM_STREAK} "
    f"WINDOW_SEC={WINDOW_SEC} REQUIRE_HAND_RELEASE={REQUIRE_HAND_RELEASE}"
)


# ============================================================
# LLM / NLP config
# ============================================================

load_dotenv(Path(__file__).resolve().parent / ".env")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    print(f"[OK] Gemini 번역 사용: {GEMINI_MODEL}")
else:
    gemini_client = None
    print("[INFO] GEMINI_API_KEY 없음 → sentence.py 규칙 기반 번역으로 동작")


def normalize_words(words):
    """빈 값과 연속 중복을 제거해 LLM/fallback 입력을 안정화한다."""
    cleaned = []
    for word in words or []:
        word = str(word).strip()
        if not word:
            continue
        if not cleaned or cleaned[-1] != word:
            cleaned.append(word)
    return cleaned


def translate_words(words):
    """
    수어 인식 단어열을 자연스러운 한국어 문장으로 변환한다.
    Gemini 실패 또는 API 키 미설정 시 sentence.py를 fallback으로 사용한다.
    """
    cleaned = normalize_words(words)
    if not cleaned:
        return "", "none", None

    fallback = build_sentence(cleaned) or (" ".join(cleaned) + ".")

    if gemini_client is None:
        return fallback, "rule_based", "GEMINI_API_KEY가 설정되지 않았습니다."

    prompt = f"""다음 단어들은 한국 수어 인식 시스템에서 시간 순서대로 인식된 결과입니다.

인식 단어: {' / '.join(cleaned)}

규칙:
1. 주어진 단어의 의미를 최대한 그대로 유지하세요.
2. 입력에 없는 사람, 장소, 행동, 이유, 시간 등 새로운 정보를 추가하지 마세요.
3. 필요한 조사와 어미만 보완하여 자연스러운 한국어 문장 한 문장으로 재구성하세요.
4. 의미가 불명확하면 과도하게 추측하지 말고 입력 단어에 가까운 표현을 사용하세요.
5. 설명, 따옴표, 접두어 없이 완성된 한국어 문장만 출력하세요.
"""

    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=128,
            ),
        )
        translated = (response.text or "").strip()
        if not translated:
            raise ValueError("Gemini 응답이 비어 있습니다.")
        return translated, "gemini", None
    except Exception as exc:
        print(f"[AI 번역 실패] {exc}")
        return fallback, "rule_based", str(exc)


# ============================================================
# Labels
# ============================================================

with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
    CLASS_NAMES = json.load(f)

print(f"[OK] 라벨 로드 완료: {len(CLASS_NAMES)}개")


# ============================================================
# Model
# ============================================================

print("[INFO] 모델 로드 중...")

model = tf.keras.models.load_model(
    MODEL_PATH,
    custom_objects={"TemporalAttention": TemporalAttention},
    compile=False,
)

print("[OK] 모델 로드 완료")

if model.output_shape[-1] != len(CLASS_NAMES):
    raise ValueError(
        f"모델 출력({model.output_shape[-1]})과 "
        f"class_names({len(CLASS_NAMES)}) 불일치"
    )

# predict()는 호출 오버헤드가 크므로 tf.function으로 직접 호출한다.
infer_fn = tf.function(
    lambda x: model(x, training=False),
    reduce_retracing=True,
)

# 첫 호출 지연을 없애기 위한 워밍업
try:
    infer_fn(tf.zeros((1, MAX_FRAMES, FEATURE_DIM), tf.float32))
    print("[OK] 모델 워밍업 완료")
except Exception as e:
    print("[WARN] 모델 워밍업 실패 (동작에는 영향 없음):", e)


# ============================================================
# MediaPipe options
# ============================================================

hand_options = HandLandmarkerOptions(
    base_options=mp_python.BaseOptions(
        model_asset_path=str(HAND_MODEL_PATH)
    ),
    running_mode=RunningMode.VIDEO,
    num_hands=2,
    min_hand_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

pose_options = PoseLandmarkerOptions(
    base_options=mp_python.BaseOptions(
        model_asset_path=str(POSE_MODEL_PATH)
    ),
    running_mode=RunningMode.VIDEO,
    min_pose_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)


# ============================================================
# Utilities
# ============================================================

def landmarks_to_array(landmark_list, n_points: int) -> np.ndarray:
    if not landmark_list:
        return np.zeros(n_points * 3, dtype=np.float32)

    arr = np.array(
        [[lm.x, lm.y, lm.z] for lm in landmark_list],
        dtype=np.float32,
    )

    if len(arr) < n_points:
        arr = np.vstack(
            [arr, np.zeros((n_points - len(arr), 3), dtype=np.float32)]
        )

    return arr[:n_points].flatten()


class PredictionSmoother:
    def __init__(self, window: int = 3):
        self.history = deque(maxlen=window)

    def update(self, probs: np.ndarray) -> np.ndarray:
        self.history.append(probs)
        return np.mean(self.history, axis=0)

    def reset(self):
        self.history.clear()


def run_model(smoother, sequence):
    """
    sequence: deque of (timestamp, feature)

    버퍼에 쌓인 프레임 수와 관계없이, 쌓인 동작 전체를
    MAX_FRAMES(30)개로 균등 샘플링해서 모델에 넣는다.
    (실제 fps가 낮아도 입력 분포가 일정하게 유지된다.)
    """
    arr = np.array([feat for _, feat in sequence], dtype=np.float32)
    T = len(arr)

    idx = np.linspace(0, T - 1, MAX_FRAMES).round().astype(int)
    x = arr[idx][np.newaxis]  # (1, MAX_FRAMES, FEATURE_DIM)

    t0 = time.perf_counter()
    preds = infer_fn(tf.constant(x)).numpy()  # (1, num_classes)
    inference_ms = (time.perf_counter() - t0) * 1000.0

    probs = smoother.update(preds[0])
    pred_idx = int(np.argmax(probs))
    confidence = float(probs[pred_idx])

    english_label = (
        CLASS_NAMES[pred_idx]
        if pred_idx < len(CLASS_NAMES)
        else "unknown"
    )
    korean_label = english_to_korean(english_label)

    return korean_label, english_label, confidence, inference_ms


def decode_frame(image_data: str):
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    image_bytes = base64.b64decode(image_data)
    np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)

    return cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)


# ============================================================
# WebSocket client handler
# ============================================================

async def handle_client(websocket):
    print("[WEB] React 연결됨")

    # (timestamp, feature) 쌍을 저장
    sequence = deque(maxlen=BUFFER_MAXLEN)
    smoother = PredictionSmoother(window=SMOOTHING)

    sentence = []

    current_label = ""
    english_label = ""
    current_conf = 0.0

    last_hand_time = None
    missing_frames = 0

    # 연속 확정 판정용
    streak_label = ""
    streak_count = 0

    # 단어 확정 후 잠금 / 쿨다운
    locked = False
    cooldown_until = 0.0

    # 마지막 단어 추가 이후 손을 한 번이라도 내렸는지
    # (같은 단어를 연속으로 추가하려면 손을 내렸다 올려야 한다)
    released_since_add = True

    # 문장 초기화 직후, 방금 하던 동작과 "같은 라벨"만 잠깐 억제한다.
    # 다른 단어는 바로 인식된다.
    suppressed_label = ""
    suppress_until = 0.0

    frame_idx = 0

    def try_add_word(label, conf, check_suppress):
        """확정 조건을 모두 통과하면 문장에 추가하고 True를 반환한다."""
        nonlocal suppressed_label, suppress_until, released_since_add

        # 1) 확률 임계값
        if conf < THRESHOLD:
            return False

        # 2) reset 직후 동일 라벨 억제
        if check_suppress:
            if suppressed_label and label != suppressed_label:
                suppressed_label = ""
                suppress_until = 0.0
            if (
                suppressed_label
                and label == suppressed_label
                and time.time() < suppress_until
            ):
                return False

        # 3) 직전 단어와 같으면, 손을 한 번 내렸다 올린 뒤에만 추가
        #    (다른 단어는 손을 내리지 않아도 바로 추가 가능)
        if sentence and sentence[-1] == label and not released_since_add:
            return False

        sentence.append(label)
        released_since_add = False
        suppressed_label = ""
        suppress_until = 0.0

        print(f"[단어 추가] {label} ({conf * 100:.1f}%) → {sentence}")
        return True

    with HandLandmarker.create_from_options(hand_options) as hand_det, \
         PoseLandmarker.create_from_options(pose_options) as pose_det:

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    continue

                # ------------------------------------------------
                # Reset command from React
                # ------------------------------------------------
                if data.get("type") == "reset":
                    suppressed_label = (
                        current_label
                        or (sentence[-1] if sentence else "")
                    )
                    suppress_until = time.time() + 0.7

                    sequence.clear()
                    smoother.reset()
                    sentence.clear()

                    current_label = ""
                    english_label = ""
                    current_conf = 0.0
                    last_hand_time = None
                    missing_frames = 0
                    streak_label = ""
                    streak_count = 0
                    locked = False
                    cooldown_until = 0.0
                    released_since_add = True

                    print(
                        "[문장 초기화] 새 손동작은 바로 인식합니다. "
                        f"(동일 라벨 잠시 억제: {suppressed_label or '없음'})"
                    )

                    # React가 이전 예측을 무시할 수 있게 하는 ACK
                    await websocket.send(
                        json.dumps(
                            {"type": "reset_ready", "sentence": []},
                            ensure_ascii=False,
                        )
                    )
                    continue

                # ------------------------------------------------
                # Pause / camera-off command from React
                # 문장은 유지하고 진행 중인 인식 버퍼만 비운다.
                # ------------------------------------------------
                if data.get("type") == "pause":
                    sequence.clear()
                    smoother.reset()

                    current_label = ""
                    english_label = ""
                    current_conf = 0.0
                    last_hand_time = None
                    missing_frames = 0
                    streak_label = ""
                    streak_count = 0
                    locked = False
                    cooldown_until = 0.0
                    released_since_add = True

                    print("[인식 버퍼 초기화] 문장은 유지합니다.")

                    await websocket.send(
                        json.dumps(
                            {"type": "paused", "sentence": sentence},
                            ensure_ascii=False,
                        )
                    )
                    continue

                # ------------------------------------------------
                # AI translation command from React
                # ------------------------------------------------
                if data.get("type") == "translate":
                    requested_words = data.get("words")
                    words = (
                        requested_words
                        if isinstance(requested_words, list) and requested_words
                        else list(sentence)
                    )

                    words = normalize_words(words)

                    if not words:
                        await websocket.send(
                            json.dumps(
                                {
                                    "type": "translation_error",
                                    "message": "번역할 수어 단어가 없습니다.",
                                },
                                ensure_ascii=False,
                            )
                        )
                        continue

                    print(f"[AI 번역 요청] {words}")

                    translated_text, source, error = await asyncio.to_thread(
                        translate_words,
                        words,
                    )

                    await websocket.send(
                        json.dumps(
                            {
                                "type": "translated_sentence",
                                "text": translated_text,
                                "originalWords": words,
                                "source": source,
                                "fallbackReason": error,
                            },
                            ensure_ascii=False,
                        )
                    )

                    print(
                        f"[AI 번역 완료] source={source} "
                        f"{words} → {translated_text}"
                    )
                    continue

                if data.get("type") != "frame":
                    continue

                image_data = data.get("image")
                if not image_data:
                    continue

                processing_started = time.perf_counter()

                frame = decode_frame(image_data)

                if frame is None:
                    continue

                # 브라우저 mirrorMode는 CSS 표시용일 뿐이므로
                # 기존 검증 스크립트와 동일한 입력 방향을 위해 여기서 flip한다.
                frame = cv2.flip(frame, 1)

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(
                    image_format=mp.ImageFormat.SRGB,
                    data=rgb,
                )

                # detect_for_video는 단조 증가하는 타임스탬프만 필요하다.
                ts_ms = int(frame_idx * 33.3)
                frame_idx += 1

                # ------------------------------------------------
                # Hand + Pose detection (두 모델을 동시에 실행)
                # ------------------------------------------------
                hand_result, pose_result = await asyncio.gather(
                    asyncio.to_thread(hand_det.detect_for_video, mp_image, ts_ms),
                    asyncio.to_thread(pose_det.detect_for_video, mp_image, ts_ms),
                )

                hand_detected = bool(hand_result.hand_landmarks)

                left_hand = np.zeros(N_HAND * 3, dtype=np.float32)
                right_hand = np.zeros(N_HAND * 3, dtype=np.float32)

                if hand_detected:
                    last_hand_time = time.time()

                    for hand_lm, handedness in zip(
                        hand_result.hand_landmarks,
                        hand_result.handedness,
                    ):
                        coords = landmarks_to_array(hand_lm, N_HAND)
                        hand_name = handedness[0].category_name

                        if hand_name == "Left":
                            left_hand = coords
                        else:
                            right_hand = coords

                pose_kp = np.zeros(N_POSE * 3, dtype=np.float32)

                if pose_result.pose_landmarks:
                    pose_kp = landmarks_to_array(
                        pose_result.pose_landmarks[0],
                        N_POSE,
                    )

                added = False
                inference_ms = 0.0
                now = time.time()

                # ------------------------------------------------
                # Continuous recognition logic
                # ------------------------------------------------
                if hand_detected:
                    missing_frames = 0

                    feature = np.concatenate([left_hand, right_hand, pose_kp])

                    if feature.shape[0] != FEATURE_DIM:
                        raise ValueError(
                            f"feature dim mismatch: "
                            f"{feature.shape[0]} != {FEATURE_DIM}"
                        )

                    if locked or now < cooldown_until:
                        # 단어 확정 직후: 쿨다운(또는 손 내림)까지 프레임을 쌓지 않는다.
                        current_label = ""
                        english_label = ""
                        current_conf = 0.0

                    else:
                        sequence.append((now, feature))

                        # 오래된 프레임은 시간 기준으로 제거
                        while sequence and now - sequence[0][0] > WINDOW_SEC:
                            sequence.popleft()

                        if len(sequence) < MIN_FRAMES:
                            # 추론 전에는 이전 라벨이 화면에 남지 않게 비운다.
                            current_label = ""
                            english_label = ""
                            current_conf = 0.0
                        else:
                            (
                                current_label,
                                english_label,
                                current_conf,
                                inference_ms,
                            ) = run_model(smoother, sequence)

                            # 같은 라벨이 임계값 이상으로 연속 몇 번 나왔는지 센다.
                            if current_conf >= THRESHOLD:
                                if current_label == streak_label:
                                    streak_count += 1
                                else:
                                    streak_label = current_label
                                    streak_count = 1
                            else:
                                streak_label = ""
                                streak_count = 0

                            if (
                                streak_count >= CONFIRM_STREAK
                                and try_add_word(
                                    current_label,
                                    current_conf,
                                    check_suppress=True,
                                )
                            ):
                                added = True

                                # 다음 동작이 이전 동작에 끌려가지 않도록 완전 초기화
                                sequence.clear()
                                smoother.reset()
                                streak_label = ""
                                streak_count = 0
                                cooldown_until = now + COOLDOWN_SEC
                                locked = REQUIRE_HAND_RELEASE

                else:
                    missing_frames += 1

                    # 손이 내려갔으므로 다음 단어를 받을 수 있게 잠금 해제
                    if missing_frames >= HAND_LOST_FRAMES:
                        locked = False
                        streak_label = ""
                        streak_count = 0

                    # 손이 연속으로 사라진 순간 = 동작 종료 → 최종 판정 1회
                    if (
                        missing_frames == HAND_LOST_FRAMES
                        and len(sequence) >= MIN_FRAMES
                    ):
                        (
                            current_label,
                            english_label,
                            current_conf,
                            inference_ms,
                        ) = run_model(smoother, sequence)

                        if try_add_word(
                            current_label,
                            current_conf,
                            check_suppress=False,
                        ):
                            added = True

                        sequence.clear()
                        smoother.reset()

                    # 동작이 끝난 뒤에는 이전 라벨이 HUD에 남지 않게 비운다.
                    elif missing_frames > HAND_LOST_FRAMES:
                        current_label = ""
                        english_label = ""
                        current_conf = 0.0

                    # 손을 내린 것으로 확인되면, 같은 단어도 다시 추가할 수 있다.
                    if missing_frames >= HAND_LOST_FRAMES:
                        released_since_add = True

                    if (
                        last_hand_time is not None
                        and now - last_hand_time > HAND_TIMEOUT_SEC
                    ):
                        sequence.clear()
                        smoother.reset()

                        current_label = ""
                        english_label = ""
                        current_conf = 0.0
                        last_hand_time = None

                processing_ms = (
                    time.perf_counter() - processing_started
                ) * 1000.0

                response = {
                    "type": "prediction",
                    "handDetected": hand_detected,
                    "label": current_label,
                    "englishLabel": english_label,
                    "confidence": current_conf,
                    "sentence": sentence,
                    "added": added,
                    "buffer": len(sequence),
                    "inferenceMs": round(inference_ms, 2),
                    "processingMs": round(processing_ms, 2),
                }

                await websocket.send(
                    json.dumps(response, ensure_ascii=False)
                )

        except websockets.exceptions.ConnectionClosed:
            print("[WEB] React 연결 종료")


# ============================================================
# Server
# ============================================================

async def main():
    print("")
    print("======================================")
    print(" KSL Python AI Server")
    print(" ws://localhost:8765")
    print("======================================")
    print("")

    async with websockets.serve(
        handle_client,
        "localhost",
        8765,
        max_size=8_000_000,
    ):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())