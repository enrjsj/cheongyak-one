# 탐색 조작 통합과 관심목록 조건 분리

- 기준 HEAD: `c7281833698c327bbde1217d37769dd576aeb888`, branch work. 10월19일 자동 이동·빠른 검색 제거 등 미커밋 변경을 보존하고 이어서 수정했다. 시작 diff는 `/tmp/oct20-start.patch`에 보관했다.
- 목표: 중복 필터 제거, 선택 조건 확인/해제의 단일화, 검색·관심목록의 명확한 역할과 복귀/더보기 유지.
- 제외: API/DB 계약·지도 키·배포/인프라·계정 설정·실발송. commit/push/배포는 하지 않는다.
- 완료 기준: 320/390/768/1000/1001/1440px에서 검색어 입력만 있는 상단과 필터 진입점 한 곳, 키보드/모달 초점 복원, 값이 있는 조건 칩/복원, 일반 검색 조건에 가려지지 않는 관심 공고·마감/추가 페이지, 빈관심 복귀 및 늦은 목록 갱신 방지.

## 감사와 구현

- auto 판단: 총괄 단일 쓰기 + 기존 reviewer 읽기 전용 UX 감사/최종 리뷰. `.codex/agents/cheongyak_reviewer.toml` 지침을 전달했다. 재귀 위임/작업자 테스트/동시 포트 실행 없음. 읽기 전용 공유 checkout이며 모든 코드·문서는 총괄 소유.
- 상단 지역·유형 select 삭제. PC 왼쪽에 기본 필터·상세조건 진입을 모으고 <=1000px에서는 목록 도구의 필터 버튼만 노출한다. 숨긴 중복 버튼은 접근성 트리에서도 제외된다. 사이드바 진입도 모달 닫기 초점을 보존한다.
- 조건 요약 문단을 없애고 칩에 실제 예산·면적 값을 표시한다. 칩은 줄바꿈해 전체 초기화가 가로 스크롤 밖으로 밀리지 않는다. 개별 해제·전체 초기화·되돌리기는 기존 상태/URL/API 계약 유지.
- 사이드바의 중복 초기화 삭제. 모달의 좁은 초기화는 '필터 초기화'로 명시하고 검색어·상태는 보존한다. 모달 조건은 기존처럼 즉시 반영됨을 안내한다. 검색어 지우기 후 입력 초점을 유지한다.
- 관심조회는 일반 검색 조건과 분리해 저장ID·고정 최신순·페이지 크기만 전송한다. 마감 공고도 표시한다. 공용 facets/검색 URL은 일반 조건을 유지하며 관심조회와 섞이지 않는다. 관심뷰에 작동하지 않는 일반 필터·공유 조작은 숨기고 일반 탐색 복귀를 제공한다.
- 관심보기에서는 공용 상태 탭 선택 강조/aria-selected를 끄고 일반 탐색으로 돌아오면 복원한다.
- 관심 진입/복귀에서 일반 검색어·지역·가격·면적·상태·정렬을 보존한다. 빈 관심목록 CTA도 같은 정책. 실제 목록 요청 키가 바뀔 때만 목록/더보기/재시도 상태를 리셋해 관심뷰에서 일반 검색어를 편집해도 추가 페이지를 잃지 않는다.
- 독립 리뷰 발견: 숨은 일반필터, 초기화 범위 차이, 빈관심 복귀 조건 소실, 일반 검색어 편집 시 관심 추가 페이지 소실. 모두 반영. 마지막 리뷰는 앱 추가 확정 결함 없음, 목록250ms 지연을 넘긴 회귀 검사 보강 권고를 Playwright clock으로 반영.
- React 검토 기준으로 파생 상태를 추가 저장하지 않고 요청 키를 계산하며, API/인증 계약·라이브러리 변경 없이 기존 상태/모달/취소 로직을 재사용한다.

## 개발 중 관련 검증

- TypeScript 검사 통과. `node scripts/harness.mjs plan --base c728183` 범위 확인.
- 기존 탐색/이동14개 최초 통과(46.9초). 새 테스트 파일 생성 명령의 cwd 오류로 첫 실행에는 기존14개만 포함됐다. 신규는 정상 경로에 작성 후 별도 실행.
- 신규9 + 기존 범위/검색복구8 =17개 중16통과/1실패(1.2분). 신규 검사에서 ID가 쉼표 구분 query라고 잘못 가정했다. 실제 기존 API는 반복 `ids`이므로 `getAll('ids')` 기대값으로 수정했다. 구현 계약 변경/검사 완화 없음.
- 해당 관심검사와320/1440 화면3개 재검증 통과(14.7초). 리뷰 보완 후 관심 조건/더보기 및 빈관심 복귀2개 통과(20.5초). 타이머 경계를 보강한 모바일 터치14개 통과(1.8분). 최종 관심탭 강조 보완 이전 결과와 구분한다.
- PC/모바일 스크린샷 확인. 모바일 필터 텍스트 줄바꿈을 발견해 최소 폭과 nowrap으로 보완했다.

## 최종 검증

- 코드 고정 뒤 full extended 하네스 및 시스템 Chromium 보조 검사를 직렬 수행한다. 새 코드에는 과거 테스트 통과를 적용하지 않는다.
- 환경: 표준 Playwright Chromium/WebKit 미설치, 시스템 Chromium 사용 가능. Maven 별도 설치·기존 캐시를 offline 사용, JDK ct.sym 부재는 invocation의 source/target21로 보완한다. 저장소 테스트·빌드 설정 변경 없음.
- 첫 고정본435파일 manifest SHA256 `b825057e08ca97054a12118d2fbef94f58d780cb57e40966adf5b17bf3308e33`, 하네스 fingerprint `337b20b1e41f339ede9f0d2ac3ecbe036ee7eeb7b2253c1b0482dcb6a9d8f2af`. 보고서 `.harness/reports/2026-10-20T04-40-48-056Z-17062/report.json`.
- 첫 full extended: 하네스14·빌드/단위182·백엔드161실행(PostgreSQL10제외)·인증JAR빌드 통과. 브라우저3단계는 표준 Chromium/WebKit 부재로 blocked(exit2), 실행 중 파일 변경 없음.
- 첫 고정본 시스템 Chromium 전체312개 시도: 26통과/1실패/1중단/284미실행(1.9분). 계정 경계 favorites403 로그아웃 테스트가 첫 page.goto에서30초 초과했고, fail-fast1로 중단했다. max-failures는 실패 기준을 완화하지 않고 발생 즉시 진단하기 위한 설정. global-timeout15분/retries0. trace `.harness/oct20-full-browser-failure/`, 로그 `/tmp/oct20-full-browser.log`. 중단된200 재로그인과 실패403 로그아웃2개를 workers1에서 단독 실행해2통과(16.1초). 환경 부하 가능성은 있으나 원인을 확정하지 않았다. 전체 완주로 해석하지 않는다.
- 첫 고정본 실제 로컬 Java 인증1개 통과(서버 포함34.1초, 테스트11.6초). 운영 계정/실발송과 무관하다.
- 이후 최종 UI 점검에서 관심보기에도 보존된 일반 상태탭 강조가 남는 모순을 발견했다. class/aria-selected에 !savedOnly를 적용하고 관심보기 선택0개/탐색 복귀 선택복원 검사 추가. 독립 검토 추가 결함 없음. 관련 관심·빈목록·키보드3개 통과(18.7초). 앱 코드가 달라졌으므로 두 번째 고정본으로 full extended를 다시 수행하며 첫 고정본 결과를 새 코드의 전체 통과로 사용하지 않는다.
- 두 번째 고정본435파일 manifest SHA256 `378f9c53712ee45a84de386c2081687df9b60000617e98e7ea588b16e61bc3d3`, 하네스 fingerprint `767259c911d10a7e68cc306e1fab32f4ae76f6d7fc5979909ebba787b7dde558`. 보고서 `.harness/reports/2026-10-20T04-49-54-754Z-20409/report.json`.
- 두 번째 full extended(13:49:54~13:51:37 KST): 하네스14·빌드/단위182·백엔드161실행(PostgreSQL10제외)·인증JAR빌드 통과. 표준 브라우저 미설치 단계는 blocked(exit2), 실행 중 작업트리 변경 없음. 기존 페이지 로딩 시간초과 원인을 확정하지 못했으므로 동일 환경의 전체312개 보조 반복은 하지 않고 영향받는 UI/모바일/실제 인증을 최종본에서 좁혀 확인한다. 전체 회귀 완주 상태로 보고하지 않는다.
- 최종본 시스템 Chromium UI39개 최초 통과(2.1분): 접근성15·기존 탐색5·이동9·신규 정리10. 모바일 터치 Chromium6개 최초 통과(18.7초). 실제 로컬 Java 인증1개 최초 통과(서버 준비 포함30.7초, 테스트11.1초): 로그인·새로고침·다른 탭·CSRF·로그아웃 보호. retries0, 기대값/timeout 완화 없음.
- 최종본 전체312개 완주 및 WebKit은 여전히 미검증이다. 관련 UI39/모바일6 통과를 전체 성공으로 대체하지 않는다. 정상 Playwright 환경 또는 승인된 원격 반영 시 필수 CI에서 나머지 범위를 확인해야 한다.
- Markdown 제외435파일의 목록/해시가 최종 고정 manifest와 일치함을 검증했다. 보조 로그·임시 설정·스크린샷·manifest 및 `supplemental.json`을 최종 보고서 디렉터리에 보관했다. 이후 기록 문서만 변경했다.
- WebKit/실제 모바일 Safari·스크린리더·운영 계정/공공 API/실발송/원격 CI·배포는 미검증. PostgreSQL10개는 별도 테스트 DB가 없어 제외되며 DB 변경은 없다.


### 재현 명령 및 인수인계

- 하네스: `PATH="/tmp/oct20-tools:$PATH" node scripts/harness.mjs verify --base c728183 --scope full --extended`.
- 아래 Playwright 명령은 frontend cwd, 임시 설정은 최종 보고서 폴더에도 복사했다. 전역 제한15분과 fail-fast는 첫 오류 이후 진단용이며 테스트 assertion/30초 개별 제한은 변경하지 않았다.
- 전체 시도: `./node_modules/.bin/playwright test -c /tmp/oct20-chromium.config.mts --workers=2 --max-failures=1 --global-timeout=900000`.
- 최종 UI: `./node_modules/.bin/playwright test -c /tmp/oct20-chromium.config.mts accessibility.spec.ts explore-design.spec.ts explore-navigation-resilience.spec.ts explore-simplification-resilience.spec.ts --workers=2 --max-failures=1`.
- 최종 모바일: `IPHONE_TEST=1 ./node_modules/.bin/playwright test -c /tmp/oct20-mobile.config.mts explore-simplification-resilience.spec.ts --workers=2`. 프로젝트는 mobile-system-chromium이며 WebKit이 아니다.
- 최종 실제 인증: `./node_modules/.bin/playwright test -c /tmp/oct20-auth.config.mts`.
- 다음 안전한 작업: 최종 변경의 전체 Chromium/iPhone 회귀를 정상 브라우저 환경에서 완주. 별도 승인 전 원격 작업 없음.

- 문서 마무리: `node scripts/harness.mjs verify --base c728183 --scope docs` 하네스14개 통과(2.4초), 보고서 `.harness/reports/2026-10-20T04-56-25-579Z-24000/report.json`. 코드 동일성을 확인한 후 문서만 검사했으며 앱 전체 결과를 대체하지 않는다. `git diff --check` 통과.

## 후속 검증 — 사용자 `진행` 요청

- 2026-10-20 05:14~05:23 UTC. 단일 작업으로 실패 증거 진단과 브라우저 검증을 진행했다. HEAD/미커밋 앱·테스트 코드435파일은 두 번째 고정 manifest와 일치한다. 구현이나 테스트 기대값을 변경하지 않았다.
- 앞선 favorites403 실패 trace: 화면 모듈34개 응답 미완료, Icon.tsx 수신4.26초. 화면 조작 이전의 로딩 지연이며 특정 API/필터 결함으로 단정할 수 없다. `.harness/oct20-serial-diagnosis.json`에 추출 근거 보관.
- 환경 관측 revision227/current/enforced. CPU quota4, 메모리 한도16GiB, shared memory8.9GiB. OOM/oom_kill0. 이 값은 지연 원인을 입증하지 않는다. 기본 PATH의 Maven은 없고 이전 별도 설치/오프라인 wrapper가 유지된다. 표준 Chromium/WebKit은 여전히 없으며 시스템 Chromium을 사용한다.
- 변경한 실행 조건: workers2→1로 동시 브라우저 부하를 줄이고 이전 실패를 포함한 core-flows 파일163개를 먼저 실행. Vite/개별30초 제한/기대값/retries0 유지. 임시 설정만 사용했으며 저장소 설정을 바꾸지 않았다.
- frontend cwd 명령: `./node_modules/.bin/playwright test -c /tmp/oct20-serial.config.mts core-flows.spec.ts --max-failures=1`. 결과72통과/1실패/90미실행,454.8초. fail-fast 때문에 기타149개는 시작하지 않았다. JSON의 skipped90은 fail-fast에 따른 미실행이지 의도적 test.skip이 아니다.
- 실패: core-flows.spec.ts:1117 알림함 재진입 조회 오류 시나리오. 재진입 오류를 유발하기 전 openMemberInbox의 첫 알림 버튼 클릭에서30초 제한 초과. 회원 버튼 확인 단계 및 셸 로그 조회도 지연되고 클릭 호출/정리가 제한 시간보다 늦게 끝났다. 원인은 여전히 미확정이며 동시 작업 수만으로 해결되지 않았다.
- 좁은 진단: 새 프로세스에서 `./node_modules/.bin/playwright test -c /tmp/oct20-isolated-final.config.mts core-flows.spec.ts --grep '알림함 재진입 조회 실패'` →1통과(14.0초, 테스트11.0초). 불안정한 최초 실행과 별도 통과를 구분한다. timeout/expect/retries 완화 없음.
- 로그·설정·doctor·manifest는 `.harness/oct20-followup/`, 첫 실패 trace는 `.harness/oct20-serial-core/`, 결과 JSON은 `.harness/oct20-serial-core.json`과 `.harness/oct20-isolated-final.json`. 앞선 실패 artifact는 덮어쓰지 않았다.
- 근본 원인을 해결하지 못했으므로 AGENTS의 실패 반복 금지에 따라 전체 반복을 멈춘다. 전체312개 및 WebKit/iPhone은 미검증 유지. 다음 조치는 정상 Playwright 환경에서 전체 Chromium/iPhone 실행, 원격 반영이 승인되는 경우 최종 head의 기존 CI 확인이다. 사용자에게 전체 통과/배포 완료로 보고하지 않는다.
- 후속 문서 검증: `node scripts/harness.mjs verify --base c728183 --scope docs` 통과(4.3초), `.harness/reports/2026-10-20T05-23-51-203Z-28250/report.json`. 코드435파일 동일성 및 `git diff --check` 확인. 이후 이 결과만 기록했다.

## 원격 반영 승인

- 후속 사용자 요청 `커밋 푸시 배포까지 해줘`에 따라 원격 반영 범위를 승인받았다. 앞선 로컬 전용 범위는 당시 작업 기록이다.
- 기존 main `c728183`과 현재 기준이 일치함을 GitHub에서 확인했다. 10월19일/20일 변경을 한 브랜치·PR에 묶고, 최종 head의 CI8개 통과 후 squash 병합한다. main 연동 Vercel/Render 자동 배포 후 웹·API·프록시 revision과 읽기 전용 smoke를 확인한다.
- 기존 로컬 시간초과/표준 브라우저 미설치 기록은 삭제하거나 성공으로 바꾸지 않는다. CI 및 배포 증거는 PR 본문과 `.harness/oct20-release/`에 기록하며 로그용 추가 커밋은 만들지 않는다.

### CI에서 발견한 테스트 동기화 보완

- PR #143 첫 head `bccc8eaaadfceba9de67fcff330e8f5e45a7abfd`, CI #348/run39375735386. 전체 Chromium312 최초 통과(8.1분), 단위182·실제 인증 Chromium/WebKit2·백엔드161실행·PostgreSQL10·하네스·인프라·실데이터 job 성공. iPhone은114통과/1실패/1재시도통과/PC전용3제외로 실패했으므로 병합하지 않았다.
- 키보드 검사에서 최소5회 스크롤 기대에 실제2회: App의 의도된 rAF 취소/최종 선택 이동과 달리, 테스트는 이미 결과 위치에 있어 위치 assertion이 즉시 통과하고 다음 키가 이전 프레임을 취소했다. 첫 click/각 key 뒤 실제 새 scroll 호출을 expect.poll로 기다리도록 보강했다. 기존 >=5/instant/focus/geometry 유지, aria-selected도 추가했다.
- 빈 캘린더 안내 검사 재시도 통과: CI trace에서 관심 진입 click 완료348250.643ms 직후 calendar click 시작348251.206ms, 고정 status tabs가 두 차례 포인터를 가로챘다. 토스트 자동 소멸 때문이라는 증거는 없다. 관심뷰 준비 helper에 ids=1,2 응답·공고2개·결과위치 정렬 확인을 추가해 이동 도중 후속 조작 경합을 분리했다. 실제 클릭/빈일정 안내/다운로드0 검사는 유지한다.
- 읽기 전용 reviewer가 원인·두 diff를 독립 확인했다. 앱/서버/빌드/CI 설정은 변경하지 않았다. expectation/timeout/retries 완화 없음. trace `.harness/oct20-release/ci348-calendar-trace.zip`, CI 원본 로그/보고서는 위 run에 보관된다.
- 보완 후 관련 로컬 PC/모바일 Chromium 검사 및 문서 하네스를 확인하고 새 head로 기존 CI8개 전체를 실행한다. WebKit 최종 통과는 새 CI에서 확인하며 이전 실패는 기록에 보존한다.
- 관련 로컬 검사10개 최초 통과(57.1초, PC5+모바일 터치Chromium5): 두 파일의 키보드·CSV/캘린더 생성 실패·수식 메모·빈일정 검사를 실행했다. 임시 `/tmp/oct20-ci-fix.config.mts`, grep `연속 키보드|유효한 일정|생성 실패|수식형`, workers1/retries0. WebKit을 대체한 결과로 보고하지 않는다.
- 문서 하네스14개 통과(3.1초), `.harness/reports/2026-10-20T05-47-42-692Z-30227/report.json`. `git diff --check` 통과. 앱 소스는 첫 head와 동일하며 새 테스트 소스의 전체 검증은 새 head CI에서 수행한다.
