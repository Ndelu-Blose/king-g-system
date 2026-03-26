# King-G-System

Inventory / POS management system.

## Architecture

This repo is a **full-stack monorepo**:

- **Frontend**: Vite + React (repo root)
- **Backend API**: Express + SQLite (in `server/`)
- **Database roadmap**: Supabase (scaffolded; backend uses service role key)
- **CI**: GitHub Actions (`.github/workflows/ci.yml`)

## Prerequisites

- **Recommended Node**: **22.x** (CI uses Node 22)
  - Note: On Windows, `better-sqlite3` may fail to install on **Node 24** without Visual Studio Build Tools.
- Docker (optional, for running via Compose)

## Setup (local dev)

Install and start the frontend:

```bash
npm install
npm run dev
```

Start the backend API in another terminal:

```bash
npm run dev:server
```

## Environment variables

Copy the examples and fill in real values:

```bash
copy .env.example .env
copy server\\.env.example server\\.env
```

- **Frontend (`.env`)** (Vite-exposed):
  - `VITE_API_BASE_URL` (default `http://localhost:3001`)
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Backend (`server/.env`)** (private):
  - `PORT` (default `3001`)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (**never put this in frontend env**)
  - `JWT_SECRET`

## Testing

Frontend:

```bash
npm run lint
npm run test
npm run build
```

Backend:

```bash
cd server
npm test
```

## Docker (optional)

Compose uses the example env files by default:

```bash
docker compose --profile local up --build
```

- Frontend: `http://localhost:4173`
- Backend: `http://localhost:3001/api/health`

## CI

Workflow: `.github/workflows/ci.yml`

Runs on pushes/PRs to `main` and `develop`:

- Frontend: install → lint → test → build
- Backend: install → test
- Docker: build both images

## Backend structure

- `server/src/app.js`: Express app (importable for tests)
- `server/src/index.js`: starts the HTTP listener
- `server/tests/*`: Jest + Supertest API tests
- `server/src/lib/supabase.js`: Supabase admin client factory
- `server/src/services/*`: service layer (routes → services → Supabase/client)