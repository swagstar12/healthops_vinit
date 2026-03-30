# Stage 1: Build with Maven
FROM maven:3.9.9-eclipse-temurin-17 AS builder
WORKDIR /app

# Copy pom.xml and download dependencies first (better caching)
COPY pom.xml .
RUN mvn -q dependency:go-offline

# Now copy the rest of the source code
COPY src ./src

# Build the app
RUN mvn -q -DskipTests package

# Stage 2: Run the app
FROM eclipse-temurin:17-jdk
WORKDIR /app

# Copy the built jar
COPY --from=builder /app/target/healthops-backend-1.0.0.jar app.jar

EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
