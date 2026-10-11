# 공고 정보 정확성 묶음

- 기준 커밋: `233e3dd39c66b4bb7a51cc7673124cd23338f971`
- 목표: 통합 감사의 임대 분류/가격 안내, 정밀 비교, 최대금액 부분 정보, 주택형 필터 유효성 4항목 해결.
- 제외: DB/migration/저장값 수정, 공급원 금액 의미 추론, 운영 쓰기/동기화/실발송/AI 호출, 클라우드 설정, 별도 감사 항목의 구현.
- 완료 기준: 임대 아파트가 분양 검색에서 제외되고 임대 검색에 포함됨; 작은 가격 차이/연도 차이가 비교에서 드러남; 유효한 최대금액/0원을 보존; 잘못된 수치에 일치 배지가 붙지 않음.
- 위험: 목록 summary API 필드 추가, 공급방식 검색 의미 변경. 기존 housingCategory와 enum/저장 조건은 유지.

## 분업과 계약

- auto parallel: backend SQL/메모리/DTO/회귀는 `accuracy_backend`, frontend/API TS/공유 문서/통합은 총괄.
- backend worktree `.codex-accuracy-backend`, 총괄 `.codex-work-mobile-quality`, 동일 기준 SHA. backend 5파일을 총괄 diff 검토 후 apply_patch로 통합(신규 단위 파일 포함).
- 원문 nullable `rentType`을 요약에 추가. 임대는 PUBLIC_RENTAL 또는 rentType에 임대 포함. 분양은 APT/OFFICETEL에서 임대 제외. title/housingDetailType 추론 금지.
- 청약홈 임대 금액을 보증금으로 단정하지 않고 `공고 금액`으로 안내. 캐시 v3는 구형 목록 재사용 방지.
- SQL 가격 정수성은 기존 NUMERIC(18,0), 메모리는 BigDecimal 정수성과 0..9007199254740991 검사. 조건 없는 unit 필드는 무시, 주택형 없는 공고의 기존 fallback 유지.
- `accuracy_review`는 통합본 읽기 전용 독립 리뷰. 역할 TOML 내용을 작업 지시로 전달. 동시 테스트 포트는 총괄만 사용, 재귀 위임 없음.

## 검증

- 독립 리뷰 P2: 공급 방식이 민간임대까지 포함하는데 공공임대로 표시하던 명칭을 `임대`로 수정(주택 카테고리 공공임대는 유지), 예산 안내도 공고 금액으로 정리. rentType 캐시 오염/null/구버전 격리 회귀 추가. 관련 18개 통과.

- 개발 중 관련 단위 33개 통과, TypeScript/Vite 빌드 통과.
- Chromium 신규 모바일 정확성 2시나리오 통과(임대 목록→상세→계산기, 정밀 비교표).
- 최초 샌드박스 npm 실행은 EPERM으로 테스트 시작 전 차단. 승인된 기존 런타임 실행으로 검증.
- 최종 전체: `node scripts/harness.mjs verify --base 233e3dd39c66b4bb7a51cc7673124cd23338f971 --scope full --extended` 실행. `.harness/reports/2026-10-11T10-49-42-980Z-30604/report.json` 지문과 실행 중 파일 불변 확인. 하네스14·타입/빌드·단위176 통과. Chromium253 통과/3실패, iPhone63 통과/2실패/PC전용3제외. 실패5개는 모두 변경 전 공급 방식 버튼명 `공공임대`를 찾는 테스트 기대값이었다.
- 이후 앱/서버 코드는 유지하고 accessibility.spec.ts 기대값 한 곳을 `임대`로 수정. `IPHONE_TEST=1 npm run test:e2e -- e2e/accessibility.spec.ts --project=chromium --project=iphone-webkit --workers=2` → 27통과/PC전용3제외, 재시도 없이 통과(41초). 최초 실패와 수정 후 통과를 구분하며 최종 head 전체 검증은 기존 CI에서 수행한다.
- 독립 리뷰 P2 수정 재확인 완료, 추가 확정 결함 없음. 결과 기록 이후 앱 코드 변경 없음.
- Java/Maven 미설치: 로컬 backend/H2/PostgreSQL/실제 인증은 미검증. 원격 CI 필수 검사로 확인 후 병합.
- 원격 반영: 사용자의 기존 커밋·PR·병합·배포 승인 범위. 최종 head CI와 동일 main SHA의 웹/API/프록시 검증 필요.

## 남은 범위

- 실제 iPhone 기기와 화면 읽기 도구, 운영 쿼리 성능은 별도 확인 대상.
- 메모 저장 경계, 실패한 비교 목록 복구, 인증 UI 상태/지연 요청 등 이전 감사의 다른 항목은 후속 묶음.
