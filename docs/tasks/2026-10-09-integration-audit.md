# 사용자 흐름 통합 점검 및 복구 개선

- 기준 커밋: 4a87984f31e308428c36ec1657dee01e61656613
- 목표: 전체 기존 회귀 증거를 확인하고 로딩/캐시/최신성의 사용자 중단 경로를 보완한다.
- 제외: API/인증/DB/배포 설정, 운영 회원/데이터 쓰기, 동기화/AI/외부 알림 호출.
- 변경 경로: App.tsx, SourceFreshnessPanel.tsx, noticePageCache.ts, 캐시 단위/공통 resilience E2E, HANDOFF/본 문서.
- 완료 기준: 초기 목록 대기 중 320px 필터로 새 검색 가능; 늦은 이전 응답이 최신 검색을 덮지 않음; 잘못된 동기화 시각에도 목록·재검색·소스 현황 유지; 잘못된 캐시 폐기 후 정상 목록 복구.
- 위험: 화면/공통 캐시. API 계약·인증·migration 변경 없음.

## 분업

총괄 단일 쓰기, integration_audit 읽기 전용 감사 후 고정 변경의 독립 리뷰. 사용자 정의 역할 로딩은 주장하지 않으며 기본 서브에이전트 사용. 기준/지침을 전달했고 재귀 위임·테스트 실행·원격 쓰기는 금지했다. 로컬 저장소는 사용자 요청대로 만들지 않고 격리 GitHub 브랜치를 사용한다.

## 기준 증거

[main CI](https://github.com/enrjsj/cheongyak-one/actions/runs/37882449553)의 8개 작업 성공. 단위151, Chromium245, iPhone54, 실제 로그인2 최초 통과. 일반 backend153와 격리 PostgreSQL8 통과. iPhone PC전용3 제외, 일반 backend에서 PG전용8 제외는 별도 PG 성공과 구분한다.
[운영 검증](https://github.com/enrjsj/cheongyak-one/actions/runs/37882884903) 성공. 이전 대화의 배포 미확인 상태는 이 후속 결과로 해소되었다. 이는 새 변경의 결과가 아니다.

| 범위 | 검증 경로 | 상태 |
| --- | --- | --- |
| 검색/필터/탭/페이지/공유/뒤로가기 | 기존 Chromium 및 resilience | 기준 CI 성공, 새 head CI 필요 |
| 상세/관심/비교/일정/현금계획 | 기존 E2E와 단위 | 기준 CI 성공, 새 head CI 필요 |
| 오류/오프라인/캐시/지연응답 | 기존 + 신규 resilience 3개 | 새 head CI 필요 |
| iPhone 모바일·접근성 | iphone-webkit 프로젝트 | 기준54 최초 통과, 새 head CI 필요 |
| 실제 Java 로그인·세션 | auth-browsers | 기준2 통과, 새 head CI 필요 |
| API·H2·PostgreSQL·수집계약 | backend/postgres/real-data | 기준 성공, 새 head CI 필요 |

## 구현과 검증

- 개발 중 대상 명령: `node --experimental-strip-types --test frontend/tests/notice-page-cache.test.mjs`; `npm --prefix frontend run test:e2e -- e2e/resilience.spec.ts --project=chromium --grep "지연된 목록|동기화 시각|캐시 복구"`.
- 최종 대상: `node scripts/harness.mjs verify --base 4a87984f31e308428c36ec1657dee01e61656613 --scope full --extended`.
- 로컬 명령 실행기는 프로세스 생성부터 `helper_unknown_error: setup refresh had errors`로 차단. 위 명령/plan은 미실행이며 로컬 보고서 없음. 스킬 파일 읽기도 같은 제약으로 실패해 직접 코드 검토와 기존 CI로 대체한다.
- 사용자 기존 커밋/PR/병합/배포 승인 및 이번 개선 요청에 따라 코드·테스트·문서를 고정한 PR의 전체 필수 CI로 검증한다. 새 head에 이전 결과를 재사용하지 않는다.
- 검토 대상은 로딩 중 filter disabled 제거, 캐시 syncedAt 파싱, App·SourceFreshnessPanel 안전 표시 및 신규 회귀다. 원인 불명 기존 iPhone 초기 모달 timeout을 해결했다고 주장하지 않는다.
- CI/최초 통과/재시도/미검증/병합·배포 결과는 해당 PR에서 확인한다. 결과 기록만을 위한 추가 커밋을 만들지 않는다.

## 남는 제한

실제 기기 Safari·스크린리더·전체 WCAG 감사, 운영 관리자/회원 데이터 쓰기, 실제 알림/AI 호출은 수행하지 않는다. Date가 파싱 가능하게 자동 보정하는 timestamp까지 엄격한 달력 검사하는 변경은 아니다. 운영 데이터 정합성 전체 보장과 UI 회귀 통과는 구분한다.
