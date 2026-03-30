# HealthOps — Hospital Management System (Java Full Stack)

This is a production‑ready starter for your final‑year project. It includes:

- **Backend:** Spring Boot 3, Java 17, Spring Security (JWT), JPA/Hibernate, Validation, Flyway, OpenAPI (Swagger), PostgreSQL
- **Frontend:** React + TypeScript + Vite + Tailwind, Axios, React Router
- **Auth:** Email/username + password, JWT bearer tokens, RBAC (ADMIN, DOCTOR, RECEPTIONIST)
- **Dashboards:** Role‑based dashboards for Admin, Doctor, Receptionist
- **Core features:** Doctor management, patient registry, appointments, visits/history, doctor availability & holidays, downloadable CSV visit reports
- **DevOps:** Docker Compose for DB + services; easy local run

---

## Quick Start

### Prerequisites
- Java 17+
- Maven 3.9+
- Node 18+
- Docker (optional but recommended for Postgres)

### 1) Configure database
Set DB credentials in `backend/src/main/resources/application.yml` (defaults point to docker compose).

### 2) Start Postgres (via Docker)
```bash
docker compose up -d db
```

### 3) Run Backend
```bash
cd backend
./mvnw spring-boot:run   # or mvnw.cmd on Windows
```
App runs on `http://localhost:8080`. Swagger UI at `/swagger-ui/index.html` after start.

### 4) Run Frontend
```bash
cd ../frontend
npm i
npm run dev
```
Open the shown local URL (usually `http://localhost:5173`).

### 5) Default credentials (seed data)
- Admin: `admin@healthops.com` / `Admin@123`
- Doctor: `doc1@healthops.com` / `Doctor@123`
- Receptionist: `reception@healthops.com` / `Reception@123`

> Change these immediately in production.

### 6) Docker all‑in‑one (optional)
```bash
docker compose up --build
```
Frontend at `http://localhost:5173`, backend at `http://localhost:8080`.

---

## Project Structure

```
HealthOps/
  backend/           # Spring Boot app (API + Auth + DB + Swagger)
  frontend/          # React+Vite+TS app (role‑based dashboards)
  docker-compose.yml # Postgres + services
```

See inline comments in code for extension points (reports, PDF, email, etc.).
