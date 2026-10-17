# 사용자 흐름 통합 감사와 복구 UX

- 기준 main: `91737a0ec17948349c73a6d7909fbfff702dbd50`, branch `codex/user-flow-audit`.
- 목표: 통합 테스트와 사용자 관점 감사 후 검색·파일 저장·최근 기록의 막힌 경로를 개선한다.
- 제외: API/DB/인증 계약, 운영 설정, 실제 메일·AI·회원 데이터 쓰기. 테스트는 모의 API.
- 완료 기준: 0건에서 검색 수정/추가 페이지 조회, CSV 수식형 값 문자 보존, 실패한 다운로드 재시도, 유효 일정 없는 ICS 방지, 최근 공고 삭제 유지와 조회 실패 복구.
- 분업: root가 구현·테스트·공유 문서 소유. user_flow_audit/member_ux_audit가 동일 기준 읽기 전용 감사, user_flow_audit가 독립 리뷰. 작업자 쓰기·포트 사용·재귀 위임 없음.

## 변경

- App: 관심 검색·필터를 결과 분기 밖에 유지. 서버 전체 건수와 불러온 범위 내 일치 건수 구분. 0건에도 페이지 조회 가능.
- fileExport/comparisonTools: 공통 CSV 수식 방어(공백/BOM/제어문자 포함), 다운로드 DOM/URL 정리 및 WebKit 지연 해제. 관심 CSV는 서버에 저장된 값이며 조회/저장 중 비활성화.
- noticeTools: ICS 생성기와 동일한 유효 이벤트 판단. 뒤집힌 접수 기간은 제외하되 정상 발표일은 보존.
- 최근 공고: ID별 조회 실패 자리 유지, 삭제를 브라우저에 저장, 저장소 차단 안내, 재시도/재연결 복구/전체 삭제.
- React 검토: 입력 DOM 유지와 접근 가능한 상태 안내, 사용자 삭제 이벤트 안에서 저장소 변경. 신규 패키지 없음.

## 검증

- 기준 full extended: `.harness/reports/2026-10-17T11-57-20-701Z-27208/`. 하네스14·프런트 빌드/단위176·Chromium268·iPhone77 통과, PC전용3 제외. Java21/Maven 부재로 backend/auth-build/auth-browsers blocked.
- 관련 단위: `node --experimental-strip-types --test frontend/tests/file-export.test.mjs frontend/tests/comparison-tools.test.mjs` 10 통과.
- 관련 E2E: `IPHONE_TEST=1 npm --prefix frontend run test:e2e -- e2e/user-journey-resilience.spec.ts --project=chromium --project=iphone-webkit --workers=2`.
- 최초6시나리오×2브라우저12 통과. 추가 오프라인 fixture가 navigator.onLine을 변경하지 않은 실패2건은 모의 상태 수정 후 통과. 페이지 fixture의 잘못된24건 가정 실패2건은 실제 size12 요청 반영 후 `--grep 페이지` 양쪽2건 통과. 기대 결과/재시도/타임아웃 완화 없음. 쉘 grep 인용 오류1회는 테스트 미실행.
- 독립 리뷰의 페이지 경계1건 수정, 재리뷰에서 추가 차단 결함 없음.
- 최종 첫 시도 `.harness/reports/2026-10-17T12-13-32-936Z-28652/`는 다운로드 지연 cleanup의 string|undefined 타입 오류 발견 후 중단. URL을 상수로 캡처하여 수정, 타입 확인 후 최종 검증 재실행. 중단된 브라우저 결과는 통과로 합산하지 않는다.
- 최종: `node scripts/harness.mjs verify --base 91737a0ec17948349c73a6d7909fbfff702dbd50 --scope full --extended` 실행 후 결과 추가. 검증 중 파일 고정.
- 원격 필수 CI8개와 main SHA 운영 배포는 커밋/PR 단계에서 확인. 로컬 Java 부재를 통과로 처리하지 않는다.
- 최종 결과: `.harness/reports/2026-10-17T12-14-52-653Z-19760/` 하네스14·빌드·단위180·Chromium277·iPhone86 통과, PC전용3 제외. 타입 오류 수정 뒤 최종 앱 검사는 재시도 없이 통과. backend/auth-build/auth-browsers는 Java21/Maven 부재로 blocked. 실행 중 코드 변경 없음. 결과 기록만 추가한 뒤 docs 범위를 별도 검사한다.

## 남은 사용자 관점 개선 목록

| 우선순위 | 부족한 부분과 영향 | 다음 완료 기준 |
| --- | --- | --- |
| P2 | 소수 면적(59.5㎡ 등)이 정수 파서에서 유실되어 화면 조건과 API/공유 URL이 달라질 수 있음 | 입력/API/URL/최근검색/저장조건에서 같은 소수 정밀도 유지 |
| P2 | 미저장·실패 메모를 둔 채 새로고침/이탈 시 초안 소실 | 미저장 상태의 조건부 이탈 경고와 현재 화면 보존 한계 안내; 민감 메모 자동 영구저장 제외 |
| P2 | 실패 메모가 있는 관심 해제 후 재등록 시 오래된 초안/오류 재등장 가능 | 저장/폐기 선택, 서버 삭제 성공 뒤에만 해당 초안과 오류 정리 |
| P2 | 저장조건 편집 중 저장 요청 이후 추가 입력이 응답의 창 닫기로 사라질 수 있음 | 요청 중 입력 잠금 또는 revision 보존, 지연/실패 회귀 |
| P3 | 메모를 원래 값으로 되돌려도 미저장 표시가 남음 | 서버 값과 실제 차이 판정, 기존 ABA 저장 보호 유지 |
| P3 | 알림 설정 편집 후 닫을 때 미저장 변경을 알아채기 어려움 | 변경 표시와 폐기 확인, 실패 시 입력 유지 |

실제 iPhone 기기의 파일 앱/캘린더 가져오기는 WebKit 에뮬레이션 다운로드 성공과 별개이며 미검증이다. 운영 데이터 변경/실발송은 수행하지 않는다.
