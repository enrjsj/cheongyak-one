# 소수 면적·미저장 입력 보호 묶음

- 기준 커밋: `c65b823c17c7ef306874d44895c6d48a39992b3a` (PR #140 CI8 및 동일 SHA 운영 배포 확인).
- 목표: 소수 면적 검색 유지, 메모 이탈 경고, 관심 해제 실패 시 초안 보존, 저장조건 요청 중 추가 입력 보호.
- 제외: API/DB 계약·운영 설정 변경, 실발송/AI 호출, 메모의 브라우저 영구 저장.
- 변경 경로: frontend/src의 App/RangeFilter/noticeTools/rangeFilterTools/FavoriteMemoInput/useFavoriteTrackerWrites, 관련 단위/E2E, HANDOFF와 이 기록.
- 완료 기준: 입력·API·URL·최근 검색·저장조건의 면적 일치, 취소 시 회원 API 미호출, 삭제 실패 시 메모 유지, 저장 중 편집 잠금과 실패 후 복구.
- 위험: 인증 요청 전 사용자 확인 UI 변경. 서버 인증/CSRF 구현은 변경하지 않음.

## 구현과 검증

### 분업 결정

- auto: 총괄만 공유 소스를 수정하고 면적/회원 입력을 두 독립 읽기 전용 reviewer에게 위임. 같은 clone의 고정된 변경을 재검토하며 파일 쓰기/테스트 실행은 위임하지 않는다.
- 기준/작업 공간: 위 SHA의 `codex/input-preservation-bundle`, `.codex-work-mobile-quality`. 총괄이 앱·테스트·문서 및 통합을 소유한다.
- API 계약: 기존 BigDecimal 면적 API 유지. 화면은 0~1000, 소수 둘째 자리까지 허용하고 정수 예산 정책은 유지한다. 서버에 소수 자릿수 제한을 추가한 것은 아니다.
- 최소 면적 0은 기존 의미대로 제한 없음(undefined)으로 통일한다. 최대 0 및 역전 범위는 잘못된 입력이다. 독립 리뷰에서 발견한 0의 URL/API 불일치를 수정하고 회귀 테스트를 추가했다.
- 테스트 포트 4173은 총괄이 직렬 사용. 최대 총괄+읽기 전용 리뷰어2, 재귀 위임 없음.

### 변경 내용

- 소수 면적을 반올림하지 않고 필터/API/URL/최근 검색/저장조건에 전달한다. `60.` 같은 편집 중 값은 raw draft로 보존하되 제출을 차단한다.
- 메모 초안/진행 중 저장이 있으면 beforeunload 경고를 등록한다. 로그인·로그아웃·비밀번호 변경/재설정·탈퇴 전 명시 확인을 받고 취소 시 API를 호출하지 않는다. 이미 보낸 저장 요청은 취소되지 않으며 기존 계정 scope 응답 차단을 유지한다.
- 관심 해제 전 초안 폐기 확인. 서버 성공 시에만 해당 공고 초안/오류를 제거하며 실패와 다른 공고 초안은 유지한다. 해제 중 상세 입력 및 저장 경합을 차단한다.
- 저장조건 요청 중 fieldset/닫기/Escape 편집을 잠그고 실패 시 소수 원문을 유지한다.
- React 리뷰 스킬에 따라 사용자 확인/초안 정리는 이벤트 처리로 구현하고, effect는 beforeunload 구독/해제에만 사용한다.

| 항목 | 명령 또는 확인 방법 | 결과/증거 |
| --- | --- | --- |
| 개발 중 단위 | `node --experimental-strip-types --test frontend/tests/range-filter.test.mjs frontend/tests/notice-tools.test.mjs` | 초기 관련16 통과; 0 경계 보완은 최종 전체 검사에 포함 |
| 개발 중 브라우저 | member-recovery-resilience 및 input-preservation-resilience, Chromium/iPhone WebKit | 초기26 통과. 추가 시나리오 포함34 중30 통과/4 선택자 실패 |
| 실패 후 좁은 재검증 | `--grep 미저장.확인` 양 브라우저 | 오류 안내가 여러 개여서 발생한 strict locator 충돌을 정확한 취소 문구 대상으로 수정. 4/4 통과; 앱 오류를 숨기는 완화 아님 |
| 독립 리뷰 | 회원/면적 읽기 전용 검사 | 회원 blocking 결함 없음. 면적0 경계 수정 및 회귀 추가 |
| 최종 검증 | `node scripts/harness.mjs verify --base c65b823c17c7ef306874d44895c6d48a39992b3a --scope full --extended` | 하네스14·빌드·단위182·iPhone95 최초 통과(PC전용3 제외). Chromium285 통과/문구 기대값1 실패. Java/Maven 부재로 backend/auth-build/auth-browsers blocked |
| 최종 검사 후 좁은 재검증 | `IPHONE_TEST=1 npm --prefix frontend run test:e2e -- e2e/core-flows.spec.ts --grep 관리.수정 --project=chromium --project=iphone-webkit --workers=2` | 기존 “최솟값” 부분 일치 검사를 공통 검증의 “최소값은 최대값보다 클 수 없습니다.” 정확 일치로 보완. 해당 Chromium1 통과; 이 파일은 iPhone 대상 아님. 입력90 보존/API0 단언 유지. 앞선 복합 grep 명령은 쉘 인용 오류로 미실행 |
| 원격 반영 | 최종 head CI8 → squash merge → 동일 SHA 공개 응답/공급자 상태 | 사용자 기존 승인에 따라 검증 후 진행. 로그용 추가 커밋 없음 |

## 인수인계

- beforeunload 검사는 합성 이벤트의 취소 여부/등록 해제 검증이다. 실제 iPhone Safari 강제 종료·OS 종료에서 경고나 초안 보존을 보장하지 않는다. 메모는 현재 화면에만 남는다.
- Java21/Maven 부재로 로컬 백엔드/실제 인증 검증은 차단될 수 있으며 필수 원격 CI로 구분해서 확인한다.
- 다음 안전한 후보: 원래 값으로 되돌린 메모의 dirty 최적화(ABA 저장 경합 보존 필수), 알림 설정 미저장 이탈 보호.
- 최종 검증 및 배포 결과는 아래 기록과 PR/무시된 하네스 release-result에 구분한다.

### 최종 대상과 증거

- 보고서: `.harness/reports/2026-10-17T12-57-25-333Z-2876/report.json`, baseline/head는 위 기준 SHA, 미커밋 지문 `c422b92a9a07c4d7de99bcdbfe6b2b9225c2d9e2f6b27d54b1b1a31008cecf64`.
- 전체 검사 이후 앱/빌드 설정은 불변. core-flows 테스트 기대 문구 한 줄과 결과 문서만 변경했다. 전체 로컬 성공으로 표현하지 않고 1 실패 및 좁은 재검증을 구분하며, 최종 PR head 전체 CI는 생략하지 않는다.
- 회원 독립 리뷰와 면적0 수정 후 재리뷰에서 추가 blocking 결함 없음. 실제 기기 강제 종료, 운영 데이터 쓰기/실발송은 미검증/제외.
