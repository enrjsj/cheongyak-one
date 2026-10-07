# 저장소 기반 개발 하네스

- 기준 커밋: `0bc8b95c200704941f84d24c7583b6f87860c7b8`
- 목표: 새 Codex 세션에서도 기존 구조·권한·검증 방법을 일관되게 이어가기.
- 제외: UI 개편, 업무 로직, 운영 API/DB 쓰기, AWS, sleep 대응, 실제 배포.
- 변경 경로: AGENTS, README, docs, scripts/harness, Git ignore, CI harness job.
- 완료 기준: 문서화된 단일 검증 진입점, 변경 기반 범위, 증거 보고서, 실패/미검증 구분, 사용법.
- 위험: 기존 자동배포와 연결된 CI 파일. 최초 로컬 구현 후 사용자 적용 요청으로 PR/CI 반영을 진행한다.

## 구현과 검증

| 항목 | 확인 | 결과 |
| --- | --- | --- |
| 기존 상태 | main 및 기존 CI/명령 확인 | 기존 테스트를 재사용; 런타임 기능 변경 없음 |
| 하네스 자체 | Node test 14개 | 통과 |
| 프런트 | 기존 npm test | 빌드 및 141개 통과 |
| 규칙 | check, git diff --check | 통과 |
| CI 형식 | YAML 파싱 | 통과; 원격 CI는 미실행 |
| 전체 로컬 | verify --scope full | blocked; 통과로 표현하지 않음 |
| 브라우저 | Playwright Chromium 설치 | ZIP 다운로드 오류, E2E 미실행 |
| 백엔드 | doctor | Java 17/Maven 없음, 백엔드 미실행 |

## 인수인계

- 사용법과 제약: `docs/HARNESS.md`, 최신 상태: `docs/HANDOFF.md`.
- 다음 검증: JDK21/Maven/브라우저 준비 후 full --extended. PostgreSQL은 격리 환경에서 별도 검증.
- 기존 다른 작업공간의 변경은 보존했다. 신규 체크아웃에서 구현했다.
- Git/배포: 후속 사용자 요청으로 원격 반영 승인. PR #124의 main을 기반으로 기존 변경을 보존하고 CI 통과 확인 후 병합한다. 완료 여부는 해당 하네스 PR의 상태를 확인한다.
