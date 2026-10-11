# 회원 기록 저장·비교 복구·인증 지연 경계

- 기준: main `24bd294ebfe1eaa35768fc84f742ab47d68ee9fb`, branch `codex/member-recovery-bundle`.
- 목표: 저장 지연/실패에도 작성 중 메모 보존, 비교 조회 실패의 명시적 복구, 인증 요청 중 중복/전환 방지, 비밀번호 재설정 후 회원 상태 초기화.
- 제외: 서버 API/DB/클라우드 설정 변경, 실제 메일·가입·재설정·AI·동기화 호출. 테스트는 전부 가짜 fixture/라우트.
- 완료 기준: 공고별 저장 순서 및 병렬 저장, 일반/결과 메모 ABA 편집 보존, 초기 tracker 조회 실패 시 안전 잠금 및 재조회, 비교 삭제/재시도/전체 해제(모바일 포함), 계정 scope 이탈 후 늦은 응답 무시.
- 위험: 인증 UI와 회원 상태 경계. API 계약 및 서버 인증은 변경하지 않음.

## 구현·분업

- AGENTS auto: 인증 대화상자 담당은 별도 `.codex-auth-recovery` worktree(동일 기준)에서 MemberDialogs와 auth-dialog-resilience 테스트만 작성. 총괄이 diff 검토 후 통합.
- 총괄: App/상세 컴포넌트/신규 메모 hook·입력 컴포넌트/CSS/회귀 테스트/문서. 테스트 포트4173은 총괄 단독 실행.
- 별도 읽기 전용 reviewer: 저장 큐·인증 경계 검토. ABA 문자열 동일성 오류와 초기 tracker 조회 전 전체 PATCH 위험 발견. 편집 revision 및 hydrate/ready/reload 보호로 반영.
- React 검토: 상태 업데이트는 기존 패턴의 함수형 setter, 저장은 이벤트에서 실행, 계정 scope ref로 오래된 작업 격리. 초안은 메모리에만 보관(새로고침 영구 보관 기능 아님).
- 같은 공고 쓰기는 직렬, 다른 공고는 병렬. PATCH는 최신 확정 tracker 위에 변경 필드만 합성한다. 저장 실패 시 초안을 보존하고 명시적 재저장을 제공한다.
- 비교 실패 ID도 목록에 표시하고 개별 삭제/재조회/전체 해제 제공. 모바일에 숨겨졌던 항목을 가로 스크롤로 표시한다.

## 검증

- 초기 빌드 통과.
- 신규 인증4개 시나리오 × Chromium/iPhone =8개 최초 통과.
- 신규 복구 테스트 초기: 모바일 비교 항목 숨김 확인 후 CSS 수정. WebKit 프로그램적 fill만으로 초점이 보장되지 않아 실제 사용자 클릭 후 입력으로 재현 변경. 준비 상태 select는 role/접근성 이름으로 정확히 선택. 기대값·시간 제한·재시도 완화 없음.
- 관련 재검증: `IPHONE_TEST=1 npm run test:e2e -- e2e/member-recovery-resilience.spec.ts --project=chromium --project=iphone-webkit --workers=2`:16개 통과. 같은 입력 A→B→A, 서로 다른 공고 동시 저장, 실패 후 재저장, 320px, 로그아웃 지연, 비교 실패 복구, 비밀번호 재설정 늦은 bootstrap 포함.
- 최종 전체: `node scripts/harness.mjs verify --base 24bd294ebfe1eaa35768fc84f742ab47d68ee9fb --scope full --extended`: 하네스14/단위176/빌드/Chromium268/iPhone77 통과(PC전용3 제외). 최종 통합본은 재시도 없이 통과. 보고서 `.harness/reports/2026-10-11T11-54-19-829Z-23948/report.json`. Java21/Maven 부재로 backend/auth-build/auth-browsers는 blocked이며 필수 원격 CI에서 확인한다.
- 최종 검사 후 변경은 결과 기록 Markdown만 추가. 앱·테스트 코드는 고정하고 docs 검사를 추가한다. 독립 재리뷰 추가 결함 없음; 로그아웃 테스트도 완료 UI 확인 후 지연 응답을 반환하도록 순서를 강화했다.
- 최종 PR head 필수 CI 및 병합 후 web/API/proxy 동일 SHA 배포 검증은 원격 반영 단계에서 확인한다.

## 인수인계

- 이전 PR #138 main `24bd294`는 CI8개 통과 및 운영 web/API/proxy 동일 SHA 확인 완료(이전 HANDOFF의 기록 시점 미실행 상태를 보완).
- 사용자 기존 승인에 따라 이번 묶음도 최종 검증 후 커밋·PR·CI·병합·기존 자동 배포를 진행한다. 실제 운영 회원 쓰기나 설정 변경은 하지 않는다.
- 새로고침/탭 종료 이후 미저장 초안 복원은 이번 범위 밖이다.
