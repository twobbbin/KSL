import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  const videoRef = useRef(null);

  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let stream = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('카메라 접근 실패:', error);

        if (isMounted) {
          setCameraError(true);
        }
      }
    };

    startCamera();

    // Home 페이지에서 나가면 카메라 종료
    return () => {
      isMounted = false;

      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return (
    <div className="home-page">

      {/* =========================
          HEADER
      ========================= */}
      <header className="navbar">

        <Link to="/" className="logo">
          KS<span>Lens</span>
        </Link>

        <nav>
          <Link to="/">Home</Link>
          <a href="#process">About</a>
        </nav>

      </header>


      {/* =========================
          HERO
      ========================= */}
      <main className="hero">

        {/* 왼쪽 소개 */}
        <section className="hero-text">

          <p className="tag">
            AI SIGN LANGUAGE TRANSLATOR
          </p>

          <h1>
            실시간 수어를
            <br />
            자연스러운 음성으로
          </h1>

          <p className="description">
            카메라를 통해 수어를 인식하고,
            자연어 처리를 이용해 자연스러운 한국어 문장으로 변환한 뒤
            음성으로 전달합니다.
          </p>


          {/* 실시간 번역 페이지 이동 */}
          <Link
            to="/realtime"
            className="hero-button"
          >
            실시간 수어 인식 시작
            <span>→</span>
          </Link>

        </section>


        {/* =========================
            오른쪽 웹캠 Preview
        ========================= */}
        <section className="preview">

          <div className="camera-box">

            {!cameraError ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="hero-camera"
                />

                {/* LIVE 표시 */}
                <div className="camera-overlay">
                  <span className="live-dot"></span>
                  CAMERA PREVIEW
                </div>

                {/* 하단 안내 */}
                <div className="camera-bottom">
                  실시간 수어 인식 미리보기
                </div>
              </>
            ) : (
              /* 카메라 권한 거부 / 오류 */
              <div className="camera-error">

                <div className="camera-error-icon">
                  ◉
                </div>

                <p className="camera-title">
                  카메라를 사용할 수 없습니다
                </p>

                <p className="camera-description">
                  브라우저에서 카메라 권한을 허용해주세요.
                </p>

              </div>
            )}

          </div>

        </section>

      </main>


      {/* =========================
          HOW IT WORKS
      ========================= */}
      <section
        className="process"
        id="process"
      >

        <p className="small-title">
          HOW IT WORKS
        </p>

        <h2>
          수어에서 음성까지
        </h2>


        <div className="cards">

          {/* STEP 01 */}
          <div className="card">

            <span>
              01
            </span>

            <h3>
              수어 인식
            </h3>

            <p>
              카메라를 통해 사용자의
              손과 자세를 인식합니다.
            </p>

          </div>


          <div className="arrow">
            →
          </div>


          {/* STEP 02 */}
          <div className="card">

            <span>
              02
            </span>

            <h3>
              자연어 처리
            </h3>

            <p>
              인식된 수어 단어들을
              자연스러운 한국어 문장으로 변환합니다.
            </p>

          </div>


          <div className="arrow">
            →
          </div>


          {/* STEP 03 */}
          <div className="card">

            <span>
              03
            </span>

            <h3>
              음성 출력
            </h3>

            <p>
              완성된 문장을 TTS를 이용해
              음성으로 출력합니다.
            </p>

          </div>

        </div>

      </section>


      {/* =========================
          FOOTER
      ========================= */}
      <footer className="footer">

        <p>
          © 2026 KSLens
        </p>

      </footer>

    </div>
  );
}

export default Home;