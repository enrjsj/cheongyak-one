import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./auth-e2e",
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4180", trace: "off" },
  projects: [
    { name: "auth-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "auth-iphone", use: { ...devices["iPhone 13"], browserName: "webkit" } },
  ],
  webServer: [
    {
      command: "java -jar ../backend/target/cheongyak-one-backend-0.1.0-SNAPSHOT.jar --server.port=8081 --spring.profiles.active=local --app.notice-sync.run-on-startup=false --app.member-mail.delivery=disabled --app.member-mail.verification-required=false --app.cors.allowed-origins=http://127.0.0.1:4180 --spring.jpa.defer-datasource-initialization=true --spring.sql.init.mode=always --spring.sql.init.data-locations=file:auth-e2e/notices.sql",
      url: "http://127.0.0.1:8081/actuator/health", timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4180",
      env: { VERCEL: "1", VITE_API_BASE_URL: "https://must-not-be-used.invalid", VITE_API_PROXY_TARGET: "http://127.0.0.1:8081" },
      url: "http://127.0.0.1:4180",
    },
  ],
});
