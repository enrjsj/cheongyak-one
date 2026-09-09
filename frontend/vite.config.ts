import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    // 운영 소스맵에는 내부 코드가 포함되므로 개발 빌드에서만 생성한다.
    sourcemap: mode !== "production"
  }
}));
