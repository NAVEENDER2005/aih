# AI Hirer
### Intelligent Multi-Stage Hiring & Talent Evaluation Platform

A full-stack hiring platform that automates end-to-end candidate evaluation across five structured rounds using AI-powered scoring and a human-in-the-loop control model.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Backend | Java 17, Spring Boot 3, Spring Security, JPA/Hibernate |
| AI Layer | Python 3.10+, FastAPI, Pydantic |
| Database | PostgreSQL 15 |
| Auth | JWT (RFC 7519) + Role-Based Access Control |
| Infrastructure | Docker, docker-compose |

---

## Getting Started

### Prerequisites

- JDK 17+
- Node.js 18+
- Python 3.10+
- Maven 3.8+
- Docker Desktop

---

### Step 1 — Start the Database

```bash
docker-compose up -d
```

PostgreSQL starts on `localhost:5432` with database `aihirer`.

---

### Step 2 — Start the Backend

```bash
cd backend
mvn spring-boot:run
```

Server starts on **http://localhost:8080**

On first run, Hibernate auto-creates all database tables.

---

### Step 3 — Start the AI Layer

```bash
cd ai-layer
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

AI service starts on **http://localhost:8000**  
Interactive API docs available at: **http://localhost:8000/docs**

> **Optional**: Add a GitHub Personal Access Token to `ai-layer/.env` for higher API rate limits:
> ```
> GITHUB_TOKEN=your_token_here
> ```

---

### Step 4 — Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on **http://localhost:3000**

---

## Startup Order

Always start services in this order:

```
1. PostgreSQL  →  2. Spring Boot  →  3. FastAPI  →  4. Next.js
```

---

## User Roles

| Role | Access |
|------|--------|
| **Candidate** | Browse jobs, apply, take tests, upload BGV docs, accept/reject offers |
| **HR** | Create jobs, manage candidate pipeline, import results, generate offers |

---

## Hiring Rounds

Candidates progress through 5 sequential, AI-evaluated rounds:

| Round | Name | Type |
|-------|------|------|
| 1 | Skill Screening | AI-generated MCQ |
| 2 | Aptitude Test | Cognitive assessment |
| 3 | Coding Challenge | Static code analysis |
| 4 | Technical HR Interview | Video + LLM analysis |
| 5 | General HR Interview | Behavioral video analysis |

Each round has a configurable cutoff score. HR manually triggers progression between rounds (human-in-the-loop).

---

## API Reference

| Base URL | Service |
|----------|---------|
| `http://localhost:8080/api` | Backend (Spring Boot) |
| `http://localhost:8000` | AI Layer (FastAPI) |

### Key Endpoints

```
POST /api/auth/register          — Register new user
POST /api/auth/login             — Login and get JWT token
GET  /api/jobs/open              — Browse open jobs (Candidate)
POST /api/applications/apply     — Apply for a job (Candidate)
POST /api/tests/start/{id}       — Start current round test (Candidate)
POST /api/tests/submit/{id}      — Submit test answers (Candidate)
POST /api/hr/jobs                — Create a job (HR)
POST /api/applications/promote   — Promote candidate to next round (HR)
POST /api/applications/reject    — Reject a candidate (HR)
POST /api/bgv/update-status      — Update BGV status (HR)
POST /ai/analyze-profile         — Score GitHub/LinkedIn profile (AI)
POST /ai/analyze-coding          — Evaluate submitted code (AI)
POST /ai/compute-final-decision  — Generate final hire/reject decision (AI)
POST /ai/analyze-video           — Process interview video (AI)
POST /ai/generate-offer          — Draft offer letter (AI)
```

---

## Environment Configuration

**Backend** (`backend/src/main/resources/application.properties`):
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/aihirer
spring.datasource.username=postgres
spring.datasource.password=512020
jwt.expiration=86400000
fastapi.url=http://127.0.0.1:8000
```

**Database** (`docker-compose.yml`):
```yaml
POSTGRES_USER: postgres
POSTGRES_PASSWORD: 512020
POSTGRES_DB: aihirer
```

---

## Project Structure

```
ai-hirer/
├── frontend/          # Next.js 14 application
│   ├── src/app/       # App Router pages (candidate, hr, auth)
│   └── src/components/# Reusable React components
├── backend/           # Spring Boot 3 application
│   └── src/main/java/com/aihirer/backend/
│       ├── controller/    # REST API controllers
│       ├── service/       # Business logic
│       ├── model/         # JPA entities
│       ├── repository/    # Spring Data repositories
│       └── security/      # JWT auth & RBAC
├── ai-layer/          # FastAPI AI service
│   └── main.py        # All AI endpoints
└── docker-compose.yml # PostgreSQL container
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Connection refused` on 5432 | Run `docker-compose up -d` |
| `JDBC Connection failed` | Verify `application.properties` credentials match Docker |
| `401 Unauthorized` | JWT expired — log in again |
| `403 Forbidden` | Wrong role token for endpoint |
| GitHub score = 0 | Add `GITHUB_TOKEN` to `ai-layer/.env` |
| Frontend blank page | Ensure backend is running on port 8080 |
