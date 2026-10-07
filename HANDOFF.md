# 작업 인계

## 2026-10-07 공급기관 첫 화면 표시

### 시작 상태와 범위

- 요청된 AGENTS.md, PROJECT_CONTEXT.md, HANDOFF.md는 저장소와 상위 작업 디렉터리에 없었다. README·설계 문서·코드를 확인하고 PROJECT_CONTEXT와 이 파일을 신규 작성했다.
- 작업 시작 시 로컬·원격 main은 PR #124의 `3b6540e1f7c36f78144946f2116cbae42f0f4a17`, 작업 트리는 깨끗했다.
- 15:18 KST 운영 기준 검증: 웹·API·같은 origin 프록시의 리비전 일치, 공개 응답·인증 경계 7개 통과 (`/tmp/supplier-baseline-deployment.json`, 실행 환경 임시 파일).
- 다음 개발건으로 문서화된 공급기관 표시의 한계를 해결했다. 기존 DB 필드를 목록 DTO에 추가하고 카드에서 즉시 표시한다. null·공백 안내, 구버전 목록의 상세 캐시 호환을 유지한다. DB 마이그레이션·외부 API 변경·기관별 추가 요청은 없다.

### 테스트와 결과

- `npm --prefix frontend run build`: TypeScript와 Vite 빌드 통과.
- `node --experimental-strip-types --test --test-isolation=none frontend/tests/*.test.mjs`: 141개 통과.
- 시스템 Chromium을 쓰는 임시 Playwright 설정, 포트 4175에서 `resilience.spec.ts`, `explore-design.spec.ts`, `notice-card-click.spec.ts`: 45개 통과. 임시 설정은 커밋에서 제외했다.
- 추가한 브라우저 테스트 3개: 320/390/1440px에서 첫 목록의 기관명, null·공백, 긴 기관명의 줄바꿈, 자동 상세 조회 0회, 상세 응답 이후 목록값 유지. 기존 카드 본문·키보드·북마크·비교·구버전 API 호환 테스트도 통과했다.
- 백엔드 통합 테스트는 공급기관의 목록·상세 일치와 상세 전용 필드 제외를 검증하도록 변경하고, 기관명 없는 공고에서 출처명으로 대체하지 않는 테스트를 추가했다.
- CI real-data 하네스에 실제 수집 공고의 목록·상세 공급기관 값 일치 검사를 추가했다.

### 제한과 배포 상태

- 로컬 Maven의 기본 캐시 경로 쓰기 제한은 작업 공간의 캐시 경로 지정으로 해결했다. 이후 Java 컴파일 단계에서 `release version 21 not supported`로 중단되어 로컬 백엔드 테스트는 통과로 간주하지 않는다. Java 21 GitHub CI에서 백엔드·실제 세션·PostgreSQL·실데이터 검증이 통과해야 병합한다.
- iPhone WebKit과 실제 PostgreSQL·수집 API 검증도 GitHub CI에서 확인할 예정이다. 로컬 Chromium 결과를 해당 환경의 결과로 대체하지 않는다.
- 이 기록 시점에는 변경 사항의 CI·운영 배포가 아직 완료되지 않았다. 결과 확인 후 아래에 후속 기록을 추가한다.
- 운영 회원 데이터 변경, 실제 기기 Safari 수동 검사, 공급기관 원본 데이터의 전수 정확성 검증은 이번 범위에서 수행하지 않는다.

### CI·병합 후속 기록

- [PR #125](https://github.com/enrjsj/cheongyak-one/pull/125), 기능 커밋 `f73d1ddf8e806b25e525c133764c1f964c985f7f`, main 병합 `43aafbeb4ec89a92bbf031ff7d9d79b359361fa0`.
- [CI #303](https://github.com/enrjsj/cheongyak-one/actions/runs/37581480531)의 7개 작업 모두 성공한 뒤 병합했다. Chromium 전체 220개, iPhone WebKit 36개, 실제 API 로그인 세션 2개 통과. 프런트 단위 테스트 141개도 통과했다.
- backend 작업은 157개 중 일반 테스트 150개 통과·PostgreSQL 전용 7개 건너뜀. 별도 postgres 작업에서 해당 7개가 모두 통과했다. 전체 합산에서 이를 미실행 테스트로 숨기거나 중복 집계하지 않는다.
- real-data 작업은 실제 수집·목록·상세 API와 추가한 공급기관 일치 검사까지 성공했다. infrastructure도 성공했다. 로컬 백엔드 컴파일 제한을 CI의 Java 21 검증으로 보완했다.

### 병합 후 하네스 보완

- main CI #305에서 iPhone 13 에뮬레이션을 1440px로 늘린 공급기관 테스트가 닫기 버튼 안정성 대기 중 두 번 시간 초과됐다. PR CI에서는 통과했으므로 최초 통과만으로 검증 완료를 선언하지 않았다.
- 실패 로그와 Playwright trace를 확인했다. 문제 상황은 DPR 3의 4320×2700 화면으로, 마지막 프레임에 상세 배경만 보이고 닫기 버튼 클릭의 안정성 대기가 끝나지 않았다. 앱 일반 동작 결함인지 WebKit 에뮬레이션 한계인지는 확정하지 않는다.
- iPhone 프로젝트는 320/390px 실제 모바일 범위에서 터치로 검사하고, 1440px는 데스크톱 프로젝트에서 계속 검사하도록 테스트 조건을 정리했다. 상세 닫힘과 원래 버튼의 초점 복원도 명시적으로 검증한다. 강제 클릭이나 실패 무시는 사용하지 않는다.
- 보완 후 로컬 Chromium의 320/390/1440px 테스트를 각각 3회 반복해 9회 모두 통과했다. iPhone 재검증 결과는 후속 CI에서 확인한다.
