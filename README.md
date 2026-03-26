# King-G-System

Inventory / POS management system.

## Architecture

This repo is a **full-stack monorepo**:

- **Frontend**: Vite + React (repo root)
- **Backend API**: Express (Supabase-backed REST API in `server/`)
- **Database roadmap**: Supabase (scaffolded; backend uses service role key)
- **CI**: GitHub Actions (`.github/workflows/ci.yml`)

## Prerequisites

- **Recommended Node**: **20.x** (matches CI)
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
  - `VITE_API_URL` (default `http://localhost:3001`)
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

Compose runs `frontend` + `backend` containers; Supabase stays external.

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001/health`

## CI

Workflow: `.github/workflows/ci.yml`

Runs on pushes to `main` + `fix/supabase-conflicts`, and PRs targeting `main`:

- Frontend: install → lint → test → build
- Backend: install → test
- Docker: build both images

## Vercel deployment

Deploy as **two Vercel projects** from this monorepo:

1. **Backend project** (root directory: `server/`)
2. **Frontend project** (root directory: repo root)

### 1) Deploy backend API (`server/`)

- In Vercel, create/import project and set **Root Directory** to `server`.
- `server/vercel.json` routes all requests to the Express app through `server/api/index.js`.
- Add backend environment variables in Vercel:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT_SECRET`
  - `PORT` is optional on Vercel (platform assigns it).

After deploy, note the backend URL (example: `https://king-g-api.vercel.app`).

### 2) Deploy frontend app (repo root)

- Create/import another Vercel project with root at repo root.
- Root `vercel.json` uses Vite build output (`dist`).
- Add frontend environment variables:
  - `VITE_API_URL` = your backend URL from step 1 (example: `https://king-g-api.vercel.app`)
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

Then redeploy frontend so it picks up `VITE_API_URL`.

### Quick verification

- Open `https://<backend-domain>/api/health` and confirm `{ "ok": true }`.
- Open the frontend domain and verify login/product calls succeed without CORS errors.

## Backend structure

- `server/src/app.js`: Express app (importable for tests)
- `server/src/index.js`: starts the HTTP listener
- `server/tests/*`: Jest + Supertest API tests
- `server/src/lib/supabase.js`: Supabase admin client factory
- `server/src/services/*`: service layer (routes → services → Supabase/client)