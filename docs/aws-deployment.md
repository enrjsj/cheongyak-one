# AWS 배포 가이드

운영 구성은 서울 리전의 Elastic Beanstalk 단일 EC2, 비공개 RDS PostgreSQL, 비공개 S3, CloudFront로 이루어집니다. NAT Gateway와 로드밸런서를 두지 않아 초기 고정비를 낮췄으며, 백엔드 EC2만 공인 IP를 사용해 청약홈 API를 호출합니다.

## 사전 준비

- AWS CLI v2 로그인
- CloudFormation, IAM, VPC, EC2, RDS, S3, CloudFront, Secrets Manager, Elastic Beanstalk 생성 권한
- 선택 사항: Secrets Manager에 **API 키 원문만** 각각 저장한 청약홈·마이홈 API Secret
- GitHub Actions 자동 배포를 쓸 경우 GitHub CLI 로그인

실제 비밀번호와 API 키는 템플릿이나 GitHub Secret에 넣지 않습니다. RDS 비밀번호는 CloudFormation이 무작위로 만들고, Elastic Beanstalk가 Secrets Manager에서 실행 시점에 읽습니다. GitHub는 OIDC 단기 자격증명으로 AWS에 접근합니다.

## 1. 인프라 생성

아래 명령은 백엔드 스택을 먼저 만들고 그 출력값으로 엣지 스택을 생성합니다. 실제 AWS 리소스가 생성되어 과금될 수 있으므로 계정과 리전을 먼저 확인합니다.

```bash
export AWS_REGION=ap-northeast-2
export GITHUB_REPOSITORY=enrjsj/cheongyak-one
export REB_API_SECRET_ARN='arn:aws:secretsmanager:ap-northeast-2:계정번호:secret:이름'
export MYHOME_API_SECRET_ARN='arn:aws:secretsmanager:ap-northeast-2:계정번호:secret:이름'
export ALERT_EMAIL='비용알림을받을주소'
export MONTHLY_BUDGET_USD=20
./scripts/deploy-aws-infrastructure.sh
```

`REB_API_SECRET_ARN`을 생략하면 청약홈 동기화를 실행할 수 없습니다. `MYHOME_API_SECRET_ARN`을 생략하면 공공임대만 건너뛰고 APT·오피스텔 동기화는 계속됩니다. 삭제 연습용 스택이라면 `DATABASE_DELETION_PROTECTION=false`를 명시해야 하며, 운영 기본값은 `true`입니다.

## 2. GitHub 환경 연결

GitHub 저장소에 `production` Environment를 만든 뒤 보호 규칙과 승인자를 설정합니다. 다음 스크립트는 CloudFormation 출력값만 GitHub Environment 변수로 옮깁니다. AWS 장기 액세스 키는 저장하지 않습니다.

```bash
gh auth login
gh auth setup-git
./scripts/configure-github-aws.sh
```

등록되는 변수는 다음과 같습니다.

| 변수 | 용도 |
|---|---|
| `AWS_REGION` | 배포 리전 |
| `AWS_ROLE_ARN` | GitHub OIDC 배포 역할 |
| `EB_APPLICATION` | Beanstalk 애플리케이션 |
| `EB_ENVIRONMENT` | Beanstalk 환경 |
| `EB_DEPLOYMENT_BUCKET` | 백엔드 ZIP 버킷 |
| `FRONTEND_BUCKET` | 정적 프런트 버킷 |
| `CLOUDFRONT_DISTRIBUTION_ID` | 배포 후 캐시 초기화 대상 |

## 3. 애플리케이션 배포

`.github/workflows/deploy-aws.yml`을 수동 실행하거나 `main`에 반영하면 다음 순서로 배포합니다.

1. 백엔드 전체 테스트 및 실행형 JAR 생성
2. 루트에 `Procfile`과 `application.jar`만 담긴 Beanstalk ZIP 생성
3. Beanstalk 배포 및 정상 상태 대기
4. 프런트 TypeScript 검사·테스트·운영 빌드
5. S3 동기화 및 CloudFront 무효화

CloudFront는 `/api`와 `/api/*`만 백엔드로 전달하고 캐시하지 않습니다. 그 밖의 화면 경로는 SPA의 `index.html`로 바꾸지만, 백엔드의 404·오류 응답은 수정하지 않습니다. 회원 세션 쿠키와 `POST`, `PATCH`, `PUT`, `DELETE`도 그대로 전달합니다.

## 4. SES 회원 메일 연결

이메일 인증을 활성화하기 전에 SES에서 발신 이메일 또는 도메인을 인증하고 서울 리전의 SMTP 자격정보를 발급합니다. SMTP 자격정보는 AWS 액세스 키와 다른 값이며 Git에 저장하지 않습니다.

Elastic Beanstalk 환경에 다음 값을 설정합니다. 실제 SMTP 사용자명과 비밀번호는 Secrets Manager를 통해 환경 Secret으로 주입하는 방식을 권장합니다.

```text
MEMBER_MAIL_DELIVERY=smtp
MEMBER_EMAIL_VERIFICATION_REQUIRED=true
FRONTEND_BASE_URL=https://CloudFront도메인
MEMBER_MAIL_FROM=SES에서인증한발신주소
SMTP_HOST=email-smtp.ap-northeast-2.amazonaws.com
SMTP_PORT=587
SMTP_AUTH=true
SMTP_STARTTLS=true
SMTP_USERNAME=SES_SMTP_USERNAME
SMTP_PASSWORD=SES_SMTP_PASSWORD
```

먼저 테스트 계정으로 가입→인증→로그인→비밀번호 재설정을 확인한 뒤 `MEMBER_EMAIL_VERIFICATION_REQUIRED=true`를 적용합니다. 설정 전 AWS 기본값은 `delivery=disabled`, `verification-required=false`라서 메일 미설정으로 신규 회원이 잠기는 상황을 방지합니다.

회원이 알림 설정에서 `이메일로도 받기`를 켜면 이후 생성되는 관심청약 일정 알림도 같은 SES SMTP 연결로 발송됩니다. 기본값은 수신 안 함이며, 실패한 메일은 DB 큐에서 최대 5회 재시도합니다. 운영 전 SES 샌드박스 해제 여부와 수신 테스트를 확인하고 필요하면 `MEMBER_NOTIFICATION_EMAIL_CRON`으로 발송 주기를 조정합니다.

## 5. 최초 관리자 지정

이메일 주소만으로 관리자를 자동 지정하지 않습니다. 관리자 계정의 이메일 인증을 완료한 뒤, 운영 DB에 접속해 대상 이메일과 활성 상태를 확인하고 역할을 변경합니다.

```sql
SELECT ID, EMAIL, NICKNAME, MEMBER_STATUS, MEMBER_ROLE, EMAIL_VERIFIED_AT
FROM APP_MEMBER
WHERE EMAIL = '관리자계정@example.com';

UPDATE APP_MEMBER
SET MEMBER_ROLE = 'ADMIN', UPDATED_AT = CURRENT_TIMESTAMP
WHERE EMAIL = '관리자계정@example.com'
  AND MEMBER_STATUS = 'ACTIVE'
  AND EMAIL_VERIFIED_AT IS NOT NULL;
```

권한 회수 시 같은 방식으로 `MEMBER_ROLE = 'USER'`로 변경합니다. 잘못된 계정 승격을 막기 위해 조회 결과의 이메일과 닉네임을 확인한 뒤 트랜잭션을 커밋합니다.

## 보안과 운영 확인

- RDS는 외부 공개가 꺼져 있고 애플리케이션 보안 그룹에서만 5432 포트로 접근합니다.
- S3는 퍼블릭 접근이 모두 차단되고 CloudFront OAC만 읽을 수 있습니다.
- 운영 Actuator는 `/actuator/health`, `/actuator/info`만 노출합니다.
- 운영 프런트 빌드는 소스맵을 만들지 않습니다.
- `/api/v1/admin` 운영 정보는 DB에서 `ADMIN` 역할을 부여한 로그인 회원만 조회할 수 있습니다.
- 운영 관리 화면에서 회원 잠금 해제와 강제 로그아웃을 수행할 수 있으므로 관리자 계정은 개인별로 발급하고 공유하지 않습니다.
- 회원 이용정지는 모든 활성 세션과 계정 작업 토큰을 즉시 폐기합니다. 정지 사유에는 주민등록번호·전화번호 같은 불필요한 개인정보를 입력하지 않습니다.
- 관리자 회원 조작은 `ADMIN_AUDIT_LOG`에 처리자·대상 회원 ID로 보존됩니다. 이메일을 복사해 저장하지 않아 회원 탈퇴 시 기존 익명화 정책이 그대로 적용됩니다.
- 회원 인증·재설정 토큰은 DB에 해시로만 저장하며 만료 토큰은 매일 자동 삭제합니다.
- 관심청약 이메일은 명시적으로 수신 동의한 회원에게만 발송하고 발송 성공·재시도 상태를 DB에 기록합니다.
- RDS는 삭제 방지와 최종 스냅샷을 기본으로 사용합니다.
- RDS 유지보수와 Beanstalk 관리 업데이트 시간을 분리했습니다.
- 예산 알림 메일은 AWS에서 온 구독 확인 절차가 필요한지 콘솔에서 확인합니다.

단일 인스턴스 구성은 배포 중 짧은 중단이 있을 수 있습니다. 트래픽과 가용성 요구가 커지면 로드밸런서·Auto Scaling을 추가하고, 서버 내부 일배치는 EventBridge Scheduler와 별도 작업으로 분리합니다.

## 로컬 검증

```bash
cfn-lint infra/aws/*.yml
bash -n scripts/*.sh
npm --prefix frontend test
mvn -B -pl backend test
```

이 명령은 AWS 리소스를 만들지 않습니다. 실제 생성은 `deploy-aws-infrastructure.sh`를 실행할 때만 시작됩니다.
