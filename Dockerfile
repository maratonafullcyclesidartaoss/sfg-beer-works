FROM gradle:7.6.1-jdk17-alpine AS builder

WORKDIR /usr/app/

COPY . .

# build runtime
FROM eclipse-temurin:17.0.5_8-jre-alpine

COPY --from=builder /usr/app/target/*.jar /opt/app/application.jar

RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

CMD java -jar /opt/app/application.jar