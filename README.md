# KSLens — AI 기반 실시간 한국 수어 인식 및 번역 시스템

**KSLens**는 웹캠으로 입력된 한국 수어 동작을 AI 모델로 인식하고, 이를 텍스트 및 음성으로 제공하는 웹 기반 수어 번역 서비스입니다.

PC와 모바일 웹 환경을 지원하도록 설계하여 별도의 애플리케이션 설치 없이 브라우저에서 사용할 수 있도록 개발했습니다.

## 1. 프로젝트 개요

- **프로젝트명:** KSLens
- **프로젝트 유형:** AI 기반 실시간 수어 인식·번역 웹 서비스
- **개발 목적:** 청각·언어장애인과 비수어 사용자 간 의사소통 지원
- **핵심 기능:** 실시간 수어 인식, 텍스트 변환, 문장 번역, 음성 출력
- **지원 환경:** PC 웹 및 모바일 웹

## 2. 주요 기능

### 실시간 수어 인식
- 웹캠을 통한 실시간 영상 입력
- MediaPipe 기반 손·신체 랜드마크 추출
- Bi-LSTM + Attention 기반 수어 동작 분류
- 예측 결과 및 신뢰도 표시

### 수어 번역 및 음성 출력
- 인식된 수어 단어의 텍스트 변환
- 단어 조합 및 자연어 문장 생성
- Gemini 기반 문장 번역
- 음성 합성(TTS)을 통한 번역 결과 출력

### 실시간 웹 서비스
- React 기반 사용자 인터페이스
- WebSocket을 활용한 실시간 영상 데이터 전송
- Python 서버에서 AI 추론 수행
- 카메라 및 인식 상태 제어

### 모바일 웹 지원
- 반응형 UI 적용
- 모바일 브라우저 카메라 접근 지원
- HTTPS 및 WSS 기반 통신 환경 구성
- PC·모바일 통합 프론트엔드 운영

## 3. 기술 스택

| 구분 | 기술 |
|---|---|
| Frontend | React, JavaScript, Vite, Tailwind CSS |
| Backend | Python, WebSocket |
| AI / Deep Learning | TensorFlow, Keras, Bi-LSTM, Attention |
| Computer Vision | MediaPipe, OpenCV |
| Generative AI | Gemini API |
| Network | Cloudflare Tunnel, HTTPS, WSS |
| Collaboration | Git, GitHub |

## 4. 시스템 아키텍처

```text
[PC / Mobile Browser]
         |
         v
[React Web Application]
         |
         | Camera Frame (JPEG)
         | WebSocket
         v
[Python AI Server]
         |
         v
[MediaPipe Landmark Extraction]
         |
         v
[Bi-LSTM + Attention Model]
         |
         v
[Sign Language Prediction]
         |
         v
[Sentence Generation / Gemini]
         |
         v
[Text / Speech Output]
```

개발 환경에서는 Vite WebSocket Proxy와 Cloudflare Tunnel을 활용하여 모바일 HTTPS 환경에서도 Python AI 서버에 접근할 수 있도록 구성했습니다.

## 5. AI 모델 성능

| 평가 지표 | 결과 |
|---|---|
| 수어 클래스 | 67개 |
| 학습 데이터 | 1,207개 샘플 |
| 5-Fold 평균 Accuracy | 84.27% |
| 5-Fold 평균 Macro F1 | 0.8377 |
| 5-Fold 평균 Top-3 Accuracy | 95.30% |
| 최고 Fold Accuracy | 88.73% |

※ 해당 성능은 모델 평가 결과이며, 실제 모바일 환경의 실시간 인식 정확도와는 구분됩니다.

## 6. 실행 방법

### React 프론트엔드

```bash
npm install
npm run dev -- --host 0.0.0.0
```

로컬 접속: `http://localhost:3000`

### Python AI 서버

필요한 Python 패키지와 모델 파일을 준비한 후 실행합니다.

```bash
python ksl_server.py
```

기본 WebSocket 포트: `8765`

### 모바일 HTTPS 테스트

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

Cloudflare Tunnel에서 생성된 HTTPS 주소로 모바일 브라우저에서 접속합니다.

> Cloudflare Quick Tunnel은 개발·테스트용입니다. 실제 서비스 운영 시에는 인증, 보안 설정 및 별도 배포 환경 구성이 필요합니다.

## 7. 향후 개선 계획

- 모바일 UI 및 카메라 화면 최적화
- 모바일 환경의 실시간 AI 인식 성능 검증
- 다양한 수어 표현에 대한 데이터셋 확장
- 연속 수어 인식 및 문장 번역 정확도 개선
- 실시간 추론 지연시간 및 영상 전송 효율 최적화
