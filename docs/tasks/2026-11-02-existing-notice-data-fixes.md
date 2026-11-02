# 기존 공고 수집·가격 표시 보완

- 기준 커밋: `74187016e71d14e5349b7f5192c2102b96c5909c` (PR #149), 시작 clean.
- 목표: 기존 오피스텔 타입·분양가 누락과 빈 응답 시 목록/상세 가격 불일치를 수정하고 수집 상태를 정확히 안내한다.
- 제외: 신규 수집처·상품·지도·알림 기능, AI 활성화, DB/API 스키마 변경, 운영 환경변수 변경, 실제 동기화·발송.
- 완료 기준: 공식 필드의 오피스텔 타입/가격/전체 공급을 보존하고, 자료 없음·매핑 실패·수집 미설정을 구분한다. 빈 응답으로 기존 정상 가격을 지우지 않는다.

## 근거와 수정

- 공식 명세: https://infuser.odcloud.kr/api/stages/37000/api-docs (`getUrbtyOfctlLttotPblancMdl_model`, 2026-11-02 공개 JSON 조회).
- 서비스 안내: https://www.data.go.kr/data/15098547/openapi.do
- 오피스텔은 `MODEL_NO`, `TP`, `SUPLY_HSHLDCO`, `SUPLY_AMOUNT`(만원)를 제공한다. 기존 APT mapper는 타입과 가격 필드가 달라 행을 제외했다. API의 `EXCLUSE_AR`는 전용면적이며 기존 공급면적 계약에 혼입하지 않는다. 청약신청금을 분양가 대체값으로 쓰지 않는다.
- `RebApiGateway`: 오피스텔 mapper 분리. 식별 불가 행은 성공/빈 결과로 버리지 않고 예외 처리하여 기존 수집 실패 집계로 전달한다. 테스트용 RestClient.Builder 주입을 지원하며 운영 기본 생성 방식은 유지한다.
- 두 `Reb*UnitTypeSyncService`: 실제 빈 응답이면 기존 주택형·가격을 변경하지 않는다. 유효 자료가 있으면 기존 정상 갱신을 유지한다.
- `SourceFreshnessPanel`, `App`: 기존 현황에 주택형 미확인·실패·수집 미설정을 표시한다. API의 FRESH는 설정된 소스의 공고 수집 시각 기준이며 자료 완전성을 뜻하지 않는다.
- 운영 공개 조회 시 아파트 130건 중 가격 124건, 오피스텔 30건 중 가격 0건, 마이홈 미설정을 확인했다. 최근 오피스텔 23건의 주택형 빈 결과는 확인했지만 인증된 원본 API 응답을 직접 조회하지는 않았다. 수정 후 실제 자료 보충 여부는 동기화 이후 별도 확인 대상이다.

## 분업

- auto: 총괄 구현 + 독립 읽기 조사/리뷰. 같은 파일 병렬 작성 없음.
- backend_analysis: 공식 API 규격·기존 매핑 조사, 파일 쓰기/테스트 없음. 최종 공식 Swagger JSON 확인은 총괄 수행.
- frontend_analysis: 고정된 변경의 독립 리뷰, 파일 쓰기/테스트 없음.
- 공유 문서·구현·테스트·원격 통합은 총괄 소유. 사용자 설정 상속, 재귀 위임 없음.

## 검증

- 회귀 테스트: 공식 규격의 가짜 오피스텔 응답, 만원→원·미확인 가격, 전용/공급면적 분리, 필수 식별자 누락, 실제 빈 응답, APT/오피스텔 기존 자료 보존 및 정상 갱신.
- UI 회귀: 최신 공고 + 주택형 빈 결과 + 미설정 소스, 수집 실패/비활성 구분, 좁은 화면.
- 개발 중 `npm run build`: 통과. 기존 단일 JS 번들 500 kB 경고는 유지한다.
- 로컬 준비: Java 21/Maven 3.9.11 설치, 상속 HTTP proxy와 CA 신뢰를 사용. 초기 Maven은 proxy 미설정으로 이름 해석 실패하여 실행 환경만 보완했다.
- Playwright 기본 Chromium 다운로드는 ZIP 대신 195바이트 HTML 응답으로 실패했다. 브라우저 버전/검사를 낮추지 않고 로컬 브라우저 검증은 미검증으로 남긴다.
- 관련 백엔드 `mvn -B -ntp -U -pl backend -Dtest=RebApiGatewayTest,RebUnitTypeSyncServiceTest,NoticeSyncServiceTest,NoticeFreshnessServiceTest test`: 27개 통과, 실패/오류/제외 0. 모의 외부 API 및 저장소로 실행했다.
- 독립 읽기 리뷰: 차단 결함 없음. 공급면적 미확인 유지, 실제 자료 보충은 후속 수집 필요, 현황 건수는 최근 실행 기준이라는 한계를 확인했다.
- 최종 `node scripts/harness.mjs verify --base 74187016e71d14e5349b7f5192c2102b96c5909c --scope full --extended`: 하네스 14개, 프런트 220개/빌드, 백엔드 217개 실행 통과(PostgreSQL 10개 제외). Chromium/iPhone/실제 인증 브라우저는 도구 부재로 blocked. auth-build는 이전 실행의 임시 proxy 주소를 재사용해 연결 실패하여 하네스 전체 결과는 failed로 보존한다.
- 실행 환경의 proxy 설정을 현재 상속값으로 다시 생성하여 `mvn -B -ntp -U -pl backend -DskipTests package`만 보충 실행했고 JAR 빌드 통과했다. 설정 XML namespace 보정 전 한 차례 추가 환경 실패도 있었으며 앱 소스 변경은 없었다. 전체 테스트를 불필요하게 반복하지 않았다.
- 보고서: `.harness/reports/2026-11-02T01-22-04-638Z-5/report.json`, 고정본 지문 `d808350852ddace0d418d4ff44d97296e25239362d2bca7ed240e019c90dfcb5`, 실행 중 변경 없음. 이후 수정은 결과 기록 Markdown뿐이다.
- 로컬에서 미검증인 브라우저·PostgreSQL 및 실제 데이터 계약은 최종 PR head의 기존 CI8개로 확인한다. 원격 결과·배포 SHA는 PR과 완료 보고에 기록하며 결과 기록만을 위한 재배포는 하지 않는다.

## 남은 확인

- 마이홈 `MYHOME_API_KEY`의 운영 반영 상태와 해당 서비스 승인 여부 확인 필요. 이번에는 비밀값 조회/입력/교체 없음.
- 오피스텔 가격·타입은 수정 배포 후 기존 정기 동기화 또는 별도 승인된 재수집이 필요하다. 배포 성공과 데이터 보충 성공을 구분한다.
- 전용면적의 별도 저장/표시·필터 의미 확장은 이번 수정 범위 밖이다. 공급면적에 잘못 대입하지 않는다.
- Git/배포: 기존 승인 범위에서 PR 최종 head CI 성공 후 squash merge. 실제 결과는 PR 및 완료 보고로 확인한다.
