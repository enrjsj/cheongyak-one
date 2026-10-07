# 프로젝트 지도

기준: 2026-10-07, `main`의 `0bc8b95c200704941f84d24c7583b6f87860c7b8`을 읽어 정리했다. 이후 변경은 실제 소스로 재확인한다.

| 영역 | 기준 파일 | 역할 |
| --- | --- | --- |
| 프런트 | `frontend/package.json`, `frontend/src/App.tsx` | React 19/TypeScript/Vite, 검색·회원 상태 조합 |
| API 통신 | `frontend/src/api.ts`, `frontend/vite.config.ts`, `frontend/vercel.json` | 세션·CSRF·API 계약, 로컬 프록시/운영 rewrite |
| 화면 책임 | `docs/frontend-architecture.md` | 카드·상세·주택형·현금계획·일정·접근성 |
| 백엔드 | `backend/pom.xml`, `backend/src/main/java/com/cheongyakone` | Java 21, Spring Boot 4.1, API·비즈니스 로직·배치 |
| DB | `backend/src/main/resources/db/migration` | Flyway 버전별 SQL. 기존 이력은 불변 |
| 테스트 | `frontend/tests`, `frontend/e2e`, `frontend/auth-e2e`, `backend/src/test` | 단위/브라우저/실제 로컬 인증/백엔드 |
| CI | `.github/workflows/ci.yml` | 프런트, Chromium, iPhone, 실제 인증, H2, PostgreSQL, 인프라, 실데이터 |
| 배포 확인 | `scripts/verify-deployment.mjs` | 프런트·API 배포 revision과 공개 응답 검증 |

공개 테스트 구성은 React → Vercel, Spring Boot → Render, PostgreSQL → Supabase다. 이 하네스는 인프라나 DB 연결 설정을 바꾸지 않는다. 운영 접속정보는 플랫폼 환경변수에 두며 문서에는 비밀값을 넣지 않는다.

## 테스트 환경

- Node 22.12+ (CI: Node 22), npm, Java 21, Maven 3.9+.
- 프런트 `npm test`에 TypeScript 검사·Vite 빌드·Node 테스트가 이미 포함된다. 별도 빌드를 반복하지 않는다.
- 일반 브라우저 테스트는 모의 API를 사용한다. 실제 Spring 세션은 `playwright.auth.config.ts`의 별도 로컬 테스트다.
- 일반 백엔드 테스트는 H2다. PostgreSQL 문법·마이그레이션 검증은 별도의 로컬 PostgreSQL 또는 기존 CI job이 필요하다.
- 이 하네스는 API 키 없이 실행하며 운영 동기화/AI/메일/푸시를 호출하지 않는다.

## 작업별 추가 문서

- 실행 및 기존 기능: `README.md`
- 서버 구조: `docs/project-structure.md`
- UI 변경: `docs/frontend-architecture.md`
- 하네스 사용과 한계: `docs/HARNESS.md`
- 지속할 결정: `docs/DECISIONS.md`
- 현재 상태: `docs/HANDOFF.md`
