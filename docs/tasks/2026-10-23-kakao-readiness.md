# 카카오 수신 조건 확인·연결 안내

- 기준: main `2437ab63ecb42db8f271282d19af191b66f84671`, 10월21일 미커밋 카카오 구현 보존. 시작 시 이전 최종 manifest 434파일 전부 동일함을 확인했다.
- 목표: 연결 상태만으로 자동 발송을 기대하지 않도록 저장된 지원 일정과 필요한 사용 절차를 보여준다.
- 범위: KakaoSelfSettings, NotificationsDialog, 관련 CSS/Playwright. API·DB·운영 설정은 이번 후속 작업에서 변경하지 않는다.
- 완료 기준: 저장 성공 전 초안을 적용 설정으로 표시하지 않음, 조회 실패 시 기본값을 실제 상태로 표시하지 않음, 전체 일정 비활성 안내, 설정으로 초점 이동, PC/모바일 도움말.
- 위험: 기존 미커밋 묶음에는 인증/API/V39 변경이 포함됨. 실제 OAuth·외부 메시지는 실행하지 않는다.

## 분업

AGENTS auto 규칙에 따라 총괄이 구현·문서·직렬 테스트를 담당하고 기본 서브에이전트 `kakao_current_review`에 읽기 전용 기존 인증/발송 및 최종 UI 검토를 위임했다. 역할 TOML의 네이티브 실행으로 간주하지 않는다. 공유 소스 읽기만 허용하며 별도 쓰기 작업자는 없다.

## 구현

- 카카오 지원 대상 접수 시작·마감 7/3/1일 전을 저장된 `savedPreference`로 표시한다. 별도 API 호출·파생 상태 effect를 추가하지 않는다.
- 저장 실패/미저장 상태에서는 마지막 저장 설정 유지, 설정 조회 실패는 미확인 상태다.
- 전체 지원 일정이 꺼지면 자동 발송하지 않는다는 안내를 제공하되 시험 메시지는 허용한다. 당첨/신규 매칭/정보 변경과 이메일/푸시 스위치를 카카오 조건으로 오해하지 않도록 구분했다.
- 수신 일정 설정 버튼은 기존 첫 일정 체크박스에 초점을 이동한다. 기본 체크를 바꾸거나 자동 저장하지 않는다.
- native details/summary로 로그인·동의·관심 공고·시험 수신 절차와 연결 후 당일 생성 조건, 접수/기기 수신 차이를 안내한다.
- React best-practices 스킬의 파생값 직접 계산·기존 조회 재사용·타입·키보드 접근성 지침을 적용했다.

## 검증

- `node scripts/harness.mjs plan --base 2437ab6`: full, 인증/API·V39 별도 리뷰/검증 필요.
- 실행 환경: Java21/Maven3.9/Node24/시스템 Chromium. 샌드박스 doctor의 프로세스 실패는 승인된 로컬 도구 확인으로 재확인. 표준 Playwright Chromium/WebKit은 미설치.
- Maven은 기존 캐시와 `/tmp/oct23-tools/mvn` 오프라인 래퍼를 사용한다.
- 개발 중 TypeScript 및 신규 PC/모바일 8시나리오: 8개 최초 통과. 리뷰 권고에 따라 조회 실패 검사는 오류 문구 표시까지 기다리도록 강화했다.
- 최종 `PATH=/tmp/oct23-tools:$PATH node scripts/harness.mjs verify --base 2437ab6 --scope full --extended`: 하네스14·프런트 빌드/단위182·백엔드190실행·인증JAR빌드 통과. PostgreSQL10 제외, 표준 Chromium/WebKit 부재로 전체 상태 **blocked**. 보고서 `.harness/reports/2026-10-23T01-13-39-870Z-1436/report.json`, 작업 지문 `c04f1aeb8f5e4e87d0fd3123239464e07bb369865dc94a51f4f7b8e278e88cb9`. 실행 도중 소스 변경 없음.
- 보조 검증: `./frontend/node_modules/.bin/playwright test --config .harness/oct23-kakao/playwright.config.mts kakao-self-resilience.spec.ts notification-draft-resilience.spec.ts`. 시스템 Chromium PC/모바일 합계33개 중 **32최초 통과/1실패**(3분46초). 신규 안내8개와 기존 알림 초안5개 통과. 실패는 기존 PC 시험 발송401 시나리오의 **page fixture/newPage 생성 30초 초과**, 테스트 본문/앱 진입 전 발생. trace: `.harness/oct23-kakao/browser/` 아래 실패 시나리오의 `trace.zip` 및 `error-context.md`. 프로세스 지연의 근본 원인은 확정하지 못했다.
- 실패 진단 후 새 브라우저 프로세스에서 해당1개만 `--config .harness/oct23-kakao/isolated.config.mts --project system-chromium --grep '시험 발송 권한이 만료'`로 확인: **1통과**(8.4초). 앱·assertion·timeout·retries 변경 없음. 최초 실패를 지우거나 전체 최초 통과로 해석하지 않는다. `.harness/oct23-kakao/browser.json`, `isolated.json`에 각각 보존했다.
- 코드 고정 manifest: `.harness/oct23-kakao/frozen-source.json`, 434파일 canonical sorted JSON SHA256 `d1ff215708a84dd857ca26e626264df5302d85766b00ab2e902b95f5ff590794`. 앱/테스트는 전체 하네스 이후 동일하다.
- 실제 로컬 Java 세션·CSRF·재조회·새 탭·로그아웃 브라우저 **1통과**, `./frontend/node_modules/.bin/playwright test --config .harness/oct23-kakao/auth.config.mts`. 증거 `.harness/oct23-kakao/auth.json`, `auth.log`. Kakao 비활성 상태의 로컬 인증 검증이며 실제 Kakao OAuth 성공을 뜻하지 않는다.
- 결과 기록 후 소스434파일 동일성을 다시 확인하고 docs 하네스만 실행한다. 최종 문서 보고서 경로는 `.harness/oct23-kakao/supplemental.json`에 보존한다.

## 인수인계

- 실제 카카오 OAuth/수신·운영 콜백 쿠키·PostgreSQL·표준 전체 Chromium/iPhone은 별도 미검증이다.
- 다음 단계는 키·콜백·동의 항목 준비 후 허가된 실제 연동 검증이며, 지도/지오코딩은 현재 코드에 없는 별도 후속 개발이다.
- 커밋·푸시·배포·운영 데이터 쓰기·실제 외부 메시지 발송 미실행.
