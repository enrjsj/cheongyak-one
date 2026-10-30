# 대출·이자·월 상환액 예상

- 기준: main `bfb9df0`. 기존 미커밋 Supabase 운영 문서/HANDOFF 보존.
- 목표: 간편 현금 계획에서 대출을 가정한 현금 부족액과 월 상환 부담을 함께 판단한다.
- 기본 예시: 공급금액70%와 부족자금 중 작은 대출액, 연4.5%,30년 원리금균등. 실제 금리·LTV·승인액으로 표시하지 않는다. 대출액/금리/기간/상환방식 직접 수정, 초기화 제공.
- 원금균등 첫달·마지막달, 총이자·총상환액, 첫달 원금/이자, 금리1%p상승 비교. 계약금 부족액은 입주대출과 분리한다. 중도금이자·세금·옵션·수수료·심사 조건은 미반영.
- 제외: API/DB/실제상품조회/대출자격판정/금융정보전송·영구저장/기존 상세 비교·내보내기에 새 가정 자동합산.

## 분업

- 총괄: UI/CSS/브라우저 검증/문서·통합.
- 계산 담당: `/workspace/cheongyak-loan-math` 별도 worktree, 신규 loanEstimate.ts/단위테스트만. 현재cashPlan API를 변경하지 않는 독립 계약 후 통합.
- 독립 reviewer: 통합본 읽기 검토만. 브라우저/하네스는 총괄 직렬 실행.

## 검증

- 순수 계산27개(신규13+기존14) 및 TypeScript/Vite 빌드 통과.
- 신규 브라우저: PC1440/모바일320 및 CI iPhone390 경로에서 자동금액/직접수정/원금균등/0금리/오류/초과현금/주택형변경/전체초기화/overflow 검증.
- 개발 중 브라우저13개 통과 후 독립 리뷰의 모드 전환 입력보존/Enter 오류초점/소수금리 표시 권고 반영. 관련+접근성22개 통과. 화면 확인 후 기존 부족액을 '대출 반영 전 부족 자금'으로 바꿔 새 대출 후 현금과 구분, 회귀검사도 정확한 새 제목을 확인하도록 갱신.
- 최종 고정본 `PATH=/tmp/oct29-tools:$PATH node scripts/harness.mjs verify --base bfb9df03f6f85888b9841d3a19eb89071b38efbc --scope full --extended`: 하네스14·프런트 빌드/단위210·백엔드200실행(PG10제외)·인증JAR빌드 통과. 표준 Chromium/WebKit 부재로 전체blocked. 보고서 `.harness/reports/2026-10-29T09-05-20-332Z-33048/report.json`.
- `frontend/node_modules/.bin/playwright test -c .harness/oct29-loan/playwright.config.ts --project=chromium --workers=2`: 시스템 Chromium 전체333개 최초 통과/재시도0(8.6분). 기존 검색/회원/알림/계산·비교 흐름과 신규대출 PC·모바일 포함. `full-chromium.log` 및 `test-results/` 화면 증거. 최종 읽기 리뷰 추가차단없음.
- 최종 소스445파일 지문 `.harness/oct29-loan/frozen-source.json` 불변 확인. 결과 기록만 추가하고 문서 하네스로 마무리. 앱 전체 검사와 별도로 실제 iPhone WebKit/실제인증브라우저/PostgreSQL/운영배포는 미검증. 검사 assertion/재시도/시간제한 완화 없음.
- 추정치의 원단위 표시는 반올림하며 실제 금융기관 일할계산/반올림/실행일 차이는 미반영. 다음 단계별 지출 계획/상세모드와 새 대출가정은 독립적이며 화면에 명시.
- 원격 반영/실제기기·스크린리더/실제 금융상품 조건은 미검증.
- 현재 로컬 구현이며 commit/push/앱 배포는 수행하지 않았다. 기존 운영 Supabase 보조 예약 문서는 보존했고 이번 계산기 변경에서 DB/운영 설정을 수정하지 않았다.
