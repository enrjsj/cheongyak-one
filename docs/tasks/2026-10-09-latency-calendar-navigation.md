# API 대기·날짜 일관성·탐색 복원

- 기준 커밋: e4ef6d25989b274371a8ddea60a7968cecd25887
- 목표: 사용자 요청 1~3번을 묶어 초기 요청 경합, 캘린더 날짜 오류, 뒤로가기 조건 손실을 보완한다.
- 제외: DB/auth/API 계약/서버·CI 설정/운영 쓰기/알림·AI 유료 호출. 클라우드 자원 변경 없음.
- 위험: 프런트 비동기 요청 순서·브라우저 이력 및 ICS 이벤트 제외.
- 완료 기준: 실패 중 목록 요청은 선택한 탭만; 성공 후 사전 캐시 사용 유지; 잘못된 일정으로 ICS 예외/보정 날짜가 생기지 않음; 검색 이력의 예산·면적 복원 및 관심 상세 닫기 유지.

## 분업·변경

- 실행 모드: 독립적인 API/날짜 읽기 전용 감사 병렬 → 총괄 직렬 구현 → 고정 diff 리뷰. 런타임 기본 서브에이전트 사용, 모델 상속·재귀 위임 없음.
- GitHub 원본 기준이며 로컬 프로젝트/사용자 파일을 생성하거나 덮어쓰지 않는다. 쓰기 담당은 총괄 한 명, 별도 codex 브랜치 사용.
- App.tsx: 사전 요청을 현재 목록 성공 뒤로 이동; popstate 범위 필터 복원·동일 검색에서 관심 목록 보존.
- noticeTools/favoriteCalendarTools: 일반·관심 캘린더 날짜와 역전 기간 검사. notificationTools/NotificationsDialog: 잘못된 알림 날짜 표시 방어. 정상 날짜 및 원본 데이터 불변.
- scripts/measure-public-api.mjs: 최초 health 및 정상 이후 목록/건수 각2회 순차 GET; 인증/응답 본문/입력 URL은 결과에 저장하지 않음; bounded timeout·health 실패 후 중단. 진단 표본은 cold start나 DB 병목의 확정 근거가 아님.
- 기존 캘린더 query fixture는 접수 시작이 종료보다 늦어 신규 유효성 규칙과 충돌했다. 의도한 월/검색 판정을 유지하면서 정상 기간으로 수정한다. assertion 완화 없음.

## 검증

| 구분 | 명령/방법 | 결과 |
| --- | --- | --- |
| 로컬 준비 | Get-Location | helper_unknown_error: setup refresh had errors, 프로세스 시작 불가 |
| 관련 단위 | node --experimental-strip-types --test frontend/tests/notice-tools.test.mjs frontend/tests/favorite-calendar-tools.test.mjs frontend/tests/notification-tools.test.mjs frontend/tests/public-api-timing.test.mjs | 로컬 미실행 |
| 관련 브라우저 | npm --prefix frontend run test:e2e -- e2e/resilience.spec.ts --project=chromium | 로컬 미실행 |
| 최종 | node scripts/harness.mjs verify --base e4ef6d25989b274371a8ddea60a7968cecd25887 --scope full --extended | 로컬 미실행/보고서 없음 |
| 승인된 원격 | 최종 PR head 기존 CI 8개 작업 | 결과는 PR/CI로 확인, 성공 전 병합 금지 |
| 운영 | 병합 SHA 기존 Git 배포·verify-deployment 워크플로 | 결과는 PR에 기록 |

- 단위 회귀: 잘못된/부분/역전 날짜, 윤년·연말·한국 자정 기존 검사, 표시/ICS 일치, 알림 날짜 미확인, 측정 순서·실패·timeout·입력 보호.
- 브라우저 회귀: 지연된 취소 응답 격리, 첫 실패 중 사전 요청 억제/성공 후 탭 캐시 표시, 뒤로/앞으로 예산·면적·검색어 복원, 관심 상세 닫기와 초점 유지. Chromium/iPhone 기존 resilience 경로에서 실행.
- 수정 중 전체 검사를 반복하지 않는다. 변경/기록을 모아 PR 생성 후 전체 CI; 새 실패는 원인 확인 후 수정.
- 실제 운영 측정, 실제 기기 Safari·스크린리더, DB 내부 지연 분석 미실행. 백엔드 알림의 Asia/Seoul/LocalDate 사용은 코드 확인이며 역전 일정의 발송 정책 변경은 포함하지 않는다.
