# 카카오 공고별 금액·면적 요약

- 기준 main `2437ab63ecb42db8f271282d19af191b66f84671`. 10월21일 본인 전용 카카오 및 10월23일 수신 조건 안내 미커밋 변경 보존.
- 요청: 공고별 발송 여부·수신 기준 설명, 공고명/대략적인 예산/평수 노출.
- 완료 기준: 공고별 선택 일정마다 별도 메시지, 저장된 금액·공급면적 범위 표시, 정보 누락/잘못된 값 명확히 구분, 다중 주택형으로 중복 발송되지 않음, Kakao text 200자 내 유지.
- 제외: 검색조건 기반 신규 공고 카카오 전송, 정식 알림톡, 운영 키/실제 발송/DB 변경, 커밋·푸시·배포.

## 구현과 분업

AGENTS auto에 따라 총괄이 저장소에서 구현·문서·검증을 직렬 수행하고 기본 서브에이전트 `kakao_summary_review`는 읽기 전용 독립 리뷰를 담당한다. 네이티브 역할 TOML 자동 실행으로 간주하지 않는다. 다른 작업자 쓰기/재귀 위임 없음.

- `KakaoSelfStore`: 기존 후보 필터는 유지, 저장 금액/category/rentType 및 `SUBSCRIPTION_NOTICE_UNIT_TYPE.SUPPLY_AREA` 양수 MIN/MAX 상관서브쿼리로 요약. 주택형 직접 join으로 후보가 늘어나지 않는다. DB/API 계약/migration 추가 없음.
- `KakaoSelfMessage`: 분양가/임대보증금/의미 미확정 임대 공고 금액 구분. 0원 유효, 누락/음수/역전/안전범위 밖 금액은 미확인. 한쪽 금액은 시작/최대 의미 보존. 억 단위 반올림은 약 표시. 공급면적을 3.3058로 나눈 약 평수(소수1자리); 전용면적/총예산으로 부르지 않는다.
- 제목 개행/제어문자를 정리하고 이모지 surrogate를 자르지 않는다. 전체 text 200 UTF-16 단위 이내 제목만 줄이며 상세 링크는 유지한다.
- 도움말에 공고×수신일정 발송, 메시지 내용, 검색조건은 미적용임을 명시한다. 금액과 면적은 독립된 공고 전체 범위, 추가비용 별도다.

## 검증 계획/기록

- 개발 중 `PATH=/tmp/oct23-tools:$PATH mvn -B -pl backend -Dtest=KakaoSelfMessageTest,KakaoSelfServiceTest test`: 26개 최초 통과(33.3초). 금액·면적·문자열 경계8개 및 기존/확장 서비스18개. `.harness/oct23-kakao-summary/targeted-backend.log`.
- PostgreSQL migration 통합 검사에 실제 후보 SQL 스키마/서브쿼리 파싱 검사를 추가했다. 미연결 소유자 상태의 빈 결과 검사이며 실발송/실제 데이터 매핑 검증은 아니다. 로컬 PG 미설치로 실행은 별도 미검증.
- 신규 도움말 PC/모바일 2개 최초 통과(14.7초): `./frontend/node_modules/.bin/playwright test --config .harness/oct23-kakao-summary/playwright.config.mts kakao-self-resilience.spec.ts --grep '연결 도움말'`. 표준 Chromium/WebKit 부재는 시스템 Chromium 보조 결과와 구분한다.
- 최종 전체/확장 하네스를 코드 고정 후 실행한다. 독립 최종 리뷰에서 금액/면적 의미·SQL·중복·문자열 길이·수신 조건의 추가 차단 결함 없음.
- 최종 `PATH=/tmp/oct23-tools:$PATH node scripts/harness.mjs verify --base 2437ab6 --scope full --extended`: 하네스14·프런트 빌드/단위182·백엔드200실행·인증JAR빌드 통과. PG10 제외. 표준 Chromium/WebKit 부재로 전체 상태 **blocked**. `.harness/reports/2026-10-23T02-53-26-466Z-6676/report.json`, 지문 `979fddbe360e04644c7bcb8dad9523b8d8e992cb39e57344c311389e05a8539e`. 실행 도중 소스 변경 없음.
- 실제 로컬 Java 로그인·CSRF·세션·다른 탭·로그아웃1개 최초 통과: `./frontend/node_modules/.bin/playwright test --config .harness/oct23-kakao-summary/auth.config.mts`. `.harness/oct23-kakao-summary/auth.json`, `auth.log`. 카카오 비활성 로컬 인증 검사로, 실제 Kakao OAuth를 뜻하지 않는다.
- 이번 묶음에 테스트 assertion 실패/재시도 통과는 없다. 도구 미설치는 미검증으로 구분한다. 이전 수신 조건 묶음의 페이지 생성 시간초과 기록은 이전 문서에 그대로 남긴다.
- 소스436파일 manifest `.harness/oct23-kakao-summary/frozen-source.json`의 canonical sorted JSON SHA256 `d5175d31b42249069fbd90124f6c98d0b6463dc00058698bf98189e50b2407ca`. 최종 검사 후 코드 동일성 확인, 결과 기록 Markdown만 갱신 후 docs 하네스로 마무리한다. 해당 보고서 경로·전체 보조 결과는 `.harness/oct23-kakao-summary/supplemental.json`에 보존한다.

## 인수인계

- 수신 기준은 관심 공고 + 저장된 수신 일정이다. 검색/추천/저장조건과 카카오 조건을 혼동하지 않는다.
- 실제 Kakao OAuth/기기 수신·운영 콜백 쿠키·PostgreSQL·표준 전체 Chromium/iPhone 미검증.
- 운영 반영과 실발송은 하지 않는다.
