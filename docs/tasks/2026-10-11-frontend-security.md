# 프런트 개발 의존성 보안 패치

- 기준 커밋: ade9d34e16fd346861aa2c314c662ee5a732cab9 (PR #135 병합/동일 SHA 운영 확인).
- 목표: 기존 npm audit high 2개 패키지 경고 해소, 재현 가능한 잠금파일과 기존 사용자 흐름 유지.
- 제외 범위: 앱/API/DB/인증/운영 설정 변경, 실제 회원·AI·알림·동기화 쓰기, 대규모 버전 업그레이드.
- 변경 경로: frontend/package.json, frontend/package-lock.json, README.md, HANDOFF 및 이 기록.
- 완료 기준: npm ci 성공, audit 보고 취약점 0건, 빌드·기존 테스트·필수 CI 성공 및 승인된 기존 Git 자동배포 확인.
- 위험: 빌드 도구 하위 의존성 호환성. 운영 자원/비용 변경 없음.

## 구현과 검증

- 모드: 총괄 단일 쓰기 후 독립 읽기 전용 리뷰. 동일 clone을 읽으며 리뷰어는 설치/테스트/수정/재위임하지 않는다. 모든 포트 사용 검증은 총괄이 직렬 실행한다.
- Vite 8.0.13 → 8.0.16: 기존 8.0 패치 계열 유지. 공식 패치에 필요한 rolldown 1.0.3 및 플랫폼별 바인딩/하위 의존성 갱신.
- source-map-js 1.2.1 → 1.2.2: PostCSS 전이 의존성의 호환 범위 안에서 잠금파일 갱신. 불필요한 직접 의존성/override 추가 없음.
- audit:security는 high 이상 실패하는 명시적 검사 명령이며 기존 CI 트리거/통과 기준/재시도를 변경하지 않는다. audit 결과는 조회 시점의 알려진 권고만 의미한다.
- 첫 npm update 후 선택적 WASM peer의 잠금파일 불일치로 npm ci 실패. npm install --package-lock-only --ignore-scripts --include=optional로 해결 후 npm ci --ignore-scripts 성공. 잠금파일을 수동으로 조작하지 않았다.
- 관련 확인: npm view Node 요구조건 호환, npm ls Vite8.0.16/source-map-js1.2.2/rolldown1.0.3, audit 0건.
- 최종 검증: node scripts/harness.mjs verify --base ade9d34e16fd346861aa2c314c662ee5a732cab9 --scope full --extended. 빌드 도구가 전체 UI에 영향을 줄 수 있어 iPhone도 포함. 로컬 Node24.19/npm10.9.4, CI Node22. Java21/Maven 미설치로 백엔드/실제 인증은 최종 head CI에서 확인한다.
- 독립 리뷰 반영: npm11 생성물은 루트 wasm-runtime의 peer가 바인딩 하위에만 배치됐다. 해당 최초 통합 검사를 중단하고 npm10.9.4의 package-lock-only 설치로 루트 peer를 정상 생성한 뒤 npm ci 재통과. 중단된 검사를 완료로 재사용하지 않는다. 보안 명령에 --include=dev를 명시하고 NODE_ENV=production에서도 audit 0건 확인. WASM 실제 실행/모든 OS 검증은 아니며 Windows 로컬·Linux CI 범위로 구분한다.
- 원격: 기존 사용자 승인으로 커밋/PR, 필수 CI 성공 후 병합·Vercel/Render/프록시 동일 SHA 읽기 전용 검사. 실행 결과는 PR에 기록하며 로그만 추가하는 재배포를 하지 않는다.
- 최종 로컬 결과: 빌드/단위165·Chromium252·iPhone61 통과(PC전용3 제외), 하네스 자체 통과. 보고서 `.harness/reports/2026-10-11T06-22-04-777Z-17704/report.json`. Java21/Maven 미설치로 전체 상태는 blocked이며 백엔드/실제 인증은 미검증이다. 이 결과만 기록한 뒤 package/lock 동일성을 확인하고 docs 검사만 추가한다.

## 공식 근거

- [Vite Windows 경로 검사 패치](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)
- [Vite에 포함된 launch-editor 패치](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)
- [source-map-js offset 검증 패치](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)

## 인수인계

- 운영 서버/개발 PC가 실제 공격받았거나 정보가 유출됐다는 근거는 없으며 그런 결론을 내리지 않는다.
- 실제 iPhone/보조기기와 운영 사용자 데이터 변경은 미검증/제외. OS별 취약점 악용 실험이나 외부 SMB 접속은 수행하지 않는다.
- 다음 안전한 작업: 상세 확인 안내의 정상/오류 재시도 경계와 주택형 부분 수치 표시를 별도 사용자 개선 묶음으로 검토.
