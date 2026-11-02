# 🤟 KSL 핑크 수어 실시간 번역기 (Sign Language Translator)

실시간 수어 동작 인식, MediaPipe 손/포즈 랜드마크 추적, BiLSTM+Attention 모델 기반 수어 단어 분류 및 Gemini AI 문장 재구성 기능이 결합된 통합 수어 번역 웹 애플리케이션입니다.

---

## 🏗️ 시스템 아키텍처 및 폴더 구조

```text
SignLanguageTranslator/
├── public/                 # 정적 리소스
├── src/                    # 🌐 React 웹 프론트엔드
│   ├── components/         # UI 컴포넌트 (카메라 뷰포트, 번역 패널, 설정 모달 등)
│   ├── pages/              # 페이지 컴포넌트 (Home, Realtime 등)
│   ├── data/               # 수어 데이터 및 초기 프리셋
│   ├── App.jsx             # 최상위 컴포넌트 (WebSocket 연결 & 상태 관리)
│   ├── main.jsx            # React 엔트리포인트
│   └── index.css           # 전역 스타일링
├── server/                 # 🐍 Python AI 백엔드 (WebSocket 서버)
│   ├── ksl_server.py       # 메인 WebSocket 서버 & 실시간 추론/번역 파이프라인
│   ├── bilstm_attention.py # 모델 아키텍처 (TemporalAttention)
│   ├── sentence.py         # 규칙 기반 문장 완성 fallback 모듈
│   ├── vocabulary.py       # 수어 단어 영-한 매핑 사전
│   ├── hand_landmarker.task      # MediaPipe 손 랜드마크 모델
│   ├── pose_landmarker_lite.task # MediaPipe 포즈 랜드마크 모델
│   └── .env                # 서버 환경변수 (Gemini API 키)
├── package.json            # Node.js 의존성 및 스크립트
├── vite.config.ts          # Vite 빌드 설정
└── README.md               # 프로젝트 안내 문서
```

---

## 🚀 빠른 시작 가이드 (Quick Start)

본 프로젝트는 **[1] Python AI 백엔드 서버**와 **[2] React 웹 프론트엔드**를 각각 실행해야 합니다.

### 사전 요구 사항
- **Node.js**: v18 이상 권장
- **Python**: 3.9 ~ 3.11 권장
- **웹캠**: 실시간 수어 동작 캡처용

---

### 1. Python AI 서버 실행 (`server/`)

1. **필요 패키지 설치**
   ```bash
   pip install websockets mediapipe opencv-python tensorflow numpy google-genai python-dotenv
   ```

2. **환경변수(`.env`) 설정**
   `server/.env` 파일을 생성하거나 수정하여 Google AI Studio에서 발급받은 Gemini API 키를 입력합니다:
   ```env
   GEMINI_API_KEY=AIzaSy...본인의_GEMINI_API_키
   GEMINI_MODEL=gemini-3.8-flash
   ```
   > 💡 `GEMINI_API_KEY`가 없어도 규칙 기반(`sentence.py`) 문장 완성 모드로 자동 fallback 동작합니다.

3. **AI 서버 실행**
   ```bash
   cd server
   python ksl_server.py
   ```
   - 정상 실행 시 `ws://localhost:8765`에서 웹소켓 서버가 대기합니다.

---

### 2. React 프론트엔드 실행 (`루트 디렉토리`)

새 터미널 창을 열고 프로젝트 루트에서 진행합니다:

1. **패키지 설치**
   ```bash
   npm install
   ```

2. **환경변수 설정 (선택 사항)**
   프론트엔드 단독 Gemini 기능이 필요한 경우 루트에 `.env.local` 생성:
   ```env
   GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
   ```

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```
   브라우저에서 `http://localhost:3000` (또는 터미널에 표시된 포트)로 접속합니다.

---

## 📁 주요 파일 및 기능 정리

### 🌐 프론트엔드 (`src/`)
| 파일 / 폴더 | 주요 기능 |
| :--- | :--- |
| **`src/App.jsx`** | **최상위 컨트롤러**: Python WebSocket(`ws://localhost:8765`) 연결 및 실시간 번역 결과, 인식 상태 통합 관리 |
| **`src/components/CameraViewport.jsx`** | **카메라 & 랜드마크 뷰어**: 웹캠 영상 스트리밍 및 MediaPipe Hands 랜드마크/스켈레톤 Canvas 실시간 렌더링, 서버 전송 |
| **`src/components/TranslationPanel.jsx`** | **번역 출력 패널**: 실시간 인식 단어열 및 완성 문장 표출, TTS(음성 읽기), 복사, Gemini 문장 재구성 요청 |
| **`src/components/Header.jsx`** | 상단 네비게이션, WebSocket 연결 상태 인디케이터, 테마/설정 팝업 제어 |
| **`src/components/SettingsModal.jsx`** | UI 테마(핑크 테마 4종), 거울 모드, 제스처 인식 감도, TTS 속도 등 설정 |
| **`src/components/StatsBar.jsx`** | 추론 지연시간(Latency) 및 KSL Vision 엔진 상태 HUD 표시 |
| **`src/data/signData.js`** | 수어 사전 프리셋 및 UI 예시 데이터 |

### 🐍 백엔드 (`server/`)
| 파일 | 주요 기능 |
| :--- | :--- |
| **`server/ksl_server.py`** | **실시간 WebSocket 서버**: 웹캠 프레임을 수신하여 MediaPipe 추출 → BiLSTM 추론 → 스무딩/단어 확정 → Gemini 문장 변환 수행 후 클라이언트에 전송 |
| **`server/bilstm_attention.py`** | BiLSTM + Temporal Attention 메커니즘을 적용한 수어 시퀀스 인식 딥러닝 모델 아키텍처 |
| **`server/sentence.py`** | Gemini API 미사용 또는 네트워크 오류 시 동작하는 규칙 기반(문법/조사) 한국어 문장 빌더 |
| **`server/vocabulary.py`** | 모델 출력 클래스 인덱스 및 영어 라벨을 한국어 표준 수어 단어로 변환하는 딕셔너리 |
| **`server/.env`** | 백엔드 전용 환경변수 (Gemini API 키 및 모델명 보관) |

---

## ⚙️ 타 환경 또는 배포 시 확인해야 할 설정

다른 PC에서 구동하거나 모델 가중치 위치가 다를 경우 아래 경로를 점검해야 합니다:

### 1. `server/ksl_server.py` 내 모델 가중치 경로
`server/ksl_server.py`의 상단 경로 설정을 본인 PC의 실제 파일 경로에 맞게 지정합니다:
```python
# KSL_KEYPOINTS_v1 폴더 경로 지정
BASE_DIR = Path(r"C:\Users\ds2el\Downloads\KSL_KEYPOINTS_v1")

# 모델 및 클래스 파일 경로
MODEL_PATH = BASE_DIR / "outputs" / "kfold_v1" / "fold_4" / "best_model.keras"
CLASS_NAMES_PATH = BASE_DIR / "outputs" / "kfold_v1" / "class_names_kfold.json"

# MediaPipe 모델 파일 경로 (server 폴더 기준 상대 경로 권장)
HAND_MODEL_PATH = Path(__file__).resolve().parent / "hand_landmarker.task"
POSE_MODEL_PATH = Path(__file__).resolve().parent / "pose_landmarker_lite.task"
```

### 2. WebSocket 서버 주소 (`src/App.jsx`)
웹 프론트엔드와 Python 서버가 서로 다른 기기이거나 원격 서버에 배포된 경우:
- [src/App.jsx](file:///c:/Users/ds2el/Downloads/SignLanguageTranslator/src/App.jsx)의 WebSocket URL을 해당 IP/도메인으로 변경합니다.
  ```javascript
  const socket = new WebSocket('ws://<서버_IP_또는_도메인>:8765');
  ```