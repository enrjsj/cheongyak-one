# 알림 설정 이탈·메모 원복 보호

- 기준 커밋: `ae838c282dbe2c67fb22d54a1fa09ccfe070202c` (PR #141 CI8 및 동일 SHA 운영 배포 확인).
- 목표: 알림 설정 유실 방지, 원래 값으로 되돌린 메모의 불필요한 저장/이탈 경고 제거.
- 제외: API/DB/인프라 변경, 실제 발송/AI 호출, 초안 영구 보관.
- 변경 경로: NotificationsDialog.tsx, useFavoriteTrackerWrites.ts, 관련 E2E, HANDOFF/이 기록.
- 완료 기준: 닫기/공고 이동 취소 시 입력 유지와 읽음 요청0; 실패 후 재시도; 메모 idle 원복은 요청0, 실패/대기 중 원복은 초안 유지.
- 위험: 회원 화면의 이탈 정책. 서버 인증/CSRF 계약 변경 없음.

## 구현과 검증

### 분업 결정

- auto: 총괄 단일 작성 + 기본 서브에이전트 읽기 전용 독립 리뷰. 로컬 TOML 역할을 자동 로드했다고 간주하지 않는다.
- 작업 공간: `.codex-work-mobile-quality`, branch `codex/unsaved-settings-bundle`, 위 기준 SHA. 총괄이 앱/테스트/공유 문서를 소유한다. reviewer는 같은 고정 미커밋 변경을 읽고 수정·테스트·재귀 위임하지 않는다.
- 총괄+reviewer 최대2명. 포트4173 E2E는 총괄만 직렬 실행한다.
- 기존 API 입력/출력 유지. 서버 확인된 9개 boolean만 알림 dirty 비교하며 updatedAt은 제외한다.

### 구현 계약

- 알림 조회/저장 성공 응답을 기준으로 보관. 초기 조회 실패는 기존 편집 잠금을 유지하며 기본값을 서버값으로 간주하지 않는다.
- 설정/알림함 탭 전환은 초안 유지이므로 확인 없이 허용. 닫기 버튼/Escape/배경 및 알림 읽음 요청 전에 폐기 확인. 취소 시 서버 읽음 요청도 보내지 않는다.
- 저장 중 Escape도 잠근다. 이전에 Escape로 저장 중 창을 닫을 수 있던 테스트를 새 명시 정책으로 변경하고 401 실패 후 재열기 복구를 유지한다. 읽음 지연 후 닫힌 창 응답 차단 테스트는 그대로 유지한다.
- dirty/저장 중 beforeunload 등록. 저장 성공 후 재편집하면 오래된 성공 안내를 숨긴다. 실패는 선택값/기준을 보존한다.
- 독립 리뷰가 찾은 읽음 PATCH 대기 중 새 설정 입력 유실 경계는 9개 체크박스 잠금으로 차단. 초안 유무 두 회귀 추가 및 재리뷰 결함 없음.
- 메모 원복은 ready + 해당 공고 큐 없음 + 실패 불확실성 없음 + raw문자열이 최신 서버값과 정확 일치할 때만 해당 초안 제거/no-op. trim비교·응답 후 일괄정리는 하지 않는다. 실패 후에는 서버 반영 여부를 추정하지 않고 재저장을 유지한다. 기존 revision/ABA/계정 scope 유지.
- React 스킬에 따라 확인·원복은 이벤트 처리, effect는 브라우저 이벤트 구독/해제에 사용한다.

| 항목 | 명령 또는 확인 방법 | 결과/증거 |
| --- | --- | --- |
| 개발 중 관련 브라우저 | member-recovery-resilience + notification-draft-resilience, Chromium/iPhone | 최초38 통과 |
| 리뷰 보완 후 관련 브라우저 | notification-draft-resilience, Chromium/iPhone | 10 통과(추가한 이동 지연 경계 포함) |
| 기존 알림 회귀 | core-flows --grep 알림, Chromium | 20 통과 |
| 타입/공백 | tsc -b / git diff --check | 통과 |
| 최종 검증 | `node scripts/harness.mjs verify --base ae838c282dbe2c67fb22d54a1fa09ccfe070202c --scope full --extended` | 하네스14·빌드·단위182·Chromium293·iPhone102 최초 통과(PC전용3 제외). backend/auth-build/auth-browsers는 Java21/Maven 부재로 blocked |
| 원격 반영 | 최종 head CI8 → squash → Vercel/Render 동일 SHA | 기존 사용자 승인 범위, 검증 후 진행 |

## 인수인계

- 실제 기기 강제 종료·OS 종료의 beforeunload/초안 보존은 보장하지 않는다. 테스트는 합성 이벤트 handler 및 모의 API 흐름이다.
- Java21/Maven 부재의 로컬 서버/실제 인증은 blocked로 구분하며 원격 필수 CI를 유지한다. 운영 쓰기/실발송은 제외.
- 다음 후보: 알림 설정 현재 변경사항 명시적 되돌리기, 미저장 상태 표시의 접근성 점검. 저장 결과가 불명확한 실패를 임의로 성공 취급하지 않는다.

### 최종 증거

- `.harness/reports/2026-10-17T14-40-34-728Z-27524/report.json`: 위 base/head의 미커밋 지문 `81e14a877a44565eae2f56d2d8d70241fb55d77094460e1558cf5a077b7f161e`.
- 결과 기록 이후 앱/테스트/빌드 설정 불변, 문서만 추가 검사. 로컬 blocked와 원격 CI 성공 여부를 구분한다.
- 최종 PR/CI/배포 SHA·공급자 상태는 PR 및 무시된 하네스 release-result에 남긴다. 로그용 추가 커밋/재배포 없음.
