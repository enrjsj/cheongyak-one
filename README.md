# 청약한눈

아파트, 공공임대, 오피스텔 청약 공고를 한곳에서 검색하고 일정과 핵심 자격을 확인하는 서비스입니다.

## 프로젝트 구성

    cheongyak-one
    ├── frontend   React + TypeScript + Vite
    └── backend    Java 21 + Spring Boot + JPA + Oracle + Flyway

현재 단계에서는 프런트엔드와 백엔드를 각각 실행합니다. 이후 React 정적 파일을 Spring Boot 실행형 JAR에 포함해 하나의 애플리케이션으로 배포할 수 있습니다.

## 로컬 실행

### 프런트엔드

    cd frontend
    npm install
    npm run dev

기본 주소는 http://localhost:5173 이며 /api 요청은 http://localhost:8080 으로 전달합니다.

### 백엔드

Oracle 연결 전에는 H2 기반 local 프로필을 사용할 수 있습니다.

    mvn -pl backend spring-boot:run -Dspring-boot.run.profiles=local

운영과 유사한 Oracle 환경에서는 .env.example을 참고해 환경변수를 등록하고 실행합니다.

    mvn -pl backend clean package
    java -jar backend/target/cheongyak-one-backend-0.1.0-SNAPSHOT.jar

## 데이터베이스 변경

- JPA는 ddl-auto=validate로 사용합니다.
- 테이블 생성과 변경은 backend/src/main/resources/db/migration의 Flyway SQL로 관리합니다.
- 이미 적용한 Migration 파일을 수정하지 않고 다음 버전 파일을 추가합니다.

## 일배치

- 기본 실행 시각: 매일 03:10 (Asia/Seoul)
- 최근 90일과 향후 365일 공고를 재조회합니다.
- 한국부동산원 청약홈 API에서 APT와 오피스텔 공고를 페이지 단위로 수집합니다.
- 공공임대는 별도의 마이홈포털 API 키가 준비되면 연결합니다.
- 실행 이력은 SYNC_EXECUTION에 기록합니다.

GitHub Actions의 `CI / real-data` 작업은 Repository Secret인 `REB_API_KEY`를 환경변수로 주입합니다. Oracle 구성 전에는 H2에 실제 공고를 저장하고 공개 데이터만 `reb-real-data-sample` 아티팩트로 출력합니다.

프런트엔드는 더 이상 예시 공고를 사용하지 않습니다. 백엔드의 `/api/v1/notices` 목록·상세 API를 호출하며, 개발 서버에서는 Vite 프록시가 `localhost:8080`의 Spring Boot로 요청을 전달합니다.

    # 터미널 1: 실제 데이터가 포함된 백엔드 실행
    export REB_API_KEY="발급받은 개발키"
    mvn -pl backend clean package
    java -jar backend/target/cheongyak-one-backend-0.1.0-SNAPSHOT.jar \
      --spring.profiles.active=local \
      --app.notice-sync.run-on-startup=true

    # 터미널 2: 프런트엔드 실행
    cd frontend
    npm ci
    npm run dev

`http://localhost:5173`에서 실제 아파트·오피스텔 공고, 상태별 건수, 지역·주택유형 필터, 상세 공고 링크를 확인할 수 있습니다.

로컬에서 실제 데이터 배치를 한 번 실행하려면 `REB_API_KEY` 환경변수를 설정한 후 아래 명령을 사용합니다.

    mvn -pl backend clean package
    java -jar backend/target/cheongyak-one-backend-0.1.0-SNAPSHOT.jar \
      --spring.profiles.active=local \
      --spring.main.web-application-type=none \
      --app.notice-sync.run-on-startup=true

## 환경변수

실제 DB 비밀번호와 API 키는 Git에 커밋하지 않습니다.

| 이름 | 설명 |
|---|---|
| DB_URL | Oracle JDBC URL |
| DB_USERNAME | 애플리케이션 DB 계정 |
| DB_PASSWORD | 애플리케이션 DB 비밀번호 |
| REB_API_KEY | 한국부동산원 청약홈 API 키 |
| MYHOME_API_KEY | 마이홈포털 API 키 |
| NOTICE_SYNC_CRON | 공고 동기화 실행 시각 |
