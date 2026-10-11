# 모바일 접근성과 상세 확인 정보 묶음

- 기준 커밋: d589ef66e1ab6bdf2d1748d6161abab7a6a330eb (PR #134 병합)
- 목표: 모바일 검색 가독성·닫기 터치 영역·상세 키보드 순환 개선, 최신 상세 응답의 미제공/확인 필요 항목 안내.
- 제외 범위: DB/API/인증/배포 설정 변경, 운영 데이터 쓰기, 실제 AI/알림 발송, 품질 점수·수집 실패 추론.
- 변경 경로: frontend/src, frontend/tests, frontend/e2e/accessibility.spec.ts 및 인수인계 문서.
- 완료 기준: 320px에서도 안내·닫기 사용 가능, 키보드가 모달 안에서 순환, 로딩 중 품질 오인 없음, 기존 필수 CI 성공.
- 위험: 공통 모달 훅 회귀. API 계약·migration 변경 없음.

## 구현과 검증

- 실행 모드: 구현 single + 독립 읽기 전용 quality_audit. 감사자는 수정/테스트/재위임 없이 같은 기준 소스를 검토. 총괄만 공유 clone에서 쓰고 E2E를 직렬 실행.
- 검색 입력 16px, 닫기 44px, 긴 제목 줄바꿈. 숨김/disabled/inert/음수 tabindex 제외, summary 포함, 모달 루트에서 Tab 복구.
- 공급기관·접수기간·가격 범위·분양 주택형의 확인 항목. 최신 상세 성공에만 렌더링하며 별도 API 호출 없음. 공공임대 주택형 누락 경고 제외. 주택형별 부분 수치 검사는 이번 범위 밖.
- 음수/비유한 금액 및 역전 가격 범위는 정상 금액으로 표시하지 않는다. 0원은 유효.
- 개발 중 단위 13개 통과. 접근성 Chromium 11개 중 새 검사 1개는 대비 helper의 최소 텍스트 수 제한으로 실패; 검사 대상을 패널에서 전체 dialog로 확대하고 해당 시나리오 통과. 기존 assertion 완화 없음.
- 최종 검증: `node scripts/harness.mjs verify --base d589ef66e1ab6bdf2d1748d6161abab7a6a330eb --scope full --extended`. Java21/Maven 미설치로 로컬 전체 검증 제약 예상. 프런트 빌드/단위/Chromium/iPhone은 별도 실행하고 실제 결과를 PR에 기록한다.
- 원격: 기존 승인에 따라 최종 변경을 커밋/PR, 최종 head의 필수 CI 성공 후 병합 및 동일 SHA 운영 검증. 로그만으로 재배포하지 않는다.

## 인수인계

- 실제 iPhone 기기·스크린리더·운영 회원 동작은 미검증. WebKit 에뮬레이션과 구분한다.
- 기존 npm audit high 2건: Vite 8.0.13 개발 서버 Windows 경로 처리 및 source-map-js. 이번 UI 변경으로 유입되지 않음. 개발 서버는 loopback만 사용하고 별도 의존성 보안 업데이트 묶음으로 처리한다.
- React 스킬 체크: 파생 정보는 순수 함수, 추가 state/effect/네트워크 없음, native details/summary와 모달 포커스 고려.
- 최초 전체 WebKit은 60 통과/1 실패/PC전용 3 제외. 지연 목록에서 필터를 닫을 때 초점 복원 실패: 필터 열기 버튼이 터치 시 자동 초점을 전제로 했으므로 상세 버튼과 동일하게 열기 전에 명시적 focus를 적용한다. 실패 시나리오 반복 검증 후 통합본을 다시 검증한다. 분양가 조사 문구도 교정한다.
- 로컬 하네스 최초 실행은 npm PATH 및 Java/Maven 부족으로 blocked; npm은 임시 npm 실행 환경에서 제공하여 최종 프런트 검증을 수행한다. 백엔드·실제 인증·PostgreSQL은 최종 PR head CI 증거로 구분한다.
- 수정 후 최종 결과: 빌드·단위165, Chromium252, iPhone WebKit61 통과/PC전용3 제외, 하네스 자체 검사 통과. 보고서 `.harness/reports/2026-10-11T05-50-17-800Z-14528/report.json`. full extended 전체 상태는 Java21/Maven 미설치로 blocked이며 전체 성공으로 표시하지 않는다. npm exec가 임시 Node26.11.1을 선택했으므로 저장소 기준 Node22 검증은 원격 CI에서 확인한다. 결과 기록만 추가한 뒤 앱 파일 동일성과 docs 검사를 확인한다.
