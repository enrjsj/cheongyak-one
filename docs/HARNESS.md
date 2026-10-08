# 청약한눈 개발 하네스 사용법

## 1. 무엇을 적용했나

이 프로젝트에서 하네스는 **AI 개발자가 작업 맥락과 권한을 확인하고, 변경에 맞는 검증을 실행하고, 증거를 남기는 개발 운영 장치**다. 상담용 AI를 서비스에 붙이거나 별도 에이전트 서버를 만드는 작업이 아니다.

작업 순서는 `맥락 확인 → 작은 변경·관련 테스트 → 수정·기록 묶음 → 최종 전체 검증 → 승인된 원격 반영·CI·배포 확인`이다. AGENTS.md는 행동 지침, scripts/harness.mjs는 실제 실행 가능한 검증 진입점이다. 둘을 구분한다. 문서만으로 권한이 강제되거나 임의의 코드가 안전해지는 것은 아니다.

기존 React/Vite, Spring Boot, PostgreSQL, 배치, CI 테스트를 그대로 사용한다. 신규 npm 패키지나 OpenAI API 키 없이 Node 기본 모듈로 실행한다. 하네스 자체의 외부 AI 과금은 없지만 Codex 사용 및 GitHub Actions 실행에는 각각 계정의 기존 사용량 정책이 적용된다. 유료 리소스를 만들지 않는다.

| 파일 | 담당 |
| --- | --- |
| `AGENTS.md` | Codex 시작 규칙, 검증·보고·권한 경계 |
| `docs/PROJECT_CONTEXT.md` | 현재 구조와 관련 문서 찾기 |
| `docs/DECISIONS.md` | 설계 선택과 이유 |
| `docs/HANDOFF.md` | 최근 결과, 미검증, 다음 작업 |
| `docs/tasks/TEMPLATE.md` | 작업별 범위·완료 기준·결과 양식 |
| `scripts/harness.mjs` | doctor / plan / check / verify 명령 |
| `scripts/harness/lib.mjs` | 변경 감지, 테스트 선택, 보호 규칙 |
| `scripts/harness/harness.test.mjs` | 하네스 자체 회귀 테스트 |
| `.github/workflows/ci.yml` | 기존 CI에 하네스 자체 테스트·규칙 검사 추가 |

## 2. 최초 준비

저장소 루트에서 실행한다. Windows PowerShell, macOS, Linux에서 명령은 같다.

- Git, Node **22.12 이상**(기존 CI는 Node 22)을 준비한다.
- 백엔드/실제 인증 검증은 **JDK 21, Maven 3.9 이상**이 필요하다.
- Chromium 브라우저 테스트는 Playwright 브라우저 파일과 OS 라이브러리가 필요하다.
- `.env.local` 등 개인 환경 파일이 없는 별도 체크아웃/worktree를 권장한다. 테스트가 Vite의 개인 운영 설정을 읽지 않도록 하네스는 `.env.example`을 제외한 `frontend/.env*`가 있으면 프런트 실행을 차단한다. 개인 파일을 삭제하지 않는다.

```bash
node scripts/harness.mjs doctor
npm ci --prefix frontend
cd frontend
npx playwright install chromium
cd ..
node scripts/harness.mjs doctor
```

iPhone/실제 인증까지 검사하려면 `frontend`에서 `npx playwright install webkit`도 실행한다. Linux에서 시스템 라이브러리가 부족하면 해당 개발 환경의 권한을 확인한 뒤 Playwright의 `install --with-deps`를 사용한다. 설치는 네트워크가 필요하며 하네스가 임의로 설치하거나 권한을 승격하지 않는다.

`doctor`는 확장 검사에 필요한 WebKit까지 포함해 부족한 도구를 표시하고 종료 코드 2를 반환한다. Java가 없어도 프런트 범위 검증은 가능하고, 기본 Chromium 검사에는 WebKit이 필요하지 않다. 설치 뒤 다시 검사한다. 운영 DB 주소와 공공데이터 API 키는 이 로컬 검증에 필요하지 않다.

## 3. 일상 개발 명령

**수정 중에는 관련 테스트만 실행하고, 변경을 모은 뒤 전체 검증을 진행한다.** 아래 두 단계를 구분한다. 현재 하네스의 `frontend` 범위도 Chromium 전체를 실행하므로 수정 중의 좁은 검사로 사용하지 않는다. 새 하네스 옵션이나 CI 실행 조건을 추가한 것은 아니다.

### 개발 중: 변경에 직접 관련된 검사

테스트 파일·이름·클래스로 범위를 좁힌다. 아래 예시는 모두 저장소 루트 기준이며 실제 변경 대상에 맞춰 고른다. 하네스 밖에서 실행하는 명령은 하네스의 환경변수 필터를 적용하지 않으므로, 2절의 비밀값·운영 환경 파일 없는 테스트 작업공간과 로컬/모의 API를 사용한다. Playwright 의존성과 브라우저는 미리 준비한다.

```bash
# 금액/면적 필터 계산의 관련 단위 테스트만 (빌드·전체 npm test 아님)
node --experimental-strip-types --test frontend/tests/range-filter.test.mjs

# 필터 관련 Chromium 시나리오만
npm --prefix frontend run test:e2e -- e2e/resilience.spec.ts --project=chromium --grep "범위 필터"

# 접근성 수정 시 해당 파일만
npm --prefix frontend run test:e2e -- e2e/accessibility.spec.ts --project=chromium

# 공고 조회 서비스의 관련 백엔드 테스트 클래스만
mvn -B -pl backend -Dtest=NoticeQueryServiceTest test
```

iPhone에서만 실패한 문제는 `IPHONE_TEST=1`을 설정한 테스트 프로세스에서 해당 파일/시나리오와 `--project=iphone-webkit`을 지정한다. 이 환경변수 없이 프로젝트 이름만 지정하면 iPhone 프로젝트가 활성화되지 않는다. 모바일 문제를 Chromium 통과만으로 해결됐다고 표시하지 않는다. 좁힌 검사에서 실제 대상이 1개 이상 실행됐는지도 확인한다.

### 변경 묶음 완료: 통합본을 고정하고 최종 검증

HANDOFF 등 예상 가능한 기록을 먼저 정리하고 검증 중 파일을 수정하지 않는다. 단일/멀티 작업 모두 총괄이 통합한 결과에서 다음 검증을 수행한다.

| 변경 묶음 | 최종 검증 기준 |
| --- | --- |
| 설명·작업 지침 등 Markdown만 변경 | docs 범위의 규칙 검사·하네스 자체 테스트. 앱 전체 로컬 검사는 반복하지 않음 |
| 앱 로직·UI·공통 실행 설정 변경 | `--scope full`로 프런트 빌드·단위·전체 Chromium·백엔드 H2 검사 |
| UI/모바일 또는 인증·세션·CSRF 변경 | 위 검사에 iPhone/실제 인증 추가: `--scope full --extended` |
| DB schema·migration·PostgreSQL 전용 쿼리 변경 | 위 관련 검사에 격리 PostgreSQL 또는 기존 CI postgres 검사 추가 |

환경 제약으로 최종 로컬 검증을 실행할 수 없으면 차단 사유와 미검증 범위를 남기고, 원격 반영이 승인된 경우 최종 PR head의 해당 CI 결과로 확인한다. 로컬 실행 성공으로 바꾸어 기록하지 않는다. 같은 코드의 전체 로컬 검사를 이미 완료했다면 push 직전에 이유 없이 재실행하지 않는다. 기존 필수 CI는 그대로 확인한다.

```bash
# Git 변경 파일, 자동 선택 범위, 실행 예정 명령만 확인
node scripts/harness.mjs plan

# 필수 문서/변경 규칙 검사만 실행 (앱 테스트 아님)
node scripts/harness.mjs check

# 문서만 바꾼 작업의 최종 검사
node scripts/harness.mjs verify --base <작업시작전_SHA> --scope docs

# 변경 묶음의 범위를 자동 선택해 검증 (앱 전체 검사와 범위를 구분)
node scripts/harness.mjs verify

# 앱 변경 묶음의 최종 기본 회귀 전체 실행
node scripts/harness.mjs verify --base <작업시작전_SHA> --scope full

# UI/모바일·인증 변경 묶음: 실제 로컬 Spring 인증 + iPhone까지 추가
node scripts/harness.mjs verify --base <작업시작전_SHA> --scope full --extended
```

| 범위 | 실행 내용 |
| --- | --- |
| docs | 하네스 자체 테스트 |
| frontend | 자체 테스트 + 기존 `npm test`(TypeScript/Vite 빌드 포함) + Chromium E2E |
| backend | 자체 테스트 + `mvn -B -pl backend test`(기본 H2) |
| full | frontend와 backend를 모두 실행 |
| `--extended` | 위 범위에 iPhone WebKit, 백엔드 JAR 빌드, 실제 로컬 Spring 인증 브라우저 테스트 추가 |

Markdown/하네스 코드만 바뀌면 docs, 프런트 또는 백엔드만 바뀌면 해당 영역을 선택한다. 루트 빌드·CI·모르는 공통 설정 파일 변경은 보수적으로 full을 선택한다. `--scope frontend` 등으로 범위를 명시할 수 있지만, 그 결과가 전체 프로젝트 통과를 뜻하지는 않는다. 다른 영역 미검증이 보고서에 남는다.

실패 시 전체 검사를 바로 반복하지 말고 실패한 파일·시나리오·클래스와 필요한 로그부터 확인한다. 재시도 통과는 최초 통과와 구분하며 시간 제한·assertion·재시도 횟수를 느슨하게 만들어 통과시키지 않는다. 원인 확인에 필요한 경우에만 범위를 넓히고, 후속 수정이 모이면 영향을 받는 통합 검사를 수행한다. 새 앱 코드에 이전 결과를 적용하지 않는다.

최종 검증 이후 결과 기록 Markdown만 수정했다면 앱·테스트·빌드 설정이 그대로인지 diff로 확인하고 docs 검사만 추가한다. 앱 검증의 원래 SHA/범위와 문서 추가 검증을 구분해 기록한다. 이는 필수 CI를 건너뛰는 규칙이 아니다.

### 커밋이 이미 있는 경우

기본 비교 기준 `HEAD`는 현재 작업 트리의 staged/unstaged/untracked 변경을 포함한다. 이미 커밋한 작업까지 확인하려면 작업 시작 전 기준 커밋을 지정한다.

```bash
node scripts/harness.mjs plan --base <작업시작전_SHA>
node scripts/harness.mjs verify --base <작업시작전_SHA> --scope full
```

`<...>`는 실제 값으로 교체한다. 해당 커밋은 로컬 Git에 있어야 한다. 하네스는 자동 fetch/pull/commit/push를 하지 않는다. 변경이 없는 작업 트리의 기본 auto 결과는 docs이므로, 정기 회귀 검증 의도라면 `--scope full`을 지정한다.

## 4. 결과를 읽는 법

실행 결과는 Git에서 제외된 `.harness/reports/<실행ID>/`에 저장된다.

- `report.json`: 기준 SHA, 변경 경로·지문, 선택 범위, 단계별 상태/시간, 추가 리뷰와 미검증 항목.
- `<단계>.log`: 상세 로컬 실행 로그. 실패 원인을 볼 때만 열고 비밀값/개인정보 확인 없이 외부 공유하지 않는다.
- 시작 시 `running` 보고서를 먼저 쓴다. 강제 중단된 작업을 성공으로 취급하지 않는다.
- 실행 도중 검증 대상 파일이 달라지면 실패로 표시한다. 여러 채팅이 같은 폴더를 동시에 수정하지 않는다.

| 종료 코드 | 의미 | 다음 조치 |
| --- | --- | --- |
| 0 | **선택한** 검사 범위 통과 | 미검증·리뷰 필요 항목도 확인 |
| 1 | 규칙/테스트 실패 또는 실행 중 코드 변경 | 로그로 원인을 찾아 수정 후 재검증 |
| 2 | 도구·의존성 부족, 실행 준비 미완료 등 | 환경을 준비한 후 다시 실행 |

브라우저 미설치 등 테스트 도구 내부에서 발생한 문제는 실패(1)로 표시될 수도 있다. 정확한 원인은 로그를 확인한다. `check` 성공은 단위 테스트/브라우저/운영 검증 성공이 아니다.

명령별 제한은 15분이며, 중단 시 별도로 떠 있는 로컬 테스트 서버 프로세스가 남았는지 확인한다. 같은 오류를 코드·환경 변경 없이 반복 실행하지 않는다.

## 5. 실제 청약 기능에 적용하는 예

### 초기 필터 문제를 수정할 때

1. PROJECT_CONTEXT와 기존 frontend-architecture 문서를 읽고 저장 프로필/초기 필터 경로를 확인한다.
2. 완료 기준을 명시한다: 비로그인 초기 조건, 로그인 기본 프로필 의도, URL 조건 우선순위, 새로고침 후 결과.
3. 재현 테스트를 추가한 뒤 관련 상태 관리 부분만 수정한다.
4. 수정 중에는 관련 단위 테스트와 필터 Playwright 시나리오만 실행한다. iPhone 문제는 해당 iPhone 시나리오도 확인한다.
5. 필터·문구·기록 변경을 모으고 파일을 고정한 뒤 UI 변경 묶음의 `verify --base <기준SHA> --scope full --extended`를 한 차례 실행한다. 실패하면 원인별 좁은 검사로 수정한 뒤 필요한 최종 검증을 한다.
6. HANDOFF에 재현 조건, 검사 대상·결과, 실제 운영에서 미확인한 부분을 쓴다. 결과 기록만 추가하면 코드 동일성을 확인하고 docs 검사를 수행한다.

### 주택형·분양가를 수정할 때

- 0원과 가격 정보 없음, ㎡와 평, 공급 수량과 면적을 혼동하지 않는 완료 기준을 둔다.
- 외부 API 응답은 고정 fixture로 재현하고 매번 운영 동기화를 호출하지 않는다.
- 새 DB 컬럼은 새 Flyway 파일로 추가한다. 기존 적용 migration 수정은 하네스가 거부한다.
- full은 H2 기반 검사다. PostgreSQL migration 호환성은 기존 CI의 postgres 작업 또는 **별도로 승인된 격리 테스트 DB**에서 추가 검증한다.

## 6. Codex에 요청하는 방법

새 세션은 이 저장소를 작업 폴더로 열고 다음처럼 요청한다.

> AGENTS.md와 docs/PROJECT_CONTEXT.md, docs/HANDOFF.md를 읽고 현재 상태부터 확인해줘.
> 이번 목표는 [기능]이야. 완료 기준은 [조건]이고 [제외 항목]은 건드리지 마.
> 수정 중에는 관련 테스트만 실행하고, 변경과 기록을 모은 뒤 하네스로 최종 전체 검증해줘.
> 실패 원인을 수정한 뒤 결과와 미검증 사항을 HANDOFF에 남겨줘.
> 커밋·푸시·배포·운영 데이터 변경은 하지 마.

Codex는 프로젝트의 AGENTS.md 지침을 시작 시 읽는 구조다. 다른 제품에서는 해당 제품의 프로젝트 지침 방식에 맞춰 참조해야 한다. AGENTS.md를 바꾼 후 이미 실행 중인 에이전트에 적용됐다고 가정하지 말고 새 작업에서 읽었는지 확인한다.

단일·멀티 선택은 AGENTS.md의 **auto** 정책을 따른다. Codex가 작업의 독립성을 보고 필요한 경우 서브에이전트 도구로 위임한다. 역할 설정·격리·통합 절차는 [멀티 에이전트 가이드](MULTI_AGENT.md)에 있다. `harness.mjs` 자체는 테스트 실행기이며 에이전트를 생성하지 않는다.

여러 채팅 또는 쓰기 에이전트는 각각 Git worktree와 소유 경로로 격리한다. 공유 문서·API 계약·최종 통합은 총괄 한 명이 담당하며, 기본 포트를 공유하는 E2E/인증 테스트는 직렬 실행한다.

## 7. CI와 배포 경계

추가한 CI harness 작업은 자체 테스트와 변경 규칙 검사만 수행한다. 기존 frontend, iphone, auth-browsers, backend, postgres 등 앱 검증 작업을 대체하거나 중복 실행하지 않는다. PR은 base SHA, main push는 이전 SHA를 비교하며, 수동 실행에서 기준이 없으면 HEAD를 사용한다.

업로드 대상은 요약 `report.json`만이며 로컬 원문 로그는 올리지 않는다. 운영 API/메일/AI 호출을 새로 추가하지 않았다. GitHub에 반영하기 전에는 추가한 CI 작업도 실행되지 않는다.

**main push는 기존 Vercel/Render 자동배포를 유발할 수 있다.** 하네스는 이를 실행하지 않으며, 커밋/푸시/PR/병합/배포는 사용자의 별도 요청 이후에 수행한다. GitHub Actions의 브랜치 보호 필수 검사 지정도 이 변경만으로 자동 설정되지 않는다.

원격 반영이 승인된 뒤에도 수정·기록을 한 묶음으로 commit/push하고 최종 PR head의 CI 통과를 확인한 뒤 병합한다. 진행 보고·로그 기록만을 위해 커밋이나 수동 CI/배포를 반복하지 않는다. PR과 main에서 자동으로 실행되는 기존 CI는 유지되며, 이 Markdown 지침 변경만으로 CI 횟수나 실행 시간이 자동 감소하지는 않는다. 배포 완료는 해당 main SHA의 실제 배포 확인 결과로 보고한다.

## 8. 보호 장치와 한계

- 검증 자식 프로세스에는 도구 경로 등 허용된 환경변수만 전달하고 DB/API 키/메일 설정 등은 제외한다.
- 기본 Vite 프록시는 사용하지 않는 로컬 포트로 향한다. 실제 인증 E2E는 기존 전용 설정이 로컬 H2 백엔드로 연결한다.
- 새 변경에서 개인키/일부 토큰/비밀번호 포함 DB URL 패턴을 탐지한다. 의심 값은 출력하지 않는다.
- `.env` 및 빌드 산출물 추적, 기존 migration 변경·중복 버전, 필수 문서 누락을 검사한다.
- 이것은 **완전한 비밀 탐지기나 네트워크/프로세스 샌드박스가 아니다.** 과거 Git 이력, 모든 API 키 형식, 하드코딩된 외부 호출, 사용자 도구 설정까지 차단하지 않는다. 기존 실제 승인·네트워크 정책과 코드 리뷰가 계속 필요하다.
- PostgreSQL, 운영 배포 상태, 실제 외부 API 연동을 로컬 테스트 통과만으로 정상이라고 주장하지 않는다.
- AGENTS/CONTEXT는 짧게 유지하고 상세 내용은 영역별 문서에 둔다. HANDOFF는 현재 결과로 갱신하며 불필요한 과거 로그를 쌓지 않는다.

## 9. 다른 PC/Codex 작업공간으로 옮기기

GitHub main에 반영된 후에는 **적용할 저장소 루트**에서 `git status --short`로 개인 변경을 확인하고 `git pull --ff-only`로 받는다. 작업 중인 변경이나 분기된 이력이 있으면 강제 reset 없이 별도로 병합한다.

원격 반영 전 제공된 `cheongyak-harness.patch`를 사용하는 경우에는 아래 절차로 적용 가능 여부를 먼저 검사한다. 이 패치의 최초 구현 기준은 `0bc8b95c200704941f84d24c7583b6f87860c7b8`이다. main에서 이미 받은 뒤에는 같은 패치를 다시 적용하지 않는다.

Windows 예시(다운로드 경로는 본인 PC에 맞게 변경):

```powershell
git status --short
git apply --check "C:\Users\PC\Downloads\cheongyak-harness.patch"
git apply "C:\Users\PC\Downloads\cheongyak-harness.patch"
git diff --stat
node scripts/harness.mjs doctor
```

`--check`가 실패하면 강제 적용/덮어쓰기를 하지 않는다. 최신 파일 또는 기존 AGENTS와 겹칠 수 있으므로 Codex에 충돌 부분만 병합하도록 요청한다. 패치 적용은 커밋이 아니며 사용자 PC 도구 설치까지 대신하지 않는다. 이후 2~3절의 준비와 검증을 실행한다.

공식 참고: [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
