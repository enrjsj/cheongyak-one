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
- 최근 90일과 향후 공고를 재조회하는 정책을 적용할 예정입니다.
- 한국부동산원 청약홈 API와 마이홈포털 공공주택 API 클라이언트는 다음 단계에서 연결합니다.
- 실행 이력은 SYNC_EXECUTION에 기록합니다.

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
