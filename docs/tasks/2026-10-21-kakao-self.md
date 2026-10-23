# 본인 전용 카카오톡 메시지

- 기준 커밋: `2437ab63ecb42db8f271282d19af191b66f84671` (PR #143).
- 목표: 지정한 회원 한 명이 카카오 계정을 연결하고 본인의 나와의 채팅방으로 시험 메시지와 새 관심 일정 알림을 받는다.
- 제외: 정식 알림톡/문자, 다른 회원 발송, 지도, 운영 키 설정·실발송, commit/push/배포.
- 변경 경로: 신규 KakaoSelf 서버 클래스/V39 migration/서버 테스트, 알림 설정 UI/API/브라우저 테스트, 서버 설정 예시/설정 가이드.
- 완료 기준: owner만 연결·해제·시험 가능, 세션에 묶인 일회성 OAuth state, 토큰 암호화/갱신, 영속 발송 중복 방지, 화면의 오류/재연결 안내.
- 위험: 인증/CSRF, 외부 OAuth, migration. 실발송 비활성 기본값 유지.

## 구현과 검증

### 분업 결정

- auto → parallel. API 계약 확정 뒤 서버와 화면을 분리하고 독립 리뷰 진행.
- 총괄: `/workspace/cheongyak-one`, 공유 설정/기존 파일/프런트/문서/통합 검증.
- backend: `/workspace/cheongyak-kakao-backend`, 같은 기준 detached worktree. 신규 서버·테스트 및 배정 V39만 소유. 커밋 없이 파일 단위 검토 후 통합.
- reviewer: 읽기 전용 보안·인증·발송 경계 검토. 하위 재귀 위임 없음.
- 실제 도구의 기본 에이전트에 저장소 역할 지침을 전달했다. 로컬 TOML이 자동 로딩됐다는 의미는 아니다.
- Playwright/실제 인증/최종 하네스는 총괄 직렬 실행. 서버 관련 단위 검사는 backend 담당.
- 계약: `/api/v1/members/me/kakao-self` GET status / DELETE 연결 해제, `/authorize` POST URL, `/callback` GET 세션+state 검증 후 고정 웹 복귀, `/test` POST 시험 발송.
- 연결 이후 새로 생성된 본인 관심 공고의 접수 시작·마감 7/3/1일 전 알림만 대상. 연결 시 과거 알림 제외. 당일(KST) 알림만 발송.
- 발송 시도 전 DB에 claim을 확정하고 응답 불명은 자동 재전송하지 않는다. 외부 API에 멱등키가 없어 정확히 한 번 도착을 보장하지 않는다. 무료 Render 절전 중 정시 발송도 보장하지 않는다.

| 항목 | 명령/증거 | 결과 |
| --- | --- | --- |
| 시작 상태 | `git status --short`, 원격 main 조회 | clean, 기준 일치 |
| 공식 계약 확인 | Kakao Login REST / KakaoTalk Message REST 문서 | scope talk_message, 서버 토큰/갱신, memo/default/send 확인 |
| 환경 | 하네스 doctor | Java21/Node24/시스템 Chromium 있음. 표준 Playwright Chromium/WebKit 없음. Maven은 기존 `/tmp/oct20-tools/mvn` 래퍼 사용 |
| 관련 검사 | `.harness/oct21-kakao/` | UI 최초16통과, 리뷰회귀4통과, 통합 서버29통과(28.9초), 실제 탈퇴API1통과(1분18초) |
| 최종 통합 | `PATH=/tmp/oct20-tools:$PATH node scripts/harness.mjs verify --base 2437ab6 --scope full --extended` | 하네스14·빌드/단위182·백엔드190실행·인증JAR빌드 통과. PG10제외, 표준 Chromium/WebKit 미설치로 전체 상태 blocked |
| PostgreSQL | 격리 DB migration | 로컬 PostgreSQL 바이너리/DB 없음. 실행 미검증; CI postgres 검사에 V39 테이블 확인 추가 |
| 실서비스 | 카카오 로그인/실제 카카오톡 수신 | 미검증, 운영 키/동의 미설정 |

## 인수인계

- 설정 가이드: `docs/kakao-self-setup.md`.
- 최종 지문·검사 결과·최초 실패·남은 제약은 아래 최종 기록과 `.harness/oct21-kakao/supplemental.json` 참조.
- Git/배포: 미실행. 이번 요청은 구현 범위다.

### 개발 중 발견·수정

- backend 최초21개 중19통과/2오류: DriverManagerDataSource의 연결 종료와 H2 2.4 CHECK-IN 세션 캐시 충돌. 운영과 같은 Hikari 테스트 풀로 수정, assertion/DB 제약을 완화하지 않음. 수정 후27통과, 탈퇴 정리 보완 후서비스15통과. 로그 `kakao-backend-test.log`, `kakao-backend-test-final.log`, `kakao-backend-service-final.log`.
- 리뷰 보완: authorize 대기 중 새 설정 편집→이동 중지, 새 authorize의 generation 회전→이전 callback 무효화, configured owner 변경 뒤 탈퇴→실제 저장 MEMBER_ID 기준 토큰 삭제, 시험 발송 경합→기존 SENT로 성공 오보고하지 않고 409 반환. 통합 관련29개와 실제 회원탈퇴API 검사 통과.
- 독립 읽기 전용 최종 리뷰: 추가 차단급 결함 없음. 운영 OAuth/쿠키 전달/실기 수신/PostgreSQL은 별도 검증 대상.
- 프런트 초기 TypeScript와 PC8/모바일Chromium8 통과 후 리뷰 회귀2개 추가, 해당 PC2/모바일2 통과. 최종 검사에서는 고정된 전체 관련 파일을 다시 확인한다.

### 최종 하네스와 브라우저 준비 조건 보완

- 최종 전체 하네스: `.harness/reports/2026-10-21T00-50-02-036Z-37383/report.json`. fingerprint `8a759e4210b6ac6dc75d5e9a44f56d3337b74b7e14fd11adf464c59f880181bf`, 실행 중 변경 없음. 백엔드 전체200 중190통과/PG10제외. 실제 V39 Flyway+H2 매핑 검증 포함. 표준 Chromium·iPhone·인증 브라우저는 브라우저 부재로 blocked이며 성공으로 해석하지 않는다.
- 시스템 Chromium 보조25개 최초 실행: **15통과/2실패/8미실행**, 최대 실패2건 도달로 중단. 두 실패 모두 `open()`의 회원 버튼 대기5초에서 발생, 카카오 기능 진입 전 단계. `.harness/oct21-kakao/final-browser.json` 및 trace를 보존했다.
- trace에 me200→favorites200→tracker200까지 완료됐으나 후속 비교/검색조건/프로필/사전점검 초기화가 끝나지 않았고 App은 전체 체인 종료 후 회원 버튼을 표시한다. 독립 리뷰 후 마지막 eligibility-profile GET204 응답 대기를 goto 전에 등록했다. 버튼/기능 assertion·timeout·retries는 유지. 환경 지연 자체의 근본 원인 해결을 주장하지 않는다.
- 전체 하네스 이후 바뀐 앱/서버/빌드 파일 없음. `frontend/e2e/kakao-self-resilience.spec.ts`의 준비 조건만 변경. `.harness/oct21-kakao/frozen-source.json`(434파일)과 `final-source.json`을 분리하고, 영향받은 브라우저 파일 전체를 다시 실행한다. 기존 알림 초안5개는 최초 보조검사에서 통과했고 해당 파일·앱 코드는 불변이다.

### 최종 보조 결과와 한계

- 준비 조건 보완 후 카카오 관련 파일 전체 **20/20 통과**(PC10·모바일 터치 Chromium10, 1.8분, 재시도0). `.harness/oct21-kakao/readiness-browser.json`. 기존 알림 초안5개는 보완 전 보조검사의 통과를 유지하며 이 파일과 앱 코드 모두 불변이다. 이것을 전체 Chromium322개 통과로 해석하지 않는다.
- 실제 로컬 Spring JAR+동일 출처 프록시+시스템 Chromium 로그인/새로고침/다른 탭/CSRF/로그아웃 **1/1 통과**(전체1분, 테스트20.4초), `.harness/oct21-kakao/auth.json`. 카카오 자체는 기본 비활성 상태의 인증 회귀이며 실제 Kakao OAuth 시험을 대체하지 않는다.
- 최종 source manifest: `.harness/oct21-kakao/final-source.json`, 434파일, 정렬 JSON SHA256 `2942eab2c70592f6d5ce4bbe4718a276a69f3e7c749f5e0625a23c56687de1bc`. 전체 하네스 당시 manifest와의 차이는 새 E2E의 준비 조건 한 파일뿐이다. 최종 보조검사 후 소스 동일성 확인, 기록 Markdown만 갱신했다. 문서 규칙/하네스 자체 검사 결과는 supplemental.json에 추가한다.
- 미검증: 표준 Chromium 전체322개, iPhone WebKit, PostgreSQL V39 적용, 실제 카카오 로그인/동의/refresh/기기 수신, Vercel OAuth 콜백 쿠키. 운영 비밀값 등록·동의·실발송·commit/push/배포 없음.
- 다음 단계: 정상 브라우저/격리 PostgreSQL 또는 이후 승인된 원격 반영의 기존 CI로 남은 검사를 완료한 뒤, 사용자 설정 가이드에 따라 운영 앱·키·본인 동의를 연결한다.
