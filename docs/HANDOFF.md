# 작업 인계

## GitHub main 연동 배포 점검 (2026-10-07)

- 사용자 요청에 따라 이후 배포는 기존 GitHub `main` → Vercel/Render Git 연동을 우선한다. 이번에는 아래 확정 결과와 조사 기록을 main의 문서 커밋으로 반영한다. 진행 중 공급기관 집계 앱 파일은 배포하지 않는다.
- `75a7d6f`는 main 반영과 CI #313의 8개 작업 성공까지 확인됐다. [운영 검증 실행](https://github.com/enrjsj/cheongyak-one/actions/runs/37590579364)은 새 웹 revision이 반영되지 않은 상태에서 실패했다. CI 빌드/테스트 실패와 배포 버전 불일치를 구분한다.
- Vercel bot의 [PR #128 기록](https://github.com/enrjsj/cheongyak-one/pull/128#issuecomment-6033374504)에서 `4d90a41` Preview Ready를 확인했다. 반면 main `75a7d6f`의 Vercel 배포/commit status는 조회되지 않았고 운영 alias는 `fc51550`에 남았다. Render는 `75a7d6f`, health 200/UP이었다.
- 정상 운영 배포 `fc51550`도 문서만 바꾼 커밋이었다. 따라서 문서 변경이라는 이유만으로 이번 배포가 생략됐다고 단정할 수 없다. 이전 정상 squash merge와 이번 커밋 모두 작성자 `enrjsj`, committer GitHub이며 프런트·워크플로·Render·Docker 설정 diff도 없다.
- 확인 범위에서는 GitHub main 이벤트에서 Vercel 배포 생성까지 이어지는 구간이 조사 대상이다. 웹훅 전달 실패, 서비스 내부 필터/설정 등 정확한 원인은 미확정이다. Vercel 팀 이벤트 조회 `GET /v3/events`도 403으로 거부되어 내부 원인을 확인하지 못했다. 연결 context는 teams 빈 목록을 반환했지만 실제 계정 소유권 변경의 증거로 간주하지 않는다.
- Vercel 직접 API 권한 403과 Git 자동 배포 누락을 같은 원인이라고 단정하지 않는다. 이번 main 후속 커밋의 자동 배포·동일 revision 확인 결과는 후속 기록 또는 GitHub 운영 검증 실행을 확인한다. 결과를 만들기 위해 보호 설정·검증 기준·앱 코드를 변경하지 않는다.

## 자동 분업 설정 통합 (2026-10-07)

- 다른 환경의 ‘청약 세팅’ 미커밋 설정을 main `fc51550f40df4cd846c8d4e0b42122960f41f3fb` 기준으로 선별 통합했다. 설정 전용 worktree/브랜치는 `cheongyak-one-settings` / `chore/auto-delegation`이다.
- AGENTS에 단일/멀티 자동 선택, 하위 최대 3명, 모델·추론 상속, 재귀 위임 금지, worktree·미커밋 snapshot·파일 소유권·고정 포트 테스트 직렬화를 명시했다. `.codex` 역할 3개와 설정, `docs/MULTI_AGENT.md`를 추가했다.
- 원본의 오래된 HANDOFF/PROJECT_CONTEXT 상태로 덮어쓰지 않았다. 아래 PR #125/#127 기록과 루트 문서 포인터를 보존했다. CLI 미설치라는 과거 환경 설명은 제거했다.
- 공급기관 누락 집계 기능의 미커밋 앱/테스트 파일은 별도 `feat/admin-supplier-quality` 브랜치와 원래 worktree에 보존했다. 이번 설정 반영에 포함되지 않으며 완료/배포된 기능으로 간주하지 않는다.

### 검증·리뷰

- TOML 4개 파싱, 역할 이름/필수 필드, 한도 3, 모델/추론 미고정, reviewer read-only, 권한·네트워크 override 없음 확인 통과.
- `node scripts/harness.mjs plan --base fc51550f40df4cd846c8d4e0b42122960f41f3fb`: `.codex`를 공통 설정으로 취급해 auto=full. 해당 범위 회귀 사례를 기존 테스트에 추가했다.
- `node scripts/harness.mjs verify --scope docs --base fc51550f40df4cd846c8d4e0b42122960f41f3fb`: 자체 테스트 14개 및 규칙 검사 통과. 초기 증거 `.harness/reports/2026-10-07T07-38-43-208Z-45387/report.json`. 설정·문서 변경이라 명시적으로 docs로 좁혔으며 앱 전체 통과로 표시하지 않는다. 최종 기록 후 동일 명령으로 재검증한다.
- 읽기 전용 기본 서브에이전트 `settings_review`에 reviewer 역할 지침을 전달해 독립 리뷰를 수행했다. 앱 코드 혼입·최신 기록 손실·권한 경계 결함은 발견되지 않았다. 사용자 정의 TOML 역할의 자동 로딩을 입증한 실행은 아니다.
- 공식 OpenAI Codex `codex-rs/core/config.schema.json`의 `AgentsToml`과 `codex-rs/agent-roles/src`의 파서/탐색 코드를 대조했다. 설정 활성화·한도 및 standalone 역할 형식의 근거로 사용하며, 특정 사용자 PC 버전 지원을 보장하지 않는다.
- 이 환경의 CLI는 `0.159.0-alpha.3`이다. `codex --strict-config -c agents.enabled=true -c agents.max_concurrent_threads_per_session=3 doctor --summary`에서 config loaded를 확인했으나 외부 provider 연결 검사 실패로 전체 doctor는 exit 1이다. 전체 정상이나 실제 역할 생성 성공으로 기록하지 않는다.

### 미검증·후속 작업

- 사용자 PC의 프로젝트 신뢰/버전별 역할 자동 로딩, 동시 한도 실제 적용은 미검증. `docs/MULTI_AGENT.md`의 읽기 전용 새 세션 절차로 확인한다. 글로벌 설정이나 신뢰 정책을 우회하지 않았다.
- 설정 전용 [PR #128](https://github.com/enrjsj/cheongyak-one/pull/128)을 [CI #312](https://github.com/enrjsj/cheongyak-one/actions/runs/37589060055) 8개 작업 성공 후 main에 병합했다. 병합 커밋은 `75a7d6f1054fc7e9a7d16cd70e3343658bc52232`다. Chromium 226개·iPhone 39개·실제 로그인 2개 모두 재시도 없이 통과했다. 최종 로컬 설정 하네스 증거는 `.harness/reports/2026-10-07T07-41-42-245Z-45975/report.json`이다.
- 원래 기능 브랜치를 새 main으로 fast-forward하고 진행 중 파일 15개의 SHA-256이 모두 동일함을 확인했다. `/tmp/supplier-preserved-before-settings.json`은 로컬 보존 확인 증거다. 이 후속 상태 기록은 해당 기능 worktree에 남기며 설정 전용 병합의 파일 내용과 구분한다.
- 병합 커밋의 [main CI #313](https://github.com/enrjsj/cheongyak-one/actions/runs/37589825952)도 8개 작업 성공. Chromium 226개와 iPhone 39개는 재시도 없이 통과했다.
- Render `/api/v1/release`는 병합 SHA, `/actuator/health`는 HTTP 200/UP을 반환했다. Vercel은 기존 `fc51550`을 반환하며 새 main 운영 배포가 조회되지 않았다. 배포 생성은 팀 `1-4156` 권한 부족(HTTP 403)으로 거부됐다. 별도 Vercel CLI/인증도 없어 같은 요청을 재시도하거나 설정을 우회하지 않았다. 웹·API 동일 revision 검증은 **미완료**이며, 프런트 배포 성공으로 표시하지 않는다.
- Vercel 대상은 기존 `prj_U2Rrn4ZSI2p6FnEbR1b0TG8CZa91` 프로젝트와 `cheongyak-one-five.vercel.app`이다. 권한 있는 연결에서 해당 main 커밋을 배포한 뒤 `scripts/verify-deployment.mjs`로 다시 확인해야 한다. 앱 동작 코드는 이번 설정 변경에 포함되지 않았다.
- 사용자 재연결 안내 후 같은 팀/프로젝트를 명시한 배포 목록 조회도 HTTP 403이었다. 첨부 화면은 `Vercel(으)로 계속` 인증 진입 단계로 보여, Vercel 측 로그인·승인 완료와 해당 팀 접근 권한을 확인해야 한다. 변경 없는 배포 생성 요청은 반복하지 않았다.
- 동일 revision을 기다리던 로컬 검증 프로세스는 Vercel 배포 권한 차단을 확인한 후 종료했다. 빈 `/tmp/settings-production-verification.json`을 통과 증거로 사용하지 않는다. 서버 응답과 배포 차단의 최종 요약은 `/tmp/settings-integration-result.json`에 기록했다.
- 공급기관 집계 기능의 PostgreSQL/iPhone/실제 인증 CI 및 운영 관리자 로그인 검증은 별도 미완료 작업이다. 기존 브랜치의 테스트 증거와 작업 기록을 확인해 이어간다.

## 최종 상태 (2026-10-07 16:00 KST)

- 공급기관 첫 화면 표시 PR #125와 검증 보완·문서 통합 [PR #127](https://github.com/enrjsj/cheongyak-one/pull/127)을 main에 병합했다. PR #127 병합 커밋은 `5bf2b754221c2f2553f436e8da9422d60958ec5a`다.
- 최종 테스트 코드 `b1c2e7b0a79d4a062ccb430510d06582b81c51ce`의 [CI #309](https://github.com/enrjsj/cheongyak-one/actions/runs/37584002520)는 **8개 작업 모두 성공**했다. Chromium **226개**, iPhone WebKit **39개** 모두 최초 실행 통과, flaky 없음. 하네스 자체 14개, 프런트 단위 141개, 백엔드 일반 150개·별도 PostgreSQL 7개, 실제 세션 2개와 실데이터 검증도 통과했다.
- 운영 검증 리비전 `60fda31781ff37429bc8fac3786412e267477a2d`와 PR #127 사이에는 앱 동작 코드 변경이 없다. 해당 운영 버전에서 기본 응답 7개와 PC/모바일 각 9개 공급기관 표시를 검증했고, 카드 본문·Enter/Space·초점 복원·북마크/비교 독립 동작도 실제 응답으로 재검증해 통과했다 (`/tmp/supplier-click-production.log`).
- 이 최종 기록은 검증 결과를 남기는 문서 전용 후속 커밋이다. 자체 SHA를 본문에 미리 적지 않는다. 문서 커밋 이후 배포 버전은 `scripts/verify-deployment.mjs`의 정확한 SHA 검사 및 main CI/운영 검증 워크플로에서 확인한다. 이전 리비전 검증을 새 리비전 통과로 표시하지 않는다.
- 남은 제한: 로컬 전체 하네스는 도구 경로 부족으로 blocked(아래 증거 참조), 실제 기기 Safari·원본 공급기관 전수 정확성·운영 회원 데이터 쓰기는 미검증. iPhone 간헐 실패는 독립 테스트 분리 후 최신 CI에서 재시도 없이 해결됐으며, 과거 확대 에뮬레이터 내부 렌더링 원인을 별도로 확정한 것은 아니다.
- 다음 후보: 소스별 공급기관 누락 측정/원본 매핑 확인, 접근성 자동 검사 확대. 현재 작업 트리·배포 결과를 먼저 확인하고 착수한다.

## 2026-10-07 공급기관 첫 화면 표시

### 시작 상태와 범위

- 요청된 AGENTS.md, PROJECT_CONTEXT.md, HANDOFF.md는 저장소와 상위 작업 디렉터리에 없었다. README·설계 문서·코드를 확인하고 PROJECT_CONTEXT와 이 파일을 신규 작성했다.
- 작업 시작 시 로컬·원격 main은 PR #124의 `3b6540e1f7c36f78144946f2116cbae42f0f4a17`, 작업 트리는 깨끗했다.
- 15:18 KST 운영 기준 검증: 웹·API·같은 origin 프록시의 리비전 일치, 공개 응답·인증 경계 7개 통과 (`/tmp/supplier-baseline-deployment.json`, 실행 환경 임시 파일).
- 다음 개발건으로 문서화된 공급기관 표시의 한계를 해결했다. 기존 DB 필드를 목록 DTO에 추가하고 카드에서 즉시 표시한다. null·공백 안내, 구버전 목록의 상세 캐시 호환을 유지한다. DB 마이그레이션·외부 API 변경·기관별 추가 요청은 없다.

### 테스트와 결과

- `npm --prefix frontend run build`: TypeScript와 Vite 빌드 통과.
- `node --experimental-strip-types --test --test-isolation=none frontend/tests/*.test.mjs`: 141개 통과.
- 시스템 Chromium을 쓰는 임시 Playwright 설정, 포트 4175에서 `resilience.spec.ts`, `explore-design.spec.ts`, `notice-card-click.spec.ts`: 45개 통과. 임시 설정은 커밋에서 제외했다.
- 추가한 브라우저 테스트 3개: 320/390/1440px에서 첫 목록의 기관명, null·공백, 긴 기관명의 줄바꿈, 자동 상세 조회 0회, 상세 응답 이후 목록값 유지. 기존 카드 본문·키보드·북마크·비교·구버전 API 호환 테스트도 통과했다.
- 백엔드 통합 테스트는 공급기관의 목록·상세 일치와 상세 전용 필드 제외를 검증하도록 변경하고, 기관명 없는 공고에서 출처명으로 대체하지 않는 테스트를 추가했다.
- CI real-data 하네스에 실제 수집 공고의 목록·상세 공급기관 값 일치 검사를 추가했다.

### 제한과 배포 상태

- 로컬 Maven의 기본 캐시 경로 쓰기 제한은 작업 공간의 캐시 경로 지정으로 해결했다. 이후 Java 컴파일 단계에서 `release version 21 not supported`로 중단되어 로컬 백엔드 테스트는 통과로 간주하지 않는다. Java 21 GitHub CI에서 백엔드·실제 세션·PostgreSQL·실데이터 검증이 통과해야 병합한다.
- iPhone WebKit과 실제 PostgreSQL·수집 API 검증도 GitHub CI에서 확인할 예정이다. 로컬 Chromium 결과를 해당 환경의 결과로 대체하지 않는다.
- 이 기록 시점에는 변경 사항의 CI·운영 배포가 아직 완료되지 않았다. 결과 확인 후 아래에 후속 기록을 추가한다.
- 운영 회원 데이터 변경, 실제 기기 Safari 수동 검사, 공급기관 원본 데이터의 전수 정확성 검증은 이번 범위에서 수행하지 않는다.

### CI·병합 후속 기록

- [PR #125](https://github.com/enrjsj/cheongyak-one/pull/125), 기능 커밋 `f73d1ddf8e806b25e525c133764c1f964c985f7f`, main 병합 `43aafbeb4ec89a92bbf031ff7d9d79b359361fa0`.
- [CI #303](https://github.com/enrjsj/cheongyak-one/actions/runs/37581480531)의 7개 작업 모두 성공한 뒤 병합했다. Chromium 전체 220개, iPhone WebKit 36개, 실제 API 로그인 세션 2개 통과. 프런트 단위 테스트 141개도 통과했다.
- backend 작업은 157개 중 일반 테스트 150개 통과·PostgreSQL 전용 7개 건너뜀. 별도 postgres 작업에서 해당 7개가 모두 통과했다. 전체 합산에서 이를 미실행 테스트로 숨기거나 중복 집계하지 않는다.
- real-data 작업은 실제 수집·목록·상세 API와 추가한 공급기관 일치 검사까지 성공했다. infrastructure도 성공했다. 로컬 백엔드 컴파일 제한을 CI의 Java 21 검증으로 보완했다.

### 병합 후 하네스 보완

- main CI #305에서 iPhone 13 에뮬레이션을 1440px로 늘린 공급기관 테스트가 닫기 버튼 안정성 대기 중 두 번 시간 초과됐다. PR CI에서는 통과했으므로 최초 통과만으로 검증 완료를 선언하지 않았다.
- 실패 로그와 Playwright trace를 확인했다. 문제 상황은 DPR 3의 4320×2700 화면으로, 마지막 프레임에 상세 배경만 보이고 닫기 버튼 클릭의 안정성 대기가 끝나지 않았다. 앱 일반 동작 결함인지 WebKit 에뮬레이션 한계인지는 확정하지 않는다.
- iPhone 프로젝트는 320/390px 실제 모바일 범위에서 터치로 검사하고, 1440px는 데스크톱 프로젝트에서 계속 검사하도록 테스트 조건을 정리했다. 상세 닫힘과 원래 버튼의 초점 복원도 명시적으로 검증한다. 강제 클릭이나 실패 무시는 사용하지 않는다.
- 보완 후 로컬 Chromium의 320/390/1440px 테스트를 각각 3회 반복해 9회 모두 통과했다. iPhone 재검증 결과는 후속 CI에서 확인한다.


### 최신 하네스·운영 확인 (15:43 KST)

- 작업 중 PR #126이 main에 병합되어 AGENTS.md와 docs/PROJECT_CONTEXT.md, docs/HANDOFF.md, docs/HARNESS.md를 새로 읽었다. 첫 점검 때 파일이 없었다는 기록은 당시 상태이며, 현재는 세 문서가 존재한다. PR #126 변경을 모두 보존하고 인계·맥락의 기준 경로를 docs 아래로 통합했다.
- `node scripts/harness.mjs plan --base 3b6540e1f7c36f78144946f2116cbae42f0f4a17`에서 full과 API·CI 리뷰 필요 항목을 확인했다. nullable API 추가의 목록·상세·구버전 호환 및 CI의 실데이터 jq 비교를 별도로 검토했다. 인증·CSRF·DB migration 변경은 없다.
- `node scripts/harness.mjs verify --base 3b6540e1f7c36f78144946f2116cbae42f0f4a17 --scope full --extended`: 하네스 자체 14개와 npm test(빌드·단위 141개) 통과, 전체는 **blocked**. 기본 PATH에 Maven이 없고 하네스가 사용하는 표준 Playwright Chromium/WebKit 설치 경로가 없어 브라우저·백엔드·실제 인증 단계는 실행되지 않았다. 앞서 별도 시스템 Chromium과 Maven 경로로 실행한 결과 및 CI 결과와 구분한다.
- 하네스 증거: `.harness/reports/2026-10-07T06-42-48-019Z-35435/report.json`. 검사 중 작업 파일 변경 없음, 규칙 위반 없음. 이 보고서는 로컬 증거로 Git에서 제외된다.
- 운영 통합 리비전 `60fda31781ff37429bc8fac3786412e267477a2d`에서 웹·API·프록시 버전 일치 및 응답 7개 통과. `/tmp/supplier-integrated-deployment.json`에 기록했다. 그 이전 커밋만 기다리던 검사는 다른 작업의 배포로 대상이 바뀌어 최신 리비전으로 다시 실행했다.
- 실제 운영 Playwright 검증: 1440/390px 각각 9개 공고의 목록 응답과 첫 화면 공급기관이 모두 일치했다. 최초 상세 API 요청 0회, 가로 넘침 없음, 브라우저 오류·운영 쓰기 요청 없음. 예: 공고 9956 `(주)아뜨네`, 7452 `한국토지주택공사 인천지역본부`.
- 운영 검사 스크립트가 다음 페이지의 빈 미리 읽기 응답을 첫 목록으로 잡는 문제가 있어 page=0으로 수집 대상을 바로잡은 후 통과했다. 서비스 응답은 수정하지 않았으며, 화면 검증은 GET 요청을 시스템 프록시를 통해 전달한 실제 응답으로 수행했다.
- 증거: `/tmp/supplier-production-result.json`, `/workspace/ui-redesign-preview/production-supplier-1440.png`, `production-supplier-390.png` (실행 환경 임시/로컬 파일).
- Render 관리 도구는 선택된 workspace가 없어 관리 측 배포 로그를 확인하지 못했다. 공개 revision·health·실제 응답으로 배포를 검증했다. iPhone 1440px 에뮬레이션의 내부 정지 원인과 실제 기기 Safari는 여전히 **미검증**이다.
- 이 시점의 모바일 하네스 보완 및 문서 통합은 PR #127에서 후속 검증 대상으로 남아 있었다. 최종 결과는 문서 상단을 참고한다. 애플리케이션 동작 코드는 운영 확인한 리비전과 동일하다.

### 간헐 실패 추가 분석

- 통합 CI #308의 iPhone 결과는 단순한 35개 최초 통과가 아니라 **34개 통과·1개 재시도 통과(flaky)**였다. 320px에서도 관찰되어 화면 크기만으로 원인을 설명할 수 없었다.
- 두 번째 trace를 분석한 결과 세 번째 공고까지 닫기·초점 복원·기관명 검사가 성공했고, 마지막 문서 너비 evaluate 중 테스트 전체 30초 제한에 도달했다. 한 테스트에 세 차례 모바일 상세 열기·닫기를 몰아 넣은 구조를 개선했다.
- 긴 기관명/null/공백을 각각 독립 테스트로 분리했다. 첫 표시·추가 요청 0회·상세 이후 값 유지·터치·닫힘·초점·가로 넘침의 검증은 모두 유지한다. 제한 시간 증가, 강제 클릭, 재시도 횟수 변경은 없다. PC는 3개 너비 × 3개 값, iPhone은 2개 너비 × 3개 값을 검사한다.
- 독립화한 로컬 Chromium 9개 시나리오를 3회 반복해 **27개 모두 통과**했다 (`/tmp/supplier-isolated.log`).

---

## 이전 하네스 도입 기록 (PR #126)

# 개발 인수인계

## 현재 작업

- 날짜: 2026-10-07
- 구현 기준: main `0bc8b95c200704941f84d24c7583b6f87860c7b8` (PR #123)
- 원격 반영 기준: `3b6540e1f7c36f78144946f2116cbae42f0f4a17` (PR #124). 추가된 카드 클릭 개선은 변경 파일이 겹치지 않아 그대로 보존한다.
- 목표: 기존 서비스 코드를 유지하면서 Codex 개발 하네스 적용.
- 범위: 작업 규칙/맥락/검증 스크립트/자체 테스트/CI 검사/사용법.
- 상태: 로컬 구현 완료 후 사용자 요청으로 GitHub PR/CI 반영 단계 진행. 아래 로컬 검증 한계와 원격 CI 결과는 구분한다. 최종 병합 상태는 해당 PR에서 확인한다.

## 변경 사항

- AGENTS.md와 PROJECT_CONTEXT, DECISIONS, 작업 템플릿, HARNESS 사용법 추가.
- doctor/plan/check/verify 단일 명령과 Git 기준·변경 지문·증거 보고서 추가.
- 기존 npm/Playwright/Maven 명령 재사용. 환경변수 필터·migration 보호·고확신 비밀 패턴 검사.
- 기존 CI에 하네스 자체 테스트와 규칙 검사 추가; 기존 앱 테스트 유지.
- UI/업무 로직/DB schema/운영 환경변수/배포 설정 변경 없음.

## 검증

- 하네스 자체 회귀 테스트 14개 통과(범위 선택, 환경 분리, migration, 비밀 패턴, 실제 CLI 실행·증거·차단 상태).
- `node scripts/harness.mjs verify --scope full`: 자체 테스트와 프런트 검증 통과, 전체 결과는 blocked(종료 코드 2).
- 기존 프런트 `npm test`: TypeScript/Vite 빌드 및 단위 테스트 141개 통과.
- Java 17/Maven 미설치: Java 21/Maven 3.9+가 필요한 백엔드 테스트 미실행.
- Chromium 설치 시 다운로드 ZIP 오류: 브라우저 E2E 미실행. 실제 인증/iPhone/PostgreSQL/운영 환경도 미검증.
- 규칙 검사 통과. 증거는 `.harness/reports/<실행ID>/report.json`에 생성되며 Git에는 포함하지 않는다.
- 이 기록 작성 시점의 로컬 검증 이후 원격 PR CI로 브라우저·백엔드 등을 확인한다. 기존 커밋의 CI 통과를 이번 변경의 통과로 인용하지 않는다.
- CI YAML 구문 파싱과 `git diff --check` 통과.

## 다음 작업

1. 새 환경에서는 `node scripts/harness.mjs doctor`로 도구를 확인한다.
2. JDK/Maven/Playwright를 준비하고 `verify --scope full --extended` 실행. PostgreSQL은 별도 격리 환경/기존 CI로 검증한다.
3. 이번 반영은 사용자가 승인했다. CI 통과 확인 후 병합하며, 이후 신규 작업은 별도 요청 전 로컬 검증까지만 진행한다. main push는 기존 자동배포를 유발할 수 있다.

## 유지할 제한

- 운영 DB 쓰기·실제 동기화·외부 알림/AI 호출은 이 작업에 포함하지 않는다.
- AWS 리소스 생성·배포 금지. Render sleep 대응 변경도 별도 요청 전 제외.
- 기존 다른 작업공간의 사용자 변경을 보존하고, 여러 채팅은 worktree로 분리한다.
