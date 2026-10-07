# 청약한눈 프로젝트 맥락

확인일: 2026-10-07 (Asia/Seoul). 작업 시작 기준 main: `3b6540e1f7c36f78144946f2116cbae42f0f4a17` (PR #124).

## 문서 확인

작업 시작 시 저장소와 상위 작업 디렉터리에 AGENTS.md, PROJECT_CONTEXT.md, HANDOFF.md가 없었다. 이 문서는 README, docs, 실제 코드와 운영 응답을 근거로 새로 작성했다. 별도의 AGENTS 지침을 읽었다고 간주하지 않는다.

## 현재 구조와 기능

- React 19 + TypeScript + Vite 프런트엔드, Java 21 + Spring Boot + JPA API, Flyway 마이그레이션.
- 공개 서비스: https://cheongyak-one-five.vercel.app/ 및 https://cheongyak-one-api.onrender.com/actuator/health. GitHub main 연동 Vercel·Render 자동 배포를 사용한다. 저장소의 AWS 배포 가이드는 대안 구성이다.
- 청약홈 아파트·오피스텔, 마이홈 공공임대를 수집하고 검색·필터·일정·상세·주택형 비교를 제공한다. 회원 관심 공고·메모·알림·맞춤 추천·자금 계획 등의 기존 기능을 유지한다.
- 탐색 UI는 흰색과 파란색 중심, 사진 없는 정보 카드, PC 사이드 필터·모바일 조건 창이다. 접수중·접수 예정·마감 임박 표시와 카드 본문 상세 열기, 별도 북마크·비교 영역까지 구현돼 있다.
- 날짜 판단은 Asia/Seoul 기준이다. 무료 Render 기동 지연은 기존 재시도·최근 목록 캐시로 대응한다.

## 이번 개발

공급기관을 상세 클릭 전부터 표시한다. 저장된 `SubscriptionNotice.businessEntityName`을 목록 요약 API에 추가하며 DB 변경이나 공고별 상세 자동 조회는 없다. 목록 필드가 없는 구버전 응답은 수집 시각이 같은 상세 캐시만 보조로 사용한다. null·공백은 미확인 안내를 유지하고 출처 포털명을 공급기관으로 추정하지 않는다.

## 검증과 배포

표준 명령은 `npm --prefix frontend test`, `npm --prefix frontend run test:e2e`, `mvn -B -pl backend test`다. iPhone WebKit은 `IPHONE_TEST=1`과 `--project=iphone-webkit`, 실제 세션 검증은 `frontend/playwright.auth.config.ts`를 사용한다.

CI의 frontend, iphone, auth-browsers, backend, postgres, infrastructure, real-data를 확인한 뒤 main에 병합한다. 배포는 `node scripts/verify-deployment.mjs <웹 origin> <API origin> <main SHA>`로 웹·API·프록시의 동일 리비전과 응답을 확인한다. 실행 환경별 제한과 실제 결과는 HANDOFF.md에 기록한다.

## 다음 후보 (우선순위 제안)

1. 공급기관 데이터 누락 비율을 수집 소스별로 측정하고 원본에 값이 있는 경우의 매핑 누락을 점검한다. 공급기관을 임의 추정하지 않는다.
2. 탐색 카드·상세의 접근성 자동 검사 범위를 확대한다. 현재 키보드·초점 복원·터치 회귀 테스트에 더해 의미 구조와 대비를 점검한다.

후보는 이번 작업에서 완료한 기능이 아니며, 다음 작업 시 실제 데이터와 요구를 다시 확인한다.
