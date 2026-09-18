# Render에서 Spring Boot를 Java 21로 실행한다.
FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml ./
COPY backend/pom.xml backend/pom.xml
RUN mvn -B -pl backend -am dependency:go-offline

COPY backend ./backend
RUN mvn -B -pl backend -am -DskipTests package

FROM eclipse-temurin:21-jre

WORKDIR /app
COPY --from=build /app/backend/target/cheongyak-one-backend-0.1.0-SNAPSHOT.jar app.jar

EXPOSE 8080
CMD ["sh", "-c", "java -XX:MaxRAMPercentage=70 -jar app.jar --spring.profiles.active=render --server.port=${PORT:-8080}"]
