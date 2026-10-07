# 개발 인수인계

## 현재 작업

- 날짜: 2026-10-07
- 구현 기준: main `0bc8b95c200704941f84d24c7583b6f87860c7b8` (PR #123)
- 원격 반영 기준: `3b6540e1f7c36f78144946f2116cbae42f0f4a17` (PR #124). 추가된 카드 클릭 개선은 변경 파일이 겹치지 않아 그대로 보존한다.
- 목표: 기존 서비스 코드를 유지하면서 Codex 개발 하네스 적용.
- 범위: 작업 규칙/맥락/검증 스크립트/자체 테스트/CI 검사/사용법.
- 상태: 로컬 구현 완료 후 사용자 요청으로 GitHub PR/CI 반영 단계 진행. 아래 로컬 검증 한계와 원격 CI 결과는 구분한다. 최종 병합 상태는 해당 PR에서 확인한다.

## 변경 사항

- AGENTS.md와 PROJECT_CONTEXT, DECISIONS, 작업 템플릿, HARNESS 사용법 추가.
- doctor/plan/check/verify 단일 명령과 Git 기준·변경 지문·증거 보고서 추가.
- 기존 npm/Playwright/Maven 명령 재사용. 환경변수 필터·migration 보호·고확신 비밀 패턴 검사.
- 기존 CI에 하네스 자체 테스트와 규칙 검사 추가; 기존 앱 테스트 유지.
- UI/업무 로직/DB schema/운영 환경변수/배포 설정 변경 없음.

## 검증

- 하네스 자체 회귀 테스트 14개 통과(범위 선택, 환경 분리, migration, 비밀 패턴, 실제 CLI 실행·증거·차단 상태).
- `node scripts/harness.mjs verify --scope full`: 자체 테스트와 프런트 검증 통과, 전체 결과는 blocked(종료 코드 2).
- 기존 프런트 `npm test`: TypeScript/Vite 빌드 및 단위 테스트 141개 통과.
- Java 17/Maven 미설치: Java 21/Maven 3.9+가 필요한 백엔드 테스트 미실행.
- Chromium 설치 시 다운로드 ZIP 오류: 브라우저 E2E 미실행. 실제 인증/iPhone/PostgreSQL/운영 환경도 미검증.
- 규칙 검사 통과. 증거는 `.harness/reports/<실행ID>/report.json`에 생성되며 Git에는 포함하지 않는다.
- 이 기록 작성 시점의 로컬 검증 이후 원격 PR CI로 브라우저·백엔드 등을 확인한다. 기존 커밋의 CI 통과를 이번 변경의 통과로 인용하지 않는다.
- CI YAML 구문 파싱과 `git diff --check` 통과.

## 다음 작업

1. 새 환경에서는 `node scripts/harness.mjs doctor`로 도구를 확인한다.
2. JDK/Maven/Playwright를 준비하고 `verify --scope full --extended` 실행. PostgreSQL은 별도 격리 환경/기존 CI로 검증한다.
3. 이번 반영은 사용자가 승인했다. CI 통과 확인 후 병합하며, 이후 신규 작업은 별도 요청 전 로컬 검증까지만 진행한다. main push는 기존 자동배포를 유발할 수 있다.

## 유지할 제한

- 운영 DB 쓰기·실제 동기화·외부 알림/AI 호출은 이 작업에 포함하지 않는다.
- AWS 리소스 생성·배포 금지. Render sleep 대응 변경도 별도 요청 전 제외.
- 기존 다른 작업공간의 사용자 변경을 보존하고, 여러 채팅은 worktree로 분리한다.
