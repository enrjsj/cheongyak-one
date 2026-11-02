# 맞춤청약·사전점검 품질 개선

- 기준: `dad539e721caf9002a4f58756682cc21fcca0b50` (최신 main fast-forward 완료, 시작 clean).
- 목표: 저장조건에 따른 추천 근거와 실제 공고 정보를 함께 제공하고, 사전점검을 답변별 준비자료·다음 행동으로 연결한다.
- 제외: 카카오 개선/발송, 운영 데이터 동기화, 자격 자동 판정, 새로운 개인정보 수집, API/DB 계약 변경, 커밋·푸시·배포.
- 완료 기준: 추천 조건과 화면 검색조건을 구분하고 누락 금액을 추정하지 않는다. 특별공급 미선택을 불이익으로 표현하지 않는다. 개별 답변 수정 시 다른 답변을 보존하고 실패 시 재저장할 수 있다. PC·모바일과 기존 인증/추천 회귀를 확인한다.

## 분업과 계약

- AGENTS auto에 따라 parallel. 호스팅 분업 도구에 로컬 역할 지침을 전달했다. 모델 설정 변경·재귀 위임 없음.
- eligibility 담당: `/workspace/cheongyak-quality-eligibility`, 기준 dad539e. eligibilityTools/EligibilityResults/전용 CSS/단위 테스트 소유.
- recommendation 담당: `/workspace/cheongyak-quality-recommendation`, 같은 기준. RecommendationPanel/전용 CSS/presentation helper/단위 테스트 소유.
- 총괄: App, 추천 서비스·관련 테스트, E2E, 기록·통합·포트를 사용하는 검사. 작업자 E2E/전체 하네스 금지.
- 기존 4답변 API 유지. 결과 컴포넌트 입력 answers/onEdit/disabled. 추천 패널에 저장 preference 선택 prop만 추가하며 서버 DTO 변경 없음.
- 검색 필터/점수 산식은 유지. 금액·면적 동시 조건은 기존 같은 주택형 매칭 규칙을 설명하며 금액만 설정한 경우 공고 범위 fallback을 고려한다.

## 구현과 검증

- 최신 GitHub commit 파일의 blob SHA와 전체 tree/서명 포함 commit SHA를 검증한 뒤 동기화했다. Git fetch 외부접속 제한으로 커넥터 읽기 사용. 사용자 변경 없음 확인.
- 하네스 계획: `.harness/nov02-quality/plan.json`. 초기 비승격 plan은 sandbox Git 실행 제한으로 실패했으며 동일 명령을 승인된 환경에서 실행했다.
- 관련 백엔드: MemberRecommendationServiceTest/NoticeMatchCriteriaTest 11개 최초 통과 (`backend-targeted.log`).
- 통합 관련 프런트 단위14개·TypeScript 통과. 기존 단위9개(81답변조합 포함)·추천표시5개.
- 관련 브라우저 17개 최초16통과/1실패(테스트 기대구분기호 ~와 기존 UI — 불일치). 기대값을 원래 포맷에 맞춘 후 관련3개 재검증 통과. 이는 재시도 옵션 통과가 아닌 테스트 기대값 수정 후 새 실행이다.
- 독립 리뷰: 차단 결함 없음. 추천 기준 버전 불일치 시 단순 추천재조회로 저장조건은 갱신되지 않는 안내 문제 발견→페이지 새로고침 안내로 수정. 삭제 실패/처리중 Escape·중복 입력 회귀 추가. React 스킬 체크: 결과를 순수 계산으로 분리, 불필요 상세 API fan-out 없음, 질문 단계 포커스·aria-pressed·44px 영역·상태 경계 확인.
- 실제 인증 E2E 기존 시나리오에 사전점검 개별수정→Java API 저장→나머지 답변 보존 검증 추가.
- 삭제·키보드·대비 관련 브라우저25개 최초 통과 (`browser-delete-accessibility.log`).
- 최종 고정본 `node scripts/harness.mjs verify --base dad539e721caf9002a4f58756682cc21fcca0b50 --scope full --extended`: 자체14·프런트230/빌드·백엔드220실행(PG10skip)·인증JAR 빌드 통과. 표준 Chromium/WebKit 미설치로 browser/iphone/auth-browsers **blocked**, 전체통과 아님. report: `.harness/reports/2026-11-02T07-36-43-666Z-49144/report.json`, worktreeChangedDuringRun=false.
- 같은 고정본 보완: `playwright test --config ../.harness/nov02-quality/playwright.config.ts --project chromium --workers 2` (frontend cwd): 시스템 Chromium341개 최초통과/재시도0(9.4분), `final-browser.log`.
- `playwright test --config ../.harness/nov02-quality/auth.config.ts --project auth-chromium`: 실제 로컬 Java/H2 인증1개 최초통과(17.7초). `final-auth.log`. 외부/운영 DB 없음. UI 수정 뒤 서버 GET으로 4답변 확인.
- `playwright test --config ../.harness/nov02-quality/mobile.config.ts --workers 2 --grep '사전점검 품질|맞춤청약 품질|맞춤 추천 전체 펼치기'`: 모바일 Chromium5개 최초통과(9.8초), `final-mobile.log`. iPhone WebKit 대체통과 아님.
- `frozen-code.json`과 `source-unchanged.json`: 문서 제외470파일 변경없음. 최종 소스는 기준dad539e+미커밋diff이며 별도새SHA 없음. 결과 기록만 갱신 후 docs 범위 하네스·diff-check 추가.
- 독립 후속 읽기 리뷰에서도 추가 차단없음. 테스트기대값 수정 이외 앱실패 없음. 실제 iPhone WebKit·PostgreSQL·실기기/스크린리더·운영 데이터/배포 미검증.
- 개발 중 doctor: Maven 기본PATH 미등록→기존 로컬 Maven wrapper PATH 사용. 모바일 config 복사 원본이 없어 동일한 시스템 Chromium 설정을 새로 작성. 초기 스크린샷 읽기는 다음 Playwright 실행의 결과폴더 정리와 겹쳐 실패했으며 이후 생성된 이미지로 시각검토. 검사 기준·timeout·재시도는 완화하지 않음.

## 한계

- 사전점검은 사용자 답변을 정리하는 도구이며 법정 자격·가점·당첨확률 계산이 아니다. 모집공고 기준일, 세대 범위, 증빙과 공급유형별 요건은 공식 공고 및 공급기관에서 확인해야 한다. 임의의 소득·혼인기간·예치금 수치 기준을 추가하지 않는다.
- 추천 전체 금액·면적 범위는 모든 주택형의 범위이며 개별 조건에 맞는 주택형/총필요현금을 뜻하지 않는다.
- 운영 외부 호출/실제 계정 데이터/실기기·보조기기/배포는 미검증. 카카오 변경 없음.

## 원격 반영 승인 (2026-11-02)

사용자가 커밋·푸시·배포를 승인했다. 최종 앱470파일 지문을 다시 대조해 동일함을 확인했고, 앱 검사는 반복하지 않는다. 기록 문서 검사 후 PR 최종 head의 CI8개 통과를 확인해 main에 병합한다. Vercel/Render 기존 GitHub 자동 배포 및 웹·직접API·프록시 revision/health/공고조회 검증을 수행한다. 결과는 릴리스 증거와 최종 보고로 남긴다.
