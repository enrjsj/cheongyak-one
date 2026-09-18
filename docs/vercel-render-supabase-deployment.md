# Vercel + Render + Supabase 공개 테스트 배포

기존 구조는 유지한다.

- 프런트: React/Vite → Vercel
- API·비즈니스 로직·배치: Spring Boot → Render
- DB: Supabase PostgreSQL
- 소스·CI: GitHub `main`

Vercel과 Render를 각각 GitHub 저장소에 연결하면 `main` 병합 뒤 각 서비스가 자동 배포한다. 이 문서는 리소스를 생성하지 않는다.

## 1. Supabase PostgreSQL

Supabase 프로젝트를 만든 뒤 **Connect**에서 Session pooler 또는 Direct connection의 JDBC URL을 확인한다. Render에서 외부 DB에 연결하므로 다음 세 값을 Render Secret으로 등록한다.

```text
DB_URL=jdbc:postgresql://<host>:<port>/postgres?sslmode=require
DB_USERNAME=<database user>
DB_PASSWORD=<database password>
```

Flyway가 시작 시 기존 migration을 적용하고 JPA는 `validate`만 수행한다. Supabase service-role key와 anon key는 이 Spring Boot 구조에 필요하지 않으며 등록하지 않는다.

## 2. Render API

Render에서 Blueprint 또는 Web Service로 저장소를 연결하고 `render.yaml`을 사용한다. `main` 자동 배포를 활성화한다.

필수 Secret/환경변수:

| 이름 | 값 |
| --- | --- |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | Supabase JDBC 접속 정보 |
| `REB_API_KEY` | 청약홈 API 키 |
| `MYHOME_API_KEY` | 선택. 미설정 시 공공임대 수집만 건너뜀 |
| `FRONTEND_BASE_URL` | Vercel 운영 URL |
| `CORS_ALLOWED_ORIGINS` | Vercel 운영 URL. Preview도 테스트하면 쉼표로 추가 |
| `AUTH_SECURE_COOKIE` | `true` |
| `AUTH_COOKIE_SAME_SITE` | `None` |

공개 테스트 초기는 `MEMBER_MAIL_DELIVERY=disabled`, `MEMBER_EMAIL_VERIFICATION_REQUIRED=false`를 유지한다. SMTP를 연결하기 전에는 이메일 인증·비밀번호 재설정 메일을 켜지 않는다.

## 3. Vercel 프런트

Vercel 프로젝트의 Root Directory를 `frontend`로 지정한다. Build Command는 `npm run build`, Output Directory는 `dist`를 사용한다.

Vercel 환경변수:

```text
VITE_API_BASE_URL=https://<Render API URL>
VITE_DEMO_MODE=false
```

`VITE_` 변수는 브라우저에 노출되므로 API URL처럼 공개해도 되는 값만 넣는다. DB 비밀번호·공공 API 키·SMTP 비밀번호는 절대 넣지 않는다.

Vercel과 Render는 서로 다른 출처이므로 Render의 `CORS_ALLOWED_ORIGINS`와 쿠키 보안 설정을 함께 등록해야 회원 로그인·저장 기능이 동작한다. 일부 브라우저의 서드파티 쿠키 차단 정책에서는 서로 다른 기본 도메인의 세션 로그인이 제한될 수 있다. 사용자가 늘면 `app.example.com`/`api.example.com`처럼 같은 상위 도메인으로 옮기거나, Vercel rewrite/BFF 방식으로 API를 같은 출처로 제공한다.

## 4. 배치와 Render 무료 플랜

Render 무료 인스턴스는 유휴 상태에서 sleep될 수 있다. 이 경우 서버 내부의 `@Scheduled` 일배치와 알림 발송이 정시에 실행된다고 보장할 수 없다.

공개 테스트에서는 첫 요청 지연을 감수하되, 매일 청약 데이터 갱신이 중요해지면 다음 중 하나를 적용한다.

1. Render 유료 인스턴스로 전환해 서버 내부 스케줄 유지
2. GitHub Actions/외부 scheduler가 인증된 내부 동기화 작업을 호출하도록 별도 트리거 추가
3. AWS 이전 시 EventBridge Scheduler와 별도 배치 프로세스로 분리

현재는 기존 Spring Boot 스케줄러를 유지한다. 무료 Render에서는 배치 실행 이력을 관리자 화면에서 확인하고, 누락 시 관리자 수동 동기화로 보완한다.

## 5. 최초 관리자 지정

테스트 계정을 가입한 뒤 Supabase SQL Editor에서 해당 계정만 승격한다. 이메일과 닉네임을 먼저 조회하고 실행한다.

```sql
SELECT ID, EMAIL, NICKNAME, MEMBER_STATUS, MEMBER_ROLE, EMAIL_VERIFIED_AT
FROM APP_MEMBER
WHERE EMAIL = '관리자계정@example.com';

UPDATE APP_MEMBER
SET MEMBER_ROLE = 'ADMIN', UPDATED_AT = CURRENT_TIMESTAMP
WHERE EMAIL = '관리자계정@example.com'
  AND MEMBER_STATUS = 'ACTIVE';
```

이메일 인증을 켠 뒤에는 `EMAIL_VERIFIED_AT IS NOT NULL` 조건도 추가한다. 관리자 API는 로그인 세션과 서버의 `ADMIN` 역할 검증을 모두 거친다.

## 6. 로컬 검증

```bash
npm --prefix frontend test
mvn -B -pl backend test
```

배포 설정만 추가하는 작업이므로 Supabase·Render·Vercel 리소스는 이 단계에서 생성되지 않는다.
