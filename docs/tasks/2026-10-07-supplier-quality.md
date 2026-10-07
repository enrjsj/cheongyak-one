# 관리자 공급기관 누락 현황과 탐색 접근성

- 기준 커밋: 최초 기능 작업 `fc51550f40df4cd846c8d4e0b42122960f41f3fb`, 통합 재개 `d78c052d81b731d8ef322aca7352dfe087208a4a`.
- 목표: 관리자 수집 화면에서 소스별 저장 공고 수·공급기관 미확인 수·비율을 확인한다.
- 제외 범위: 운영 데이터 쓰기/재수집, 원본 값 추정, DB migration, 인프라·과금 설정 변경.
- 완료 기준: 관리자만 조회, 소스별 단일 집계 쿼리, null·공백과 0건 구분, PC·모바일 표시, 구버전 API 안내, 새로고침 반영.
- 변경 영역: 관리자 수집 API·집계 서비스·repository, 관리자 화면, H2/PostgreSQL 계약과 브라우저 테스트.
- 검증: 하네스 plan/verify와 관련 테스트, CI의 실제 PostgreSQL·iPhone·인증 회귀. 로컬 도구 제한과 운영 관리자 화면 미검증을 별도 기록한다.
- 권한: 사용자가 이번 작업의 commit/push/배포를 명시적으로 요청했다. 운영 데이터 쓰기와 클라우드 설정 변경은 포함하지 않는다.

## 추가 목표·분업

- 사용자가 다음 개발 1~2번을 함께 요청했다. 관리자 현황을 마무리하고 공고 목록·필터·상세의 텍스트 대비, 접근 가능한 이름, 의미 구조 회귀 검사를 추가한다. 전체 WCAG 인증이나 실제 보조공학 기기 검증을 의미하지 않는다.
- auto 판단은 parallel이다. 독립된 관리자 API/화면과 공개 탐색 접근성을 별도 작업 공간에서 구현하며, 기본 서브에이전트에 저장소 역할 지침을 전달했다. TOML 역할 자동 로딩을 입증한 실행은 아니다.
- 총괄: `cheongyak-one` / `feat/admin-supplier-quality`. 관리자 API·테스트·화면, 공유 Playwright 설정, 문서, 통합·CI·배포를 소유한다.
- 프런트 작업자: `cheongyak-one-accessibility` / `feat/accessibility-audit`, 같은 d78c052 기준에 최신 HANDOFF snapshot 전달. 공개 탐색 UI 및 새 접근성 spec/helper만 수정한다. 관리자 파일/API/기존 resilience 테스트는 수정하지 않는다.
- 포트: 총괄 기존 로컬 Chromium 4175, 작업자 전용 4176. 표준 4173 및 실제 인증 4180/8081은 총괄이 직렬 실행한다. 통합본은 총괄이 재검증한다.
- `@axe-core/playwright` 다운로드가 npm HTTP 403 정책으로 차단돼 설치하지 않았다. 기존 Playwright의 명시적 이름/구조 검사와 계산 색상 대비 검사로 범위를 제한한다. axe 전체 규칙 검사로 보고하지 않는다.
- API는 관리자 응답에 `supplierQuality` 배열을 추가한다. 기존 응답에 배열이 없으면 0건으로 오인하지 않도록 안내한다. migration·인증/CSRF 변경은 없다.
- 배포는 기존 GitHub main Git 연동만 사용한다. 직접 Vercel 배포 API나 설정 변경은 하지 않는다.

## 검증 결과

- 로컬 백엔드: Java 21 source/target과 작업 공간 Maven 캐시 지정으로 153개 통과, 실제 PostgreSQL 8개는 환경 미설정으로 건너뜀. `/tmp/supplier-quality-backend-final.log`.
- 검증 명령: `/workspace/.setup-tools/apache-maven-3.9.11/bin/mvn -s /workspace/.setup-tools/maven-settings.xml -Dmaven.repo.local=/workspace/.cache/maven/repository -Dmaven.compiler.release= -Dmaven.compiler.source=21 -Dmaven.compiler.target=21 -B -pl backend test`.
- 로컬 JDK의 ct.sym 누락으로 표준 `--release 21` 경로를 사용할 수 없어 실행 인자만 조정했다. 저장소 컴파일러 설정은 유지한다. CI Java 21 표준 빌드로 확인해야 한다.
- 최종 통합 하네스·브라우저·CI·배포 결과는 검증 후 HANDOFF에 기록한다.
