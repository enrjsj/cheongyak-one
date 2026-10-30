# API 주간 기동 유지 보조 예약

GitHub 예약 실행 누락을 보완하기 위해 기존 Supabase Postgres의 pg_cron/pg_net으로 공개 health GET을 예약한다. 신규 프로젝트·유료 서버·Edge Function·비밀키는 필요하지 않다. 기존 무료 서비스 사용량 한도는 그대로 적용된다.

## 적용 범위

- 매일 한국 시간08:50·08:55 예열,09:00~17:55 5분 간격(110회/일). UTC cron은 `50,55 23 * * *`, `*/5 0-8 * * *`이다.
- 요청당20초. 첫 예열이 timeout이어도 다음 예약은 계속 실행된다. 요청을 비동기로 넘겨 DB가 서버 기동을 기다리지 않는다.
- 실행 순간의 한국 시간이08:50 이전 또는18시 이후면 HTTP를 enqueue하지 않는다. pg_net 큐 처리가 늦어지면 실제 전송 시각은 경계를 넘을 수 있다.18시에는 서버를 종료하지 않는다.
- 청약/회원/Flyway 테이블을 변경하지 않는다. 비공개 `cheongyak_ops.api_warmup_request`에 request ID와 시각만 기록,7일 후 삭제한다. RLS 및 공개 역할 접근 차단. 새 공개 RPC나 SECURITY DEFINER 함수를 만들지 않는다.
- 기존 GitHub 예약은 보조 경로로 유지한다. 두 예약이 모두 실행되면 HTTP 수가 늘어나지만 데이터 변경은 없고 서로 실행을 막지 않는다.

## 설치·검증·중단

운영 대상은 기존 `cheongyak-one` 조직의 앱 DB다. 설치 전 프로젝트·DB/역할·cron 시간대·동일명 스키마 충돌을 확인한다. `api-warmup-install.sql`을 postgres 역할로 하나의 트랜잭션에서 적용한다. Supabase 도구로 DDL을 적용할 때는 `apply_migration`을 사용한다. 이 운영 설정은 앱 Flyway에 넣지 않는다.

동일 설치 SQL은 같은 이름의 두 예약을 갱신한다. 설치 후 `api-warmup-test.sql`은 HTTP 없이 시간 경계·정상 응답 판정·실제 예약·접근 권한을 검사한다. `api-warmup-status.sql`은 예약 등록/실행과 실제 응답을 따로 보여준다. 실제 정기 실행의 request ID와 HTTP200/JSON UP을 함께 확인해야 한다. 녹색 cron 성공은 enqueue 성공일 뿐이다.

중단할 때 `api-warmup-disable.sql`로 이 기능의 두 예약만 비활성화한다. 다른 예약/공유 확장/기록은 삭제하지 않는다. 재설치는 두 예약을 다시 활성화한다.

`api-warmup-night-test.sql`은 설치된 두 job의 실제 INSERT를 추출해 야간 시각8개 조건에서 enqueue가0인지 확인한다. 트랜잭션은 반드시 ROLLBACK하므로 회귀로 큐에 추가돼도 외부 HTTP는 전송되지 않는다. 정상 실행 종료가 통과이며 예외는 실패다.

## 한계

pg_net HTTP 응답은 기본6시간 후 만료된다. 이후 이력은 성공/실패가 아닌 `response-expired-or-unavailable`이다. 자동 실패 알림은 추가하지 않았으며 [Supabase Cron](https://supabase.com/dashboard/project/mfnfidifxghqcracmsue/integrations/cron/overview)과 상태 SQL로 확인한다. DB 중단, 무료 사용량 소진, Render 재기동/장애까지 막지는 못한다. 하루 전체 유지·다음날 아침 콜드스타트 검증은 별도로 기록한다.

공식 근거: [Cron](https://supabase.com/docs/guides/cron), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
