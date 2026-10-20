# 공고 결과 이동·탐색 UX 정리

- 기준: clean `c7281833698c327bbde1217d37769dd576aeb888`(PR #142), branch `work`.
- 현재 checkout은 10월 17일 개발이 반영된 상태다. 과거 대화의 지도/메모 미커밋 상태를 복구하거나 덮어쓰지 않는다.
- 목표: 상태 버튼 클릭 즉시 실제 공고 위치로 이동, 빠른 검색 제거, 검색/필터 결과 접근 및 모바일 필터 사용성 개선.
- 제외: API/DB/인증 계약·지도 키·운영 설정·commit/push/배포.
- 완료 기준: PC/모바일 상태 선택과 재선택, 연속 키보드/모션 줄이기, 지연/빈 결과/오류, 검색 제출, 필터 닫기/결과 보기의 초점 및 고정 버튼/입력 영역 가림 검증.

## 분업과 판단

- 총괄 단일 쓰기 + 독립 읽기 전용 UX 감사/최종 리뷰. `.codex/agents/cheongyak_reviewer.toml` 역할을 기존 reviewer에 전달. 같은 최신 코드를 읽기만 하므로 별도 쓰기 worktree 없음. 재귀 위임 없음, 브라우저 포트는 총괄 직렬 사용.
- 기존 상태 클릭에는 이동이 없었다. 기존 공통 이동은 상태 탭을 포함한 전체 dashboard에 초점을 주고 scroll-padding/margin까지 중첩되어 공고보다 위로 이동했다.
- 상태 선택은 탭 초점을 유지하고 `#notice-results`의 카드/로딩/오류/빈 결과 영역으로 이동한다. 다음 프레임에 헤더·탭 실제 높이를 측정하며 중복 예약과 unmount를 취소한다. 서버 응답을 기다리거나 응답 완료 때 다시 스크롤하지 않는다.
- 일반 검색/최근 검색/필터 결과 보기도 같은 공고 위치를 사용하되 기존 검색 결과 영역 초점을 유지한다. 모션 줄이기는 CSS smooth의 영향을 받지 않는 instant 이동.
- 빠른 검색 칩/helper/전용 CSS 제거. 기존 검색어·지역/유형 select·상세 필터·최근 검색은 유지한다. 관심 준비 상태 필터와 공유한 CSS는 보존한다. 이 제거로 예고 없는 지역/유형 초기화 및 최근 검색 기록 불일치 경로도 없어진다.
- 필터 결과보기/초기화 버튼을 모달 안에서 하단 고정하고 scroll-padding으로 입력 가림을 방지한다. 다른 모달에는 적용하지 않는다.
- React 스킬 기준 이벤트에서만 이동 처리, 새 상태/API 호출 없이 기존 상태 사용, requestAnimationFrame cleanup과 키보드 초점 검토.

## 개발 중 검증

- `node scripts/harness.mjs plan --base c728183`: frontend 변경 범위 확인. 최종 앱 검사는 full extended로 수행한다.
- 신규 브라우저9개: 최초5통과/4실패. 첫 탭 이름을 `전체`로 지정한 fixture 오류이며 실제 이름 `모집 중·예정`으로 수정했다. 수정 후 해당4개 통과.
- 리뷰 권고로 고정 footer가 중간 면적 입력을 가리지 않는 검사를 추가했다. 최초 잘못된 입력 label 선택자로1실패, 실제 `면적 최대 (㎡)`로 수정. assertion/시간 제한/자동 재시도 완화 없음.
- 임시 테스트 설정 준비의 cwd 경로 오류는 실제 실행 전에 수정했다. 위 초기 실패는 앱 결함 수정 없이 선택자만 바꾼 결과와 구분한다.
- 모바일 터치 Chromium 관련9개 통과(56.7초, 자동 재시도0). 320/390/1440 스크린샷에서 헤더·상태 탭 아래 첫 공고 노출 확인. 독립 최종 리뷰에서도 추가 결함 없음.

## 최종 검증·미검증

- 앱/테스트/설정 등 Markdown 제외434파일을 고정했다. manifest SHA256 `399b485663c24c596cee4f7cdbf2ad4664bf0826830f602379fcc30038d2441b`; 최종 하네스 fingerprint `57f4ff1f6744502cbfd0d4790a005082245b65e5ae8ba2588f8394a91b8d2370`.
- `PATH="/tmp/oct19-tools:$PATH" node scripts/harness.mjs verify --base c728183 --scope full --extended`: 하네스14, 프런트 빌드/단위182, 백엔드161 실행 통과(171 중 PostgreSQL10 제외), 인증용 JAR 빌드 통과. 2026-10-19 18:13:19~18:19:48 KST. 브라우저 배포본 부재로 전체 상태는 `blocked`(exit2), 통과로 기록하지 않는다.
- 보고서: `.harness/reports/2026-10-19T09-13-19-128Z-3270/report.json`. 실행 중 작업 트리 변경 없음. Maven 최초 의존성 준비 포함 backend331초, 인증용 빌드23초.
- 표준 브라우저 대신 시스템 Chromium151 임시 설정으로 전체302개 검사. 최초 Maven과 병행한 실행은15통과/2시간 초과/2중단/283미실행(3.3분). 부하 가능성 확인을 위해 이 브라우저 실행만 중단했다. 로그 `/tmp/oct19-chromium-partial.log`, trace `.harness/oct19-browser-partial/` 보존.
- 백엔드 종료 후 실패한 기존 접근성2개만 동일 설정/기준으로 재검증해2통과(25.4초). 코드·assertion·timeout·retries 변경 없음. 실행 환경을 분리해 전체 브라우저를 한 번 더 실행했으나62통과/5실패/2중단/233미실행(8.6분)에서 원인 확인을 위해 중단했다. 4개는 전체30초 초과, 낮은 모바일 편집1개는 필터를 열기 전 로그인 준비의5초 초과였다. 버튼 가림 실패가 아님을 로그로 확인했다. 이후 실패5개만 workers=1로 검사해5통과(1.4분). 코드·기대값·시간 제한은 그대로이며 부하 영향은 의심되나 확정하지 않는다. 전체302개 통과로 해석하지 않는다. 전체 재반복 대신 미완료233개는 정상 브라우저 환경/CI의 후속 검증으로 남긴다.
- 개별 로그/임시 실행 설정/소스 manifest/스크린샷도 위 보고서 디렉터리에 복사했다. 두 번째 부분 실행 trace는 후속 실행에서 덮어써졌으며 로그를 증거로 보존했다.
- 시스템 Chromium + 로컬 Java 실제 인증 통합1개 통과(테스트21.6초, 서버 준비 포함1.3분). same-origin 로그인·새로고침·다른 탭·CSRF·로그아웃 보호 확인, 실제 메일 발송 없음.
- 표준 Playwright Chromium/WebKit은 설치되어 있지 않다. 시스템 Chromium 통과를 iPhone/WebKit 통과로 해석하지 않는다.
- Maven은 별도 설치 경로를 사용한다. 이전 setup의 mirror403은 현재 허용된 미러200으로 확인했다. JDK ct.sym 누락은 실행 인자의 source/target21로 보완하며 저장소 빌드 설정은 변경하지 않는다.
- 최종 앱 검증 뒤 Markdown 제외434파일 해시와 파일 집합이 고정 manifest와 일치함을 확인했다. 이후 문서 검증만 추가한다.
- 운영 API/실제 계정/실제 모바일 Safari·스크린리더/원격 CI·배포는 미검증. 운영 쓰기·실발송 없음.
- Git/배포: 미실행.

## 후속 검증 명령

- 동일 코드에서 표준 Playwright Chromium/WebKit이 준비된 환경 또는 원격 반영 시 필수 CI로 전체302개와 iPhone을 완주해야 한다. 이번 변경의 신규9개 및 기존 실패7개의 좁은 재검증 통과를 전체 통과로 대신하지 않는다.
- 사용한 보조 명령: `./node_modules/.bin/playwright test -c /tmp/oct19-mobile.config.mts explore-navigation-resilience.spec.ts --workers=2`, 전체 `-c /tmp/oct19-chromium.config.mts --workers=2`, 접근성2개 `e2e/accessibility.spec.ts --grep '상세 확인 안내는|접근성 320px.*필터의'`, 기존5개 `e2e/core-flows.spec.ts --grep 'favorites 늦은 403 응답은 새 로그인|1280px 저장 조건 편집 Escape|낮은 모바일 화면에서도|상담 이전 응답은 (다른 공고|같은 공고)' --workers=1`, 실제 인증 `-c /tmp/oct19-auth.config.mts`. 모두 frontend cwd, retries0.
- 로컬 변경만 남겼으며 commit/push/원격 배포 없음. 다음 개발 전에 기존 실패가 정상 환경에서도 재현되는지 먼저 확인한다.

- 문서 마무리: `node scripts/harness.mjs verify --base c728183 --scope docs` 통과(하네스14, 8.6초). 보고서 `.harness/reports/2026-10-19T09-34-23-881Z-10127/report.json`. 이는 위 앱 결과를 대체하지 않는다. `git diff --check` 통과.
