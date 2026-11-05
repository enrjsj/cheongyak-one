# 관심청약 화면 압축·줄바꿈 복구

- 기준: `f5580e99a8838b02b4dc00f22bfd1abcccf8c1cd` (main), 시작 clean.
- 목표: 관심청약 진입 후 준비 현황/사전점검/필터/검색/일정이 겹치거나 한 글자씩 줄바꿈되지 않고 사용할 수 있다.
- 제외: 신규 기능, API/DB 변경, 카카오 발송, 운영 설정, 커밋·푸시·배포.
- 모드: single. 같은 CSS에 집중하는 순차 수정과 재현 검증으로 분업 이득이 없어 위임하지 않음.
- 변경: `frontend/src/index.css`, `frontend/e2e/favorite-layout-resilience.spec.ts`, 인계 기록.
- 원인: 여러 독립 영역을 포함하는 `.favorite-preparation-summary`가 단일 flex 행. 모바일만 column 지정되어 PC에서 폭을 압축함.
- 수정: 단일 열 grid와 자식 min-width:0. 모바일 검색 label 분리/입력 폭 확보, 사전점검 flex wrap, 일정 제목 다음 행/터치 영역. 모바일 필터 내부 가로 스크롤 유지.
- 회귀 테스트: 320/390/768/1024/1331/1440px, 저장/미저장 프로필, 다가오는 일정과 발표 확인 동시 노출. 실제 bounding box 폭/위치, 전체 페이지 넘침, 검색과 상태 필터, 사전점검 및 상세 열기 확인.

## 검증

- 변경 전: 시스템 Chromium 1331px 회귀 1개 실패. 기대 영역 폭934px 이상, 실제15.73px. `.harness/nov05-favorites/before.log`, `before/` 스크린샷/trace.
- 수정 후 관련 검사: 시스템 Chromium 6/6 최초 통과, 재시도0. `.harness/nov05-favorites/after.log`, `after/` 6개 스크린샷. PC1331/모바일320 시각 검토 정상. 긴 element 캡처에는 기존 고정 모바일 메뉴가 중간에 찍힐 수 있으며 실제 스크롤 배치와 구분함.
- 하네스 plan: 기준 f5580e9, 변경 범위 frontend. 최종 기준은 UI 변경에 맞춰 full --extended.
- 최종 검증 전 고정 대상: 앱·테스트·설정 전체 SHA256 기록 `.harness/nov05-favorites/frozen-code.json`.
- 최종 하네스: `PATH=/tmp/nov05-tools:$PATH node scripts/harness.mjs verify --base f5580e9 --scope full --extended`. 자체14·프런트230/빌드·백엔드220실행(실패0, PostgreSQL10제외)·인증JAR 빌드 통과. 보고서 `.harness/reports/2026-11-05T06-11-43-071Z-1848/report.json`. 표준 Chromium/WebKit 미설치로 전체 상태 **blocked**. 시스템 Chromium 보충을 iPhone WebKit 통과로 표기하지 않음.
- Maven은 기존 설치/로컬 캐시를 사용하는 작업용 wrapper를 `/tmp/nov05-tools/mvn`에 구성했고 오프라인 Java21 설정으로 실행. 저장소 빌드/CI 설정은 변경하지 않음.

## 인수인계

- 실제 iPhone WebKit/실기기, 운영 회원 데이터 화면 및 배포 미검증. 운영 쓰기 없음.
- 최종 검증 후 앱/테스트 변경 없이 결과 Markdown만 추가하고 docs 하네스를 별도 실행한다.

## 최종 보충 결과

- 시스템 Chromium 전체: `cd frontend && ./node_modules/.bin/playwright test --config ../.harness/nov05-favorites/playwright.config.ts --output ../.harness/nov05-favorites/final-browser-results --workers 2` → **347/347 최초 통과, 재시도0**, 9.2분. `final-browser.log`.
- 모바일 터치: 같은 명령에 `--config ../.harness/nov05-favorites/mobile.config.ts --workers 2 e2e/favorite-layout-resilience.spec.ts` → **6/6 최초 통과**, `final-mobile.log`. Chromium 터치 에뮬레이션이며 실제 iPhone/WebKit 검증 아님.
- 실제 Java/H2 인증: `./node_modules/.bin/playwright test --config ../.harness/nov05-favorites/auth.config.ts` → **1/1 최초 통과**, `final-auth.log`. 로그인/다른 탭/세션/CSRF/로그아웃·관심청약 저장 확인.
- 최종 앱·테스트·설정471파일 SHA256 동일 확인. 결과 기록 Markdown만 추가하고 docs 하네스 수행. 표준 하네스 blocked 상태와 미검증 범위를 유지함.
- 이번 수정은 로컬 완료. 커밋/푸시/PR/배포 및 외부 메시지 발송 없음.

## 원격 반영 승인 (2026-11-05)

- 사용자 커밋·배포 요청에 따라 원격 main과 검증 소스 동일성 재확인. 기존 로컬 전체 검사는 반복하지 않음. 배포 준비 문서만 갱신하고 docs 하네스 재검사.
- 최종 PR head CI 통과 후 main 병합과 Git 연동 자동 배포, 운영 release SHA/공개 응답 검증을 진행한다. 실제 결과는 PR/릴리스 증거에 기록한다.
