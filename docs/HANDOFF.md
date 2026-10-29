# 작업 인계

## 주간 API 기동 유지 (2026-10-29, 로컬 구현)

- 매일 KST08:53·08:58 예열,09:03~17:58 5분 간격으로 GitHub Actions가 고정 공개 health GET. 실제 시각08:50~18:00 외에는 지연/수동실행도skip, 종료경계의 진행 중 요청 취소, 최대4분 제한. 기본 main만/읽기 권한/Secret 없음. 앱·DB·카카오·기존 수집 예약 변경 없음.
- 총괄 구현, 별도 읽기 리뷰 차단 이슈 없음. 최종 관련9개/YAML 검사·하네스14·프런트 빌드/단위191·백엔드200실행 통과(PG10제외), 표준 Chromium 부재로 하네스 전체blocked. 새3파일 지문 고정. 실제 health 스크립트1회200/UP(11:30:44 KST,720ms). 보고서 `.harness/reports/2026-10-29T02-30-00-350Z-2127/report.json`.
- GitHub 일정 지연·누락 및 무료 사용량 때문에 상시 가동 보장 아님.18시 이후는 호출 중단이며 강제 서버 종료 아님. 실제 GitHub 예약 및 하루 가동 지속 미검증. 원격 반영 전이므로 아직 자동 실행되지 않는다.
- 상세: `docs/tasks/2026-10-29-daytime-warmup.md`. 앞선 장애 점검 기록 보존. 기존 사용자 원격 반영 요청에 따라 최종 head CI 통과 후 main 예약 활성화하며, 최종 결과는 PR/`.harness/oct29-warmup/`에 보존한다. 상태 기록만을 위한 추가 커밋/CI는 하지 않는다.

## 공고 조회 장애 점검 (2026-10-29, 읽기 전용 운영 확인)

- 기준 main `9ade364`. 사용자 오류 신고 후 웹200/동일 revision, API health·release25초 및 직접/프록시 공고45초 timeout 재현. Render `cheongyak-one` workspace는 사용자 확인 후 조회했다. 운영 재시작·배포·설정·데이터 변경 없음.
- 운영 배포 `dep-dbdi1lol0d7c739ca8fg` live(10월23일 수동 배포, 동일 SHA), free 요금제. 10월29일10:38:53 KST 새 인스턴스 시작,10:41:44 기동 완료(앱179.301초/프로세스190.894초). 조회한10:00 이후 error 로그0. V39 검증 성공. 콜드스타트와 부합하나 재기동을 유발한 플랫폼 이벤트는 미확인.
- 10:42:06 health200/UP(477ms), 직접/프록시 모집 중·예정 목록200 JSON·13건(876/807ms). PC·모바일 에뮬레이션의 실제 공개 사이트에서 첫 페이지12카드/전체13건, 오류 문구0·pageerror0, 모바일 가로 넘침 없음. 새로고침 없이 PC 페이지에서 목록 표시 확인. 실제 iPhone WebKit·사용자 기존 세션/필터는 미검증.
- 독립 읽기 리뷰: 요청12초/자동 대기5분, timeout·502/503/504·네트워크 오류 재시도 정책 확인. 약3분 기동만으로 사용자 최초 최종오류 원인은 확정할 수 없음. 200 HTML/500 등은 이번에 재현되지 않아 추측으로 코드를 변경하지 않았다. 재발 시 오류 제목 아래 문구와 해당 공고 요청 응답을 확인한다.
- 증거: `.harness/oct29-incident/`의 `probes.jsonl`, `startup-evidence.json`, `browser.json`, `mobile.json`, PC/모바일 이미지. 앱/테스트 변경 없음. 최신 Render 문서는 제한 네트워크로 조회 불가, 진단은 실제 서비스 메타데이터/로그/공개 응답에 근거했다.

## 카카오 본인 알림 원격 반영 (2026-10-23, 배포 준비)

- 사용자 커밋·배포 요청으로 10월21일 본인 전용 연결/발송과 10월23일 수신 조건 안내·공고 금액/면적 요약을 함께 반영한다. 기존 로컬 검증의 미검증·최초 실패 기록은 아래에 보존한다.
- 검증본 소스436파일 동일 확인, 원격 main 기준 `2437ab6`. PR 최종 head의 기존 CI8개 성공 후 main 병합으로 Vercel·Render GitHub 자동 배포를 사용한다.
- 기능은 기본 비활성이다. 카카오 앱 키·서버 설정·회원 연결·실수신 검증은 코드 배포와 별도이며 아직 완료로 보지 않는다.
- PR #144 첫 head `8abbc78`, CI #351: 6개 성공(Chromium326·단위182·백엔드200실행·PostgreSQL10 포함), iPhone/실제 인증은 Azure Ubuntu 미러 패키지 다운로드 지연으로 설치 도중15분 제한 취소, 테스트 미실행. 앱 테스트 실패와 구분한다.
- `scripts/ci-use-ubuntu-mirror.sh`로 브라우저3개 job의 Azure archive 엔트리만 공식 Ubuntu HTTPS archive로 변경한다. 우선순위/다른 미러/서명 검증/검사·재시도·시간 제한은 유지한다. 셸 문법·독립 tempfile 치환/반복/파일 부재 검사 통과, 기존 앱/테스트436파일 동일. 수정한 최종 head의 기존 전체 CI8개를 다시 확인한다.
- PR/CI/배포 SHA와 공개 응답 증거는 PR 본문 및 로컬 `.harness/oct23-kakao-release/`에 보존한다. 상태 기록만을 위한 재커밋·CI·수동 재배포는 하지 않는다.

## 카카오 공고 금액·공급면적 메시지 (2026-10-23, 로컬 후속)

- 이전 미커밋 카카오 구현/안내를 보존했다. 공고×선택한 수신일정마다 보내는 기존 발송 방식에 공고명·분양가/임대보증금/공고 금액·공급㎡/약 평을 추가했다. 검색조건 자동 카카오 발송은 현재 대상이 아님을 도움말에도 명시했다.
- 금액·면적은 공고 전체의 독립된 범위이며 추가비용 별도. 미확인 값을 추측하지 않고 공고문 확인으로 표시, 0원·부분/역전 범위 처리, 200자 제한 및 이모지 안전 제목 축약. 여러 주택형으로 알림 행이 중복되지 않도록 면적 집계. 새 DB/API 변경 없음.
- 독립 리뷰 차단 결함 없음. 개발 중 메시지/서비스26개·PC/모바일 안내2개 통과. 최종 하네스14·프런트 빌드/단위182·백엔드200실행·인증JAR빌드 통과(PG10제외). 시스템 Chromium의 실제 로컬 Java 인증1개 통과. 이번 실행 테스트 실패 없음. 표준 전체 Chromium/iPhone·PostgreSQL·실제 Kakao OAuth/수신·운영 콜백 쿠키 미검증으로 전체 하네스는 blocked.
- 전체 보고서 `.harness/reports/2026-10-23T02-53-26-466Z-6676/report.json`, 보조 결과 `.harness/oct23-kakao-summary/supplemental.json`. 소스436파일은 고정본과 동일, 결과 문서만 후속 갱신했다.
- 상세: `docs/tasks/2026-10-23-kakao-message-summary.md`. 실제 발송·키 설정·원격 반영 미실행.

## 카카오 수신 조건·연결 안내 (2026-10-23, 로컬 후속)

- 시작 시 10월21일 최종 소스434파일 동일 확인. 기존 본인 전용 연결/발송 구현을 보존하고 저장된 지원 일정 요약·전체 꺼짐 안내·설정 초점 이동·연결 도움말을 추가했다.
- 초안/저장 실패는 적용 설정을 바꾸지 않고, 조회 실패는 미확인 상태로 표시한다. 청약홈 로그인 불필요, 관심 공고와 일정 설정 필요, 이메일/푸시와 독립, 지원하지 않는 종류를 안내한다.
- 기존 인증/발송 및 새 UI 독립 리뷰에서 차단 결함 없음. 최종 하네스14·프런트 빌드/단위182·백엔드190실행·인증JAR빌드 통과(PG10제외). 표준 Chromium/WebKit 부재로 전체 하네스 blocked. 시스템 Chromium 관련33개는32최초 통과/1페이지 생성 시간초과; trace 확인 후 해당1개만 새 프로세스에서 재검증 통과. 실제 로컬 Java 세션·CSRF 브라우저1개 통과.
- 전체 보고서 `.harness/reports/2026-10-23T01-13-39-870Z-1436/report.json`, 보조 결과 `.harness/oct23-kakao/supplemental.json`. 최종 소스434파일 동일성 확인. 전체 표준 Chromium/iPhone·PostgreSQL·실제 카카오 OAuth/수신·운영 콜백 쿠키는 미검증이다.
- 상세 범위/검증: `docs/tasks/2026-10-23-kakao-readiness.md`. 실제 카카오·운영 설정·원격 반영 미실행.

## 본인 전용 카카오톡 나에게 보내기 (2026-10-21, 로컬 구현)

- 기준 main `2437ab6`(PR #143). 정식 알림톡이 아닌 지정 회원 한 명의 카카오 나와의 채팅 발송. 기본 비활성, 지도·실발송·운영 설정·원격 반영 범위 제외.
- 세션에 묶인 일회성 OAuth state, 서버 AES-GCM 토큰 저장/갱신, 본인만 연결·해제·시험, 접수 시작/마감 7·3·1일 전 관심 알림 발송. V39 신규 테이블로 시도를 외부 호출 전에 기록해 불명확한 결과를 자동 재발송하지 않는다. 당일(KST)·연결 이후 생성 알림만 대상으로 무료 서버 절전 시 정시/전체 수신 보장 없음.
- 회원 탈퇴 시 로컬 토큰 제거. 알림 설정에서 상태/재연결/시험/해제 제공, 미저장 설정·늦은 응답·불명확한 발송 결과 보호. 카카오 복귀 쿼리만으로 연결 성공을 판단하지 않는다.
- 최종 하네스14·프런트 빌드/단위182·백엔드190실행·인증JAR빌드 통과(PG10제외). 표준 Chromium/WebKit 부재로 전체 상태 blocked. 시스템 Chromium 보조25개는15통과/회원 초기화 대기2실패/8미실행. trace·독립 리뷰 후 준비 조건만 보완하여 카카오 PC10/모바일10 전부 통과(1.8분); 기존 알림 초안5개는 최초 보조검사 통과, 파일/앱 불변. 실제 로컬 Java 세션·CSRF 브라우저1개 통과(1분). 전체 Chromium/iPhone·PostgreSQL·실제 카카오 수신은 미검증.
- 보고서 `.harness/reports/2026-10-21T00-50-02-036Z-37383/report.json`, 보조 결과 `.harness/oct21-kakao/supplemental.json`. 앱/서버는 하네스 고정본과 동일하며 이후 변경은 새 브라우저 테스트의 준비 조건과 기록뿐이다. 최종 소스434파일 지문 확인. 독립 리뷰 보완사항과 최초 실패 이력은 작업 기록에 보존했다.
- 설정 및 사용자 준비: `docs/kakao-self-setup.md`. 실행 범위/최초 실패/최종 결과: `docs/tasks/2026-10-21-kakao-self.md`. 운영 Kakao OAuth/실기 수신은 키·동의 없이 미검증. commit/push/배포 미실행.

## 탐색 UX 원격 반영 (2026-10-20, 배포 준비)

- 사용자가 커밋·푸시·배포를 명시적으로 승인했다. 아래 로컬 검증 기록의 미완료 항목은 그대로 보존하며, 최종 PR head의 기존 CI8개 성공을 확인한 뒤 main 병합과 GitHub 연동 자동 배포를 진행한다.
- 범위: 10월19일 공고 결과 이동/빠른 검색 제거 + 10월20일 필터 통합/관심목록 조건 분리. API·DB·배포 설정 변경 없음. 앱/테스트435파일은 최종 고정 manifest와 동일하다.
- 원격 결과의 PR·CI URL·배포 SHA·공개 응답은 PR 본문과 로컬 `.harness/oct20-release/`에 남긴다. 상태 기록만을 위한 추가 커밋·재배포는 하지 않는다.
- PR #143, 첫 head `bccc8ea`, CI #348: 7개 job 성공(Chromium312·단위182·실제 인증2·백엔드161·PostgreSQL10 포함), iPhone은114통과/1실패/1재시도통과/PC전용3제외. 병합하지 않고 trace를 진단했다.
- 실패한 키보드 검사는 각 스크롤 rAF 완료를 기다리도록 보강했다. 기존 >=5/instant/초점/위치 검사는 유지하고 선택 상태 검사 추가. 관심 진입 직후 일정 버튼을 누른 재시도 통과 건은 고정 탭의 포인터 가로채기가 trace에 있어 목록 응답·이동 완료를 준비 조건으로 추가했다. 앱 동작·제한 시간·재시도 설정 변경 없이 독립 리뷰 완료. 보완 head의 전체 CI 성공을 확인한 뒤 배포한다.

## 탐색 조작 통합·관심목록 조건 분리 (2026-10-20, 로컬 미커밋)

- 기준 `c728183`, 10월19일 미커밋 변경을 보존한 후속 개편. 상단 검색어만, PC 왼쪽 필터/모바일 필터 한 곳으로 통합. 값이 있는 조건 칩·전체 초기화로 요약 중복 제거, 필터 초기화 범위·즉시 반영 안내, 모달/검색 초점 보완.
- 일반 검색 조건을 관심조회에서 제외해 저장된 마감 공고도 표시. 일반 검색 상태를 보존하되 관심보기에서는 공용 상태탭 선택을 강조하지 않는다. 정상/빈 관심목록 복귀 및 검색어 편집 중 더보기 페이지를 유지한다. facets·URL은 공용 검색 기준을 유지한다.
- 읽기 전용 독립 감사·보완 리뷰 완료. 최종 하네스14·빌드/단위182·백엔드161실행(PostgreSQL10제외)·인증JAR빌드 통과. 표준 Chromium/WebKit 부재로 하네스 전체 상태는 blocked. 앞선 고정본 전체 브라우저는26통과/페이지 로딩시간초과1/중단1/284미실행, 좁은2개 재검증 통과. 최종본 UI39·모바일 터치 Chromium6·로컬 Java 인증1 통과. 최종본 전체312개·iPhone은 미검증이며 정상 환경/CI 후속 확인이 필요하다.
- 최종 보고서 `.harness/reports/2026-10-20T04-49-54-754Z-20409/report.json` 및 `supplemental.json`. 소스435파일 동일성 확인, 문서 하네스14개 통과(`2026-10-20T04-56-25-579Z-24000`). 초기 실패·코드 보완 전후 결과·명령은 `docs/tasks/2026-10-20-explore-simplification.md` 참조.
- API/DB/지도 키/운영 설정·commit/push/배포 변경 없음.

### 10월20일 후속 브라우저 검증

- 사용자 `진행` 요청에 따라 잔여 검증을 이어갔다. 앱/테스트 코드435파일은 최종 고정본과 동일하다. 이전 실패 trace에서 화면 소스34개 로딩이 완료되지 않은 것을 확인했으나 근본 원인은 확정하지 못했다.
- 동시 부하를 줄인 workers1로 핵심 흐름163개를 실행: **72통과/1시간초과/90미실행**(7.6분). 앞서 실패한 favorites403 시나리오는 통과했지만 알림함 첫 진입의 버튼 클릭에서 시간초과가 발생했다. 같은 시점 셸 로그 조회·브라우저 정리도 지연됐다. workers1만으로 해결됐다고 볼 수 없다.
- 새로 실패한 알림 시나리오를 별도 프로세스에서 좁혀 확인: **1통과**(14.0초, 테스트11.0초). assertion/timeout/retries 변경 없음. 이 통과를 전체 회귀 성공으로 해석하지 않는다.
- 증거: `.harness/oct20-serial-core.json`, `.harness/oct20-serial-core/`, `.harness/oct20-isolated-final.json`, `.harness/oct20-serial-diagnosis.json`. 실행 환경 observed revision227, 표준 Chromium/WebKit 여전히 없음. 전체312개·iPhone 미검증 상태 유지. 정상 Playwright 환경에서 전체 Chromium/iPhone을 실행하는 것이 다음 단계다. 원인 미해결 상태의 전체 재실행은 중단했으며 앱 수정·원격 반영은 없다.
- 후속 문서 하네스 통과(4.3초): `.harness/reports/2026-10-20T05-23-51-203Z-28250/report.json`. 코드435파일 동일성 및 `git diff --check` 확인.

## 공고 결과 이동·탐색 UX (2026-10-19, 로컬 미커밋)

- 기준 clean `c7281833698c327bbde1217d37769dd576aeb888`, PR #142 이후 현재 코드에서 진행. 이전 대화의 지도 미커밋 상태를 복구하지 않는다.
- 오늘 마감/접수중/오픈 예정/모집 중·예정 선택·재선택 시 실제 카드/로딩/오류 영역으로 이동한다. 고정 헤더+탭 높이 보정, 탭 초점 유지, 모션 줄이기 및 늦은 응답의 재이동 방지.
- 빠른 검색 칩과 전용 로직/CSS 제거. 기존 검색어·지역/유형·필터·최근 검색 유지. 일반 검색·필터 결과 이동도 개선하고 필터 하단 버튼 고정/입력 가림 방어.
- 독립 읽기 전용 리뷰 완료, 고정 footer의 면적 입력 가림 회귀 권고 반영. 신규 모바일 터치9개 통과. 하네스14·빌드/단위182·백엔드161 실행·로컬 Java 인증1개 통과(PostgreSQL10개 제외).
- 전체 하네스는 표준 Chromium/WebKit 부재로 blocked. 시스템 Chromium 보조 전체 검사는 첫15통과/2시간초과/2중단/283미실행, 두 번째62통과/5실패/2중단/233미실행. 실패2개·5개는 각각 좁은 재검증에서 전부 통과했지만 전체302개 완주 및 iPhone은 미검증이다. 정상 브라우저 환경/CI에서 후속 확인 필요, 전체 통과로 보고하지 않는다.
- 보고서 `.harness/reports/2026-10-19T09-13-19-128Z-3270/report.json`와 `supplemental.json`. 초기 선택자 오류·전체 시간초과·범위/코드 지문/재검증 결과는 `docs/tasks/2026-10-19-explore-navigation.md`에 구분했다. 최종 검사 후 소스434파일 동일성 확인. 문서 하네스14개 통과(`2026-10-19T09-34-23-881Z-10127`).
- API/DB/지도 키/운영 설정·commit/push/배포 변경 없음. WebKit/운영 검증 제약은 작업 문서에 구분했다. 로컬 Java 인증과 실제 운영 계정 검증은 별개다.

## 알림 설정 이탈·메모 원복 보호 (2026-10-17)

- 기준 main `ae838c282dbe2c67fb22d54a1fa09ccfe070202c` (PR #141 CI8/동일 SHA 배포 완료), branch `codex/unsaved-settings-bundle`.
- 알림 설정 dirty 비교·닫기/공고 이동 확인·페이지 이탈 경고, 저장 중 Escape 잠금. 탭 전환은 초안 유지. 저장 실패 보존 및 성공 후 재편집 안내 개선.
- 읽음 이동 대기 중 설정 입력 잠금으로 늦은 응답의 새 초안 유실 차단. 독립 리뷰 발견 경계 보완 및 재리뷰 완료.
- 메모 idle 원복 시 해당 초안/불필요 요청 제거. 저장 중·실패 불확실 상태는 기존 초안/revision/ABA 보호 유지.
- 관련38·리뷰 보완10·기존 알림20 브라우저 통과. 최종 하네스14·빌드·단위182·Chromium293·iPhone102 최초 통과(PC전용3 제외). Java/Maven 부재로 로컬 서버/실제 인증 blocked이며 최종 head CI/배포는 원격 반영 단계에서 확인한다. API/DB/운영 설정/실발송 변경 없음.
- 상세: `docs/tasks/2026-10-17-unsaved-settings.md`. beforeunload는 실제 iPhone 강제 종료 보호가 아니며 Java/Maven 부재 로컬 제약은 원격 CI와 구분한다.

## 소수 면적·미저장 입력 보호 묶음 (2026-10-17)

- 기준 main `c65b823c17c7ef306874d44895c6d48a39992b3a` (PR #140 CI8 및 Vercel READY/Render live·동일 SHA 공개 응답 확인), branch `codex/input-preservation-bundle`.
- 소수 면적 입력/API/URL/최근 검색/저장조건 일치. 최소0은 제한 없음, 최대0/역전/셋째 소수 자릿수는 화면 제출 차단. 예산 정수 정책 유지.
- 미저장/저장 중 메모의 페이지·회원 세션 이탈 확인, 관심 해제 취소/실패 시 초안 보존 및 성공 후 해당 초안만 제거. 해제 요청 중 편집 경합 차단.
- 저장조건 요청 중 입력/닫기 잠금, 실패 후 원문 복구. API/DB/운영 설정/실발송 변경 없음.
- 관련 브라우저 초기26 통과, 확장34 중4 테스트 선택자 충돌 수정 후 좁은4 재검증 통과. 독립 면적 리뷰의 0 경계 보완 및 재리뷰 완료.
- 최종 하네스14·빌드·단위182·iPhone95 통과(PC전용3 제외). Chromium285 통과/기존 안내 문구 기대값1 실패는 정확 일치 검사로 보완해 해당1 재검증 통과. 앱 코드 불변. Java/Maven 부재로 서버/실제 인증은 로컬 blocked이며 최종 head CI·배포는 원격 반영 단계에서 확인한다.
- 상세: `docs/tasks/2026-10-17-input-preservation.md`. 실제 iPhone 강제 종료의 초안 보존은 보장하지 않음. 다음은 원래 값 복원 dirty 최적화·알림 설정 이탈 보호.

## 사용자 흐름 통합 감사·복구 UX (2026-10-17)

- 기준 main `91737a0ec17948349c73a6d7909fbfff702dbd50`(PR #139 배포 live 확인), branch `codex/user-flow-audit`.
- 관심 검색/상태 0건에서도 입력·필터·추가 페이지 조회 유지. 조회 범위와 전체 건수 구분.
- 관심 CSV 수식 문자열 방어·다운로드 오류/재시도, ICS 유효 이벤트 확인·WebKit URL 정리.
- 최근 공고 삭제 지속 저장, 실패한 항목 표시·삭제·재조회, 오프라인/재연결과 저장소 차단 안내.
- 최종 하네스14·빌드·단위180·Chromium277·iPhone86 통과(PC전용3 제외). 최초 타입 오류 수정 및 관련 fixture 보완 이력은 작업 문서에 구분. Java/Maven 부재로 로컬 서버/실제 인증 미검증; 필수 CI·동일 SHA 운영 배포는 원격 반영 단계에서 확인한다.
- 독립 감사 및 페이지 경계 리뷰 보완. 후속은 소수 면적 일관성·미저장 메모 이탈/삭제 보호·저장조건 요청 중 입력 보호.
- 상세 결과/제약/우선순위: `docs/tasks/2026-10-17-user-journey-audit.md`. API/DB/운영 설정/실발송 변경 없음.

## 회원 기록 저장·비교 복구 묶음 (2026-10-11)

- 기준 main `24bd294ebfe1eaa35768fc84f742ab47d68ee9fb` (PR #138 CI8개 및 동일 SHA 운영 검증 완료), branch `codex/member-recovery-bundle`.
- 공고별 저장 큐와 편집 revision으로 저장 중 새 입력/ABA 편집 보존. 저장 실패 초안·재저장, 초기 tracker 조회 실패 잠금·재조회, 계정 scope 이탈 후 응답 차단.
- 실패 비교 ID도 표시하여 재시도·삭제·전체 해제 지원. 모바일 비교 선택 항목을 숨기지 않고 가로 스크롤로 표시.
- 인증 요청 중 탭·닫기·배경·Escape·중복 제출 차단. 비밀번호 재설정 성공 시 회원 상태를 지우고 로그인 화면으로 복귀.
- 인증 신규8개/복구 신규16개 관련 검사 통과. 독립 리뷰 발견2건 보완 및 재리뷰 완료. 최종 로컬 하네스14·단위176·빌드·Chromium268·iPhone77 통과(PC전용3 제외). Java/Maven 미설치로 서버/실제 인증은 blocked; 원격 필수 CI 및 배포는 반영 단계에서 확인. 결과 보고서·명령은 작업 문서 참조.
- 상세: `docs/tasks/2026-10-11-member-recovery.md`. API/DB/운영 설정과 실발송 변경 없음.

## 공고 정보 정확성 묶음 (2026-10-11)

- 기준 main `233e3dd39c66b4bb7a51cc7673124cd23338f971`, branch `codex/notice-information-accuracy`.
- 임대 rentType 요약 API, SQL/메모리/화면 판정 통일; 청약홈 임대 금액은 의미를 추정하지 않는 `공고 금액`으로 표시.
- 비교표/CSV 원 단위 금액·연도 포함 날짜, 최대가격만 있는 부분 정보 보존, 주택형 필터와 표의 유효 수치 기준 일치. 기존 목록 캐시 v3 분리.
- 최종 로컬: 하네스14·빌드·단위176 통과. Chromium253/iPhone63 통과 및 버튼명 기대값 실패5개는 테스트 한 곳 수정 후 양쪽 접근성27개 재검증 통과(PC전용3제외). 앱 코드 불변, 최초 실패와 수정 후 통과는 작업 문서에 구분. Java/Maven 부재로 로컬 서버 검증 불가. 최종 head 전체 CI/운영 동일 SHA 검증은 원격 반영 시 확인하며 이 기록 시점에는 미실행.
- 상세 계약·검증/제외 범위는 `docs/tasks/2026-10-11-notice-information-accuracy.md`.
- DB/운영 설정/실제 알림·AI 호출 없음. 다음 묶음은 메모 저장 안정성·비교 실패 복구·인증 지연 응답 경계.

## 주택형 부분 정보·상세 재시도 경계 (2026-10-11)

- 기준 main `f7565d62d8098cd8abec7831878759b11640b17e`, PR #136 CI8개 및 동일 SHA 운영 검증 완료 후 시작.
- 분양 주택형의 공급면적·최고 분양가·일반/특별/전체 세대의 누락/오류를 필드별 건수로 안내한다. 기존 수치 검증 재사용, 정상 0원/0세대 보존, 임대 제외, 원본/합계 추정 및 추가 요청 없음.
- 관련 단위12·신규 Chromium2 최초 통과. 오류·재시도·정상 응답·임대 전환 경계를 포함한다. 최종 full extended/필수 CI·배포는 이 묶음 최종 코드로 확인한다. 로컬 Java21/Maven 미설치 제약은 성공으로 표시하지 않는다.
- 최종 로컬 빌드·단위169/Chromium254/iPhone63 최초 통과, PC전용3 제외. 독립 리뷰 결함 없음. backend/실제 인증은 로컬 blocked이므로 원격 CI로 확인한다. 보고서와 한계는 작업 문서에 기록했다.
- 범위/검증/제약: docs/tasks/2026-10-11-unit-quality.md. 다음 후보는 공급 합계 수치 안전 범위와 공급 내역 불일치 표시 정책이다.

## 프런트 의존성 보안 패치 (2026-10-11)

- 기준 main `ade9d34e16fd346861aa2c314c662ee5a732cab9` (PR #135): 모바일/상세 안내 변경의 PR CI8개 및 동일 SHA 운영 응답 검증 완료.
- Vite8.0.16/source-map-js1.2.2로 기존 audit high 2개 패키지 경고 해결. 최소 패치 계열 유지, 필요한 rolldown 바인딩/선택적 WASM peer 잠금파일도 함께 갱신. 앱·API·DB·인증·클라우드 설정은 변경하지 않는다.
- `npm --prefix frontend run audit:security`와 재설치/보안 점검 안내 추가. CI 자동 보안 검사 신설이나 전체 서비스 보안 보장은 아니다.
- 첫 잠금파일 갱신의 선택적 peer 불일치 수정 후 npm ci 성공/audit 0건 확인. 최종 full extended/필수 CI·배포 결과는 PR에 기록한다. Java21/Maven 미설치 때문에 로컬 백엔드/실제 인증 성공으로 보고하지 않는다.
- 독립 리뷰로 선택적 WASM peer 배치와 audit 개발 의존성 포함을 보완: npm10.9.4로 루트 peer를 생성하고 재설치, --include=dev 및 production 환경 audit 0건 확인. 최초 통합 검사는 보완을 위해 중단했고 최종 통합본으로 다시 검증한다. 모든 OS/WASM 실행을 검증한 것은 아니다.
- 보완 후 최종 로컬 빌드/단위165·Chromium252·iPhone61 통과(PC전용3 제외), 하네스 자체 통과. Java/Maven 제약은 유지하며 원격 필수 CI로 확인한다. 최종 보고서는 작업 문서에 기록했다.
- 상세 범위·근거·검증은 docs/tasks/2026-10-11-frontend-security.md. 다음 후보는 공고 확인 안내의 정상/오류 재시도 경계 및 주택형 부분 수치 안내.

## 모바일 접근성·공고 확인 정보 (2026-10-11)

- 기준 main `d589ef66e1ab6bdf2d1748d6161abab7a6a330eb`, PR #134 CI/동일 SHA 배포 검증 완료 기준으로 시작.
- 검색 16px·닫기 44px·긴 제목 줄바꿈, 숨김 컨트롤 제외/summary 포함/모달 루트 키보드 순환 보완.
- 최신 상세 성공 응답에서만 공급기관·접수기간·가격 범위·분양 주택형 확인 목록 표시. 미제공을 수집 실패로 추론하지 않으며 API 추가 호출 없음. 음수·비유한·역전 가격 표시 방어, 0원 유지.
- 이번 실행은 격리 clone에서 로컬 명령이 가능하다. 관련 단위 13개 및 새 모바일 Chromium 시나리오 통과. 최종 로컬/CI 결과는 PR에 기록. Java21/Maven 미설치로 로컬 full extended는 제약이 있고 필수 CI는 생략하지 않는다.
- 첫 WebKit 전체 검사의 지연 목록 필터 닫기 초점 실패를 수정: 터치 열기 전에 버튼 초점을 명시적으로 설정해 복원 대상을 보존한다. 기존 통과 결과를 수정 후 코드의 통과로 재사용하지 않고 최종 통합 검증한다.
- 상세 기록: docs/tasks/2026-10-11-mobile-notice-quality.md. 다음 묶음 후보는 기존 Vite/source-map-js 보안 경고 해결과 의존성 회귀 검증. 실제 기기 Safari/스크린리더·운영 데이터 정확성·주택형 부분 수치 검사는 미검증/제외.

## API 요청·캘린더·탐색 복원 묶음 (2026-10-09)

- 기준 main `e4ef6d25989b274371a8ddea60a7968cecd25887`. PR #133의 CI와 동일 SHA 운영 검증은 완료됐다.
- 현재 탭 목록 성공 후 다른 상태 탭을 미리 읽어 초기/실패 대기 중 불필요한 병렬 조회를 줄인다. 기존 캐시·재시도·진행 중 사전 요청 재사용은 유지한다. 공개 health → 목록/건수 2회씩 순차 측정 도구를 추가한다. 운영 실측/DB 병목·cold start 원인은 미확정이다.
- 일반·관심 ICS는 실제 날짜와 안전한 다음 날 범위를 검사하고 역전 접수 기간은 제외하되 독립된 발표/유효한 부분 일정은 보존한다. 알림함 잘못된 날짜는 미확인 표시. 백엔드 알림 생성·발송·원본 데이터는 변경하지 않는다.
- popstate에서 예산·면적·검색어를 함께 복원하고, 검색 조건이 같은 상세 닫기에서는 관심 목록을 유지한다. 요청 취소와 상세 초점 복원은 유지한다.
- 읽기 전용 API/날짜 감사 후 총괄만 수정한다. 전체 범위/예정 검사는 docs/tasks/2026-10-09-latency-calendar-navigation.md.
- 로컬 명령은 프로세스 생성부터 setup refresh 오류. 관련 테스트와 하네스 plan/full extended 미실행, 로컬 보고서 없음. React 스킬 읽기도 같은 이유로 차단되어 직접/독립 리뷰로 보완한다. 최종 PR head 기존 필수 CI로 검증하고 성공 후 병합·Git 자동배포/동일 SHA 확인한다. 결과는 PR/CI 기록으로 남기며 로그용 추가 push를 하지 않는다.
- 운영 데이터 쓰기·실제 AI/알림·클라우드 설정 변경 없음. 실제 iPhone Safari/스크린리더, 서버 내부 쿼리 시간, 역전 데이터의 백엔드 알림 생성 정책은 이번 범위 밖이다.

## 통합 점검·로딩 중 탐색·동기화 시각 방어 (2026-10-09)

- 기준 main `4a87984f31e308428c36ec1657dee01e61656613`. 이전에 미확인인 PR #132의 main CI 37882449553 및 운영 동일 SHA 검사 37882884903은 현재 성공했다. 기준 결과: 단위151·Chromium245·iPhone54·실제 로그인2·H2일반153·PostgreSQL8 최초 통과. iPhone PC전용3 및 H2에서 PostgreSQL전용8 제외는 별도 실행과 구분한다.
- 이번 목표는 사용자 통합 흐름의 누락 보완. 로딩 중 모바일 필터 버튼이 비활성화되는 불편을 제거하고, 잘못된 공고/최신성/소스 동기화 시각으로 Intl formatter가 화면을 중단시키는 경로를 방어한다. API 계약·서버 상태·인증·DB·CI/배포 설정 변경 없음.
- 캐시 syncedAt의 파싱 불가 문자열을 제거하고, 실시간 API의 잘못된 시각은 목록·소스 패널에서 미확인으로 표시한다. 모든 timestamp 달력 형식의 엄격 검증은 아니며 Date가 자동 보정하는 기존 동작은 이번 범위가 아니다.
- 단위1개 및 Chromium/iPhone 공통 브라우저3개를 추가한다: 지연 목록 중 조건 변경 및 과거 응답 격리, 잘못된 syncedAt 캐시 복구, 목록/최신성/소스 시각 오류 후 재검색. 총괄 단일 쓰기·별도 읽기 전용 감사/리뷰. 상세 범위는 docs/tasks/2026-10-09-integration-audit.md.
- 로컬 프로세스 생성은 setup refresh 오류로 차단돼 관련 테스트·하네스 plan/full extended 미실행. React/배포 스킬 파일도 읽을 수 없어 코드 검토와 기존 저장소 CI/Git 자동배포 절차를 사용한다. 최종 PR head 전체 CI 성공 후 병합하며 결과는 PR/CI에 남긴다. 보고용 반복 push는 하지 않는다.
- 이전 PR iPhone 필터 시나리오의 간헐 timeout은 같은 코드 main CI에서 재시도 없이 통과했으나 원인을 확정/수정했다고 주장하지 않는다. 이번에도 최초/재시도 결과를 구분한다. 실제 기기 Safari·보조기기·운영 회원 쓰기·AI/알림 발송은 미검증/제외다.

## 날짜·마감 상태 표시 보완 (2026-10-09)

- 기준 main: `8d01f311aa5735fd69cb5f44313b276df6171016`. 직전 PR #131의 캐시 복원은 CI와 동일 SHA 운영 검사까지 완료됐다. 이번 작업은 별도 `codex/notice-date-presentation` 브랜치에서 진행한다.
- 목표: 존재하지 않는 날짜를 다른 날로 자동 보정하거나 NaN/잘못된 마감으로 표시하지 않는다. 확인된 접수 종료일은 시작일이 없어도 표시하고, CLOSED/ANNOUNCED/UPCOMING 상태를 오늘 마감으로 덮어쓰지 않는다.
- `noticePresentation.ts`의 날짜 계산과 표시 검증을 통일한다. 부분 접수 일정은 확인된 날짜를 표시하고, 역전 기간·잘못된 특별공급/계약 일정은 확인 안내를 제공한다. 잘못된 변경 시각은 렌더 예외 대신 미확인으로 표시한다. 원본 데이터·API/서버 상태·캘린더 출력·인증·DB/CI/배포 설정은 바꾸지 않는다.
- 단위 회귀 7개와 Chromium/iPhone 공통 상세 화면 회귀 2개를 추가한다. 한국 날짜 경계, 윤년, 잘못된 날짜, 상태 우선순위, 상세 닫기·초점 복원을 포함한다.
- 단일 구현 후 읽기 전용 독립 리뷰를 수행한다. 로컬 실행은 `helper_unknown_error: setup refresh had errors`로 프로세스 생성부터 차단됐다. 관련 단위/브라우저 검사, 하네스 plan 및 최종 `verify --base 8d01f311aa5735fd69cb5f44313b276df6171016 --scope full --extended`는 로컬 **미실행**이며 보고서가 없다.
- 사용자 기존 승인에 따라 변경·기록을 모은 PR의 최종 head 필수 CI로 검증하고 성공 후 병합·Git 자동배포한다. PR/CI에 결과를 기록하며 기록만을 위한 추가 push는 만들지 않는다. 실제 Safari 기기·스크린리더는 별도 미검증, 운영 데이터 쓰기·실제 AI/알림·클라우드 설정 변경은 제외한다.

## 공고 목록 캐시 복원 검증 보완 (2026-10-09)

- 기준 main: `ab51917fc9faf76f38a17c715c5741bd44c50d76`. 사용자 요청에 따라 GitHub 저장소를 원본으로 이어서 개발한다. 사용자가 로컬 프로젝트가 없다고 확인했으며 사용자 파일을 생성/덮어쓰지 않는다. 작업 브랜치는 `codex/cache-restore-validation`이다.
- 현재 main의 CI 및 운영 검증 워크플로 성공을 확인했으며 이는 이번 변경의 검증 결과가 아니다. 시작 시 열린 PR은 없었다.
- 캐시가 필수 필드만 검사해 숫자/객체 기관명·주소·날짜가 카드 렌더링에 전달될 수 있는 누락을 보완한다. 선택 문자열 필드와 유한 숫자 필드를 검증하고 잘못된 항목은 기존 제거 경로로 버려 네트워크 조회를 사용한다. null/미제공/빈 문자열/정상 0 값과 기존 캐시 키·TTL은 유지한다.
- 단위 회귀 3개(선택 문자열 오염, 수치 타입/비유한 값, 구버전·nullable 정상값)와 Chromium/iPhone 공통 브라우저 회귀 3개(기관명/주소/날짜 오염 → 지연된 정상 목록 복구, URL·관계없는 저장소 보존)를 추가한다. API/인증/DB/배포 설정은 변경하지 않는다.
- 현재 실행 환경은 명령 프로세스 생성 전 `helper_unknown_error: setup refresh had errors`로 실패한다. 관련 단위/Playwright 검사 및 최종 `node scripts/harness.mjs verify --base ab51917fc9faf76f38a17c715c5741bd44c50d76 --scope full --extended`는 **로컬 미실행**이다. 로컬 보고서도 생성되지 않았다.
- GitHub 파일 API로 격리 브랜치에 코드·테스트·이 기록을 모은 뒤 PR을 연다. 수정 중 전체 CI를 반복하지 않으며 최종 PR head의 기존 필수 CI(빌드·단위·Chromium·iPhone·실제 인증·H2·PostgreSQL 등)로 검증한다. CI 성공 전 병합하지 않는다. 결과는 PR/CI에서 확인하고 기록만을 위한 추가 push는 만들지 않는다.
- 독립 리뷰는 읽기 전용 기본 서브에이전트로 진행하며 실제 검토 결과는 PR에 기록한다. 운영 데이터 쓰기·외부 알림/AI·클라우드 설정 변경은 제외한다. 실제 기기 Safari·스크린리더 검증은 별도 미검증이다.

## 단계별 테스트 운영 지침 (2026-10-08)

- 기준 main: `96555099519b7a84a5cf26a9c91d07776079c5a9`. 사용자가 Markdown 지침 수정과 원격 반영·배포를 요청했다.
- AGENTS, HARNESS, MULTI_AGENT, README, 작업 템플릿·결정 기록을 동일한 정책으로 정리한다: 수정 중 관련 검사 → 변경 묶음의 최종 전체 검사 → 승인된 원격 반영·CI·배포 확인.
- 앱·테스트·CI·배포 설정은 그대로이며 변경은 Markdown 7개다. 작업은 단일 에이전트로 수행한다. 기존 다른 작업공간의 미커밋 변경은 보존한다.
- 로컬 검증은 문서 범위 규칙/하네스 자체 검사와 안내한 명령의 대상 확인이다. 이번 문서 수정 때문에 전체 Chromium·iPhone을 로컬에서 다시 실행하지 않는다.
- 최종 결과는 이 변경의 PR/CI 및 병합 SHA에서 확인한다. 현재 문서는 원격 반영 전 작성되며 이전 앱 검증 결과를 새 CI 통과로 대신하지 않는다. 결과 기록만을 위한 후속 push는 만들지 않는다.
- 아래 기존 기능·운영 확인 기록은 당시 결과를 보존한 것이며 이번 문서 변경의 테스트 결과와 구분한다.

## 관리자 공급기관 현황·탐색 접근성 통합 (2026-10-07)

### 최신 결과와 운영 후속

- [PR #129](https://github.com/enrjsj/cheongyak-one/pull/129)를 [CI #316](https://github.com/enrjsj/cheongyak-one/actions/runs/37597591078) 8개 작업 성공 후 main에 병합했다. 앱 검증 커밋 `eb7413afd27b078018e84dfded572662c7d7a777`, 병합 커밋 `e99451bc5a73b7c01227c57f013d560d1f515a7e`.
- Chromium 240개·iPhone WebKit 49개·실제 로그인 2개가 재시도 없이 통과했다. iPhone의 PC 전용 너비 3개만 의도적으로 건너뛴다. 단위 141개·일반 backend 153개·실제 PostgreSQL 8개와 하네스/인프라/실데이터 검사도 성공했다. 초기 CI 실패는 아래 기록처럼 수정 후 새 CI로 해결했다.
- Git main 연동으로 Vercel·Render에 e99451b가 반영됐다. 09:12:12 UTC 웹·API·프록시 동일 revision과 공개 응답/인증 경계 7개가 통과했다 (`/tmp/supplier-accessibility-deployment.json`). 직접 Vercel 배포 API는 사용하지 않았다.
- 운영 실제 공고의 PC/모바일 검증에서 상세 로딩 안내 문구가 4.27:1로 기준에 못 미치는 추가 결함을 발견했다 (`/tmp/supplier-accessibility-production.log`). `detail-loading`의 글자를 `#666`으로 보정하고, 상세 응답을 보류한 로딩 상태와 응답 완료 상태 모두 검사하도록 기존 접근성 테스트를 확대했다. 로컬 접근성 10개가 통과했다 (`/tmp/supplier-accessibility-loading.log`).
- 로딩 후속을 `e3c9e7141d361ef463ffe53d70bf2c5ea148ac44`로 main에 반영했다. 09:19:27 UTC 웹·API·프록시 동일 revision 및 공개/인증 응답 7개가 통과했다 (`/tmp/supplier-accessibility-final-deployment.json`). Vercel·Render 모두 기존 Git 자동 배포만 사용했다.
- 실제 운영 브라우저 검증도 1440/390px에서 목록 공급기관 값 일치·추가 상세 자동 요청 없음·필터와 상세의 이름/대비·상세 응답 완료·닫기 후 초점 복원·가로 넘침 없음이 통과했다. 관리자 집계 API/프록시는 비로그인 401, 브라우저 오류/데이터 쓰기 요청은 0건이다. 증거 `/tmp/supplier-accessibility-production-result.json`, `/tmp/supplier-accessibility-production-loaded.log`와 `/workspace/ui-redesign-preview/production-supplier-accessibility-*.png`. 시스템 프록시로 전달한 실제 GET 응답이며 운영 관리자 계정의 집계 정확성 검증과는 구분한다.
- 기능 후속 [CI #318](https://github.com/enrjsj/cheongyak-one/actions/runs/37599323797)의 8개 작업 모두 성공했다. iPhone 49개는 최초 통과다. Chromium은 239개 최초 통과·기존 중첩 편집창 Tab 테스트 1개 재시도 통과다. 전체를 재시도 없는 통과로 표시하지 않는다. e99451b의 최초 공개 화면 검사도 전체 통과로 기록하지 않는다.
- 간헐 실패의 trace에서 저장 조건 API는 정상 200이었으나 필터 창이 열리지 않았다. 로그인 후 조건 복원과 클릭 시점이 겹쳤고 요소 위치 불안정이 기록됐지만 정확한 오클릭 원인이나 새 접근성 변경과의 인과관계는 미확정이다. 코드 변경 전 해당 테스트를 로컬 직렬 3회 재검증해 모두 통과했다 (`/tmp/supplier-saved-profile-recheck.log`). 임계값/재시도 횟수를 늘리지 않고 준비 helper가 회원 창 종료·기본 지역 적용을 기다리며 필터 창 열림을 명시적으로 확인하도록 보완했다. `/tmp/supplier-final-chromium-artifact`, `/tmp/supplier-accessibility-final-chromium-ci.log`에 증거가 있다.
- 준비 조건 보완 후 저장 조건·중첩 창 관련 Chromium 20개 통과 (`/tmp/supplier-profile-ready.log`). 이 후속은 앱 코드 변경이 없어 관련 브라우저 검사와 문서 범위 하네스로 검증하며 전체 CI는 main에서 다시 확인한다.
- 로딩 후속 독립 리뷰에서 차단 결함이 없었고 로컬 접근성 10개 통과를 확인했다. 하네스 첫 실행은 기록 문서 수정이 겹쳐 변경 지문 검사에서 실패했으며 파일을 고정해 재실행했다. 최종 자체 14개·타입/빌드/단위 141개 통과, 표준 Chromium 경로 부족으로 전체는 blocked (`.harness/reports/2026-10-07T09-13-35-532Z-62402/report.json`). 테스트 자체의 실패나 기준 완화로 처리하지 않았다.
- 미검증: 운영 관리자 계정 로그인/실제 누락 수 및 원본 전수 정확성/운영 규모 집계 성능/실제 기기 Safari·스크린리더/전체 WCAG 감사. 운영 데이터 쓰기·재수집·메일·AI·클라우드 설정 변경은 하지 않았다.
- 이 최종 결과 기록은 테스트 준비 조건·문서 후속이다. 앱 소스는 위 e3c9e71과 동일하며, 후속 커밋 자체의 CI 및 배포 revision은 기존 워크플로와 `verify-deployment.mjs`로 다시 확인한다. 이전 SHA의 성공을 새 SHA의 성공으로 대신하지 않는다.

### 구현 및 로컬 검증 기록

- 사용자 요청 1~2번을 d78c052 기준으로 통합한다. 관리자 화면에 소스별 전체 공고 수·공급기관 미확인 수·비율을 추가하고, 공개 목록·필터·상세 접근성 검사를 확대한다. 자세한 범위/분업은 `docs/tasks/2026-10-07-supplier-quality.md`.
- 관리자 API는 권한 확인 후 한 번의 집계 쿼리를 사용한다. 마감 공고 포함, null/공백을 미확인으로 세며 주택형 수에 따라 중복 집계하지 않는다. 0건과 구버전 API의 집계 미제공을 구분한다. DB migration·데이터 보정·재수집은 없다.
- 원본 매핑은 청약홈 `BSNS_MBY_NM`, 마이홈 `suplyInsttNm`이 기존 공급기관 필드로 연결됨을 코드로 확인했다. 원본 전체 데이터의 정확성을 확인하거나 운영 누락 수를 측정했다는 의미는 아니다.
- 접근성 신규 패키지는 npm 403 정책 차단으로 설치하지 않는다. 기존 Playwright 기반의 명시적 접근 가능한 이름·ARIA 연결·의미 구조 및 단색 배경 텍스트 대비 검사로 범위를 제한한다. axe 전체 검사/전체 WCAG 적합성 인증은 아니다.
- 로컬 백엔드 153개 통과, PostgreSQL 8개 건너뜀 (`/tmp/supplier-quality-backend-final.log`). JDK ct.sym 누락 때문에 source/target 21 실행 인자와 작업 공간 Maven 캐시를 사용했으며 저장소 빌드 설정은 유지했다. 관리자·공급기관·카드 모바일 관련 Chromium 33개 통과 (`/tmp/supplier-quality-related-final.log`).
- 별도 읽기 전용 `supplier_review`가 고정된 관리자 변경과 위 증거를 검토했고 확정 결함을 발견하지 못했다. 실제 PostgreSQL 정규식·Unicode 공백 호환, iPhone·실제 인증은 최종 CI에서 확인해야 한다.
- 공개 탐색은 저대비 보조 문구와 흰색 테마에 남은 흰색 주간 제목/일정 글자를 수정했다. 지역·주택유형·공급방식 선택 버튼에 `aria-pressed`를 추가했다. 레이아웃·API·검색 동작 변경은 없다.
- 통합 Chromium 회귀 55개 통과 (`/tmp/supplier-accessibility-integrated.log`). 접근성 독립 리뷰에서 불투명 자식 위 조상의 opacity/filter를 누락하는 검사 도구 결함을 찾아 수정하고 정상/미지원 효과 회귀를 추가했다. 첫 회귀는 오류 assertion 순서 때문에 실패했으며 원인별 assertion 순서를 보정했다. 테스트 무시나 허용 기준 완화는 하지 않았다.
- 최종 접근성 Chromium 10개 통과 (`/tmp/supplier-accessibility-a11y-final-fixed.log`): 세 너비의 목록·필터·상세 9개와 검사 도구 합성 효과 회귀 1개다.
- `node scripts/harness.mjs verify --base d78c052d81b731d8ef322aca7352dfe087208a4a --scope full --extended`: 자체 테스트 14개와 프런트 타입/빌드/단위 141개 통과. 전체는 **blocked**이며 기본 PATH Maven·표준 Playwright Chromium/WebKit 경로 부족 때문이다. 별도 도구 경로의 로컬 백엔드/Chromium 결과와 구분한다. 증거 `.harness/reports/2026-10-07T08-48-09-788Z-57349/report.json`.
- CI·Git main 자동 배포와 운영 동일 SHA 확인은 아직 진행 전이다. 운영 관리자 로그인/원본 전수 정확성/운영 규모 집계 성능/실제 기기 Safari는 미검증이다. 이전 d78c052 운영 성공을 이 기능 배포로 취급하지 않는다.

### PR #129 첫 CI 및 보완

- 첫 기능 커밋 d9a7957의 CI #315에서 backend 153개, PostgreSQL 8개, 실제 로그인 2개 및 Chromium 240개가 통과했다. iPhone은 기존/신규 45개 통과·접근성 4개 실패로 병합하지 않았다.
- 필터 실패는 WebKit 기본 placeholder `rgb(169,169,169)`가 흰 배경에 2.35:1인 실제 대비 결함이다. 필터 입력 예시에도 `#737373`, opacity 1을 명시했다.
- 상세 실패는 모달의 미지원 합성 효과로 판정됐으며 첫 trace에 정확한 computed 값이 없어 원인을 단정하지 않는다. 모달 및 조상의 애니메이션 완료를 기다린 뒤 검사하도록 보완하고, 실패 시 실제 opacity/filter/blend/background 값을 남긴다. 정상 등장 애니메이션 완료를 기다리는 회귀와 고정 opacity/filter 거부 회귀를 함께 유지한다. 임계값 완화·브라우저 제외는 없다.
- 첫 실패 로그 `/tmp/supplier-accessibility-iphone-ci.log`, CI artifact `iphone-webkit-report`, 로컬 추적 `/tmp/iphone-a11y-artifact`. 수정 후 새 CI 결과로 최종 판정한다.
- 보완 후 로컬 접근성 10개 통과 (`/tmp/supplier-accessibility-settled.log`). 프런트 하네스 재검증에서 자체 14개·타입/빌드/단위 141개 통과, 표준 Chromium 경로 부족은 동일하게 blocked다 (`.harness/reports/2026-10-07T08-59-06-446Z-60019/report.json`). 변경 없는 백엔드는 위 별도 CI 결과를 유지한다.

## GitHub main 연동 배포 점검 (2026-10-07)

### main 푸시 후 운영 재확인

- 문서 후속 커밋 `d78c052d81b731d8ef322aca7352dfe087208a4a`을 main에 반영한 직후 Vercel Production `dpl_5p8oWuRoqnRtsBH5hveGVgwAUkB6`가 생성돼 READY가 됐다. 출처 `git`, branch `main`, 공식 운영 alias와 동일 SHA를 확인했다. 직접 Vercel 배포 API는 호출하지 않았다.
- 2026-10-07 08:18:56 UTC `scripts/verify-deployment.mjs` 통과. 웹·API·프록시 모두 새 SHA 일치, 공개 응답 4개 HTTP 200, 비로그인 인증 경계 3개 HTTP 401로 총 7개 통과. 증거 `/tmp/git-autodeploy-production.json`.
- 같은 커밋의 [CI #314](https://github.com/enrjsj/cheongyak-one/actions/runs/37592497325) 8개 작업 모두 성공했다. Chromium 226개, iPhone 39개, 실제 로그인 2개 모두 재시도 없이 통과했다. [GitHub 운영 검증 #17](https://github.com/enrjsj/cheongyak-one/actions/runs/37593231452)도 성공했다. 로컬 문서 하네스 14개 증거는 `.harness/reports/2026-10-07T08-14-06-369Z-47610/report.json`이다.
- 결론: Git 자동 배포는 현재 정상 작동하며 코드/배포 설정을 수정하지 않고 복구됐다. 이전 `75a7d6f`의 배포 생성 단계 누락만 확인했으며 일시적인 이벤트 전달/처리 누락은 추정이다. 내부 이벤트 로그 403 때문에 정확한 원인은 미확정이고, 직접 API 권한 403의 해결을 의미하지 않는다.
- 이 운영 후속 기록은 원래 기능 worktree의 로컬 HANDOFF에 남긴다. 아직 미커밋인 공급기관 기능 파일 15개는 원문 그대로 보존돼 있으며 이번 운영 배포에 포함되지 않았다.

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
