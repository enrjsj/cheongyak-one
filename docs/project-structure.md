# 청약한눈 프로젝트 구조

## 1. 구성

```
cheongyak-one/
├── backend/                 # Spring Boot API·배치·DB 접근
├── frontend/                # React/Vite 단일 페이지 웹
├── infra/aws/               # AWS CloudFormation 구성 초안
├── scripts/                 # AWS·GitHub OIDC 설정 보조 스크립트
├── docs/                    # 운영·개발 문서
├── Procfile                 # 실행형 JAR 기동 명령
└── pom.xml                  # 백엔드 포함 Maven 상위 빌드
```

## 2. 백엔드 (`backend`)

| 경로 | 역할 |
| --- | --- |
| `api` | HTTP Controller, 요청 DTO, 응답 DTO, 예외 응답 |
| `application` | 공고 조회·동기화·회원·관심청약·추천의 유스케이스 |
| `domain` | JPA Entity, Enum, Repository. 비즈니스 상태의 영속 모델 |
| `infrastructure` | 청약 API(REB/MyHome), 메일, FCM 푸시의 외부 연동 구현 |
| `batch` | 시작 동기화와 주기 동기화 스케줄러 |
| `config` | 보안, 시간, 인증, API/메일/동기화 설정 |
| `resources/db/migration` | Flyway PostgreSQL 스키마 변경 이력 |

### 주요 흐름

1. `batch`가 `application.NoticeSyncCoordinator`를 호출합니다.
2. `infrastructure.external`의 공고 소스 클라이언트가 원천 데이터를 읽습니다.
3. `application`이 공고 스냅샷을 병합하고 `domain.notice`에 저장합니다.
4. `api.NoticeController`가 검색·상세·변경 이력을 프런트엔드에 제공합니다.
5. 로그인 회원 기능은 `api.member` → `application.member` → `domain.member` 순서로 처리합니다.

회원 세션은 HttpOnly 쿠키로 유지하며, 상태를 변경하는 회원 API는 CSRF 인터셉터로 보호합니다. 비밀값은 환경 변수만 사용하며 저장소에 커밋하지 않습니다.

## 3. 프런트엔드 (`frontend`)

| 파일/경로 | 역할 |
| --- | --- |
| `src/App.tsx` | 검색, 공고 상세, 관심청약, 비교, 사전점검을 조합하는 화면 컨테이너 |
| `src/api.ts` | 백엔드 API 타입과 쿠키/CSRF 기반 요청 함수 |
| `src/noticeTools.ts` | URL 검색 조건·공유 링크·최근 본 공고 처리 |
| `src/eligibilityTools.ts` | 자격 사전점검 질문과 안내용 체크 항목 계산 |
| `src/*Dialog.tsx` | 로그인, 알림, 관리자, 캘린더 모달 |
| `src/*Panel.tsx` | 추천·관리자 기능의 분리된 화면 조각 |
| `src/index.css` | 서비스 공통 스타일과 반응형 규칙 |

브라우저 저장소에는 비로그인 관심청약·최근 본 공고만 보관합니다. 로그인하면 서버의 관심청약·비교 목록과 동기화하며, 개인정보·세션은 브라우저 저장소에 넣지 않습니다.

## 4. 인프라와 배포

`infra/aws`는 Elastic Beanstalk, RDS PostgreSQL, S3/CloudFront 및 예산 알림 구성을 위한 템플릿입니다. 실제 AWS 배포와 자격 증명 설정은 별도 운영 절차에서 수행합니다. CI는 Maven/프런트엔드 테스트를 실행하며, Flyway migration은 애플리케이션 시작 시 적용됩니다.

## 5. 개발 시 주의사항

- DB 변경은 반드시 새 Flyway migration으로 추가합니다. 기존 migration을 수정하지 않습니다.
- 외부 청약 API·메일·푸시 실패는 서비스 전체 장애로 전파하지 않고, 동기화/전송 이력으로 추적합니다.
- 자격 사전점검은 판정 서비스가 아니라 공고문 확인을 돕는 안내 기능입니다.
- 회원 개인정보와 기기 토큰은 목적에 필요한 범위만 다루며 로그에 원문을 남기지 않습니다.
