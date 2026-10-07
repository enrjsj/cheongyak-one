# 프로젝트 지도

기준: 2026-10-07, `main`의 `fc51550f40df4cd846c8d4e0b42122960f41f3fb`. 아래 과거 작업 설명은 당시 기록이며 현재 상태는 코드와 `docs/HANDOFF.md`를 우선한다.

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
- 단일·멀티 자동 선택과 격리·통합: `docs/MULTI_AGENT.md`, `.codex/config.toml`, `.codex/agents/`
- 지속할 결정: `docs/DECISIONS.md`
- 현재 상태: `docs/HANDOFF.md`


## 2026-10-07 공급기관 개선과 운영 확인

# 청약한눈 프로젝트 맥락

확인일: 2026-10-07 (Asia/Seoul). 작업 시작 기준 main: `3b6540e1f7c36f78144946f2116cbae42f0f4a17` (PR #124).

## 문서 확인

작업 시작 시 저장소와 상위 작업 디렉터리에 AGENTS.md, PROJECT_CONTEXT.md, HANDOFF.md가 없었다. 이 문서는 README, docs, 실제 코드와 운영 응답을 근거로 새로 작성했다. 별도의 AGENTS 지침을 읽었다고 간주하지 않는다.

## 현재 구조와 기능

- React 19 + TypeScript + Vite 프런트엔드, Java 21 + Spring Boot + JPA API, Flyway 마이그레이션.
- 공개 서비스: https://cheongyak-one-five.vercel.app/ 및 https://cheongyak-one-api.onrender.com/actuator/health. GitHub main 연동 Vercel·Render 자동 배포를 사용한다. 저장소의 AWS 배포 가이드는 대안 구성이다.
- 청약홈 아파트·오피스텔, 마이홈 공공임대를 수집하고 검색·필터·일정·상세·주택형 비교를 제공한다. 회원 관심 공고·메모·알림·맞춤 추천·자금 계획 등의 기존 기능을 유지한다.
- 탐색 UI는 흰색과 파란색 중심, 사진 없는 정보 카드, PC 사이드 필터·모바일 조건 창이다. 접수중·접수 예정·마감 임박 표시와 카드 본문 상세 열기, 별도 북마크·비교 영역까지 구현돼 있다.
- 날짜 판단은 Asia/Seoul 기준이다. 무료 Render 기동 지연은 기존 재시도·최근 목록 캐시로 대응한다.

## 이번 개발

공급기관을 상세 클릭 전부터 표시한다. 저장된 `SubscriptionNotice.businessEntityName`을 목록 요약 API에 추가하며 DB 변경이나 공고별 상세 자동 조회는 없다. 목록 필드가 없는 구버전 응답은 수집 시각이 같은 상세 캐시만 보조로 사용한다. null·공백은 미확인 안내를 유지하고 출처 포털명을 공급기관으로 추정하지 않는다.

## 검증과 배포

표준 명령은 `npm --prefix frontend test`, `npm --prefix frontend run test:e2e`, `mvn -B -pl backend test`다. iPhone WebKit은 `IPHONE_TEST=1`과 `--project=iphone-webkit`, 실제 세션 검증은 `frontend/playwright.auth.config.ts`를 사용한다.

CI의 frontend, iphone, auth-browsers, backend, postgres, infrastructure, real-data를 확인한 뒤 main에 병합한다. 배포는 `node scripts/verify-deployment.mjs <웹 origin> <API origin> <main SHA>`로 웹·API·프록시의 동일 리비전과 응답을 확인한다. 실행 환경별 제한과 실제 결과는 HANDOFF.md에 기록한다.

## 다음 후보 (우선순위 제안)

1. 공급기관 데이터 누락 비율을 수집 소스별로 측정하고 원본에 값이 있는 경우의 매핑 누락을 점검한다. 공급기관을 임의 추정하지 않는다.
2. 탐색 카드·상세의 접근성 자동 검사 범위를 확대한다. 현재 키보드·초점 복원·터치 회귀 테스트에 더해 의미 구조와 대비를 점검한다.

후보는 이번 작업에서 완료한 기능이 아니며, 다음 작업 시 실제 데이터와 요구를 다시 확인한다.
