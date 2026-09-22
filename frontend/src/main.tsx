import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// 개발 서버의 오래된 자산 캐시를 피하고, 배포된 공개 화면에서만 설치형 앱을 활성화한다.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 서비스워커 등록 실패는 검색·로그인 같은 본문 기능을 막지 않는다.
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
