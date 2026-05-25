# King G System

Enterprise POS and operations platform for lounge and retail workflows: sales, inventory receiving, role-based access, and reporting.

| Environment | URL |
|-------------|-----|
| Frontend (production) | https://king-g-system.vercel.app |
| API (production) | https://king-g-api.vercel.app |

Repository: https://github.com/Ndelu-Blose/king-g-system

---

## Features

- **POS** — barcode/search, cart, payments, receipts, duplicate-sale protection
- **Inventory** — receive stock (draft → verify → confirm), blind transfer, audit trail
- **RBAC** — Owner, Senior Manager, Manager, Cashier, Operator
- **Operations** — shifts, approvals, dashboards, reports
- **Security** — JWT auth, Supabase-backed data, GitHub Actions CI

---

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Vite, React, TypeScript |
| API | Express (Node 20) |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (passwords) + `public.users` roles + API JWT validation |
| CI | GitHub Actions |
| Hosting | Vercel (two projects: frontend + API) |

```
king-g-system/
├── src/                 # React app
├── server/              # Express API (Vercel root: server/)
├── supabase/            # migrations (if present)
├── .github/workflows/   # CI
├── docker-compose.yml   # local full stack
└── docs/                # role and permission notes
```

---

## Prerequisites

- Node.js **20.x**
- npm
- Supabase project (URL, anon key, service role key)
- Docker (optional, for compose)

---

## Local development

### 1. Environment

Copy `.env.example` to `.env` in the **repo root** and set:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` (API)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)

Leave `VITE_API_URL` unset locally so Vite proxies `/api` → `http://localhost:3001`.

### 2. Install and run

**Terminal 1 — API**

```bash
cd server
npm install
npm start
```

**Terminal 2 — frontend** (repo root)

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:8080`). See [RUN.md](./RUN.md) for login, firewall, and cashier workflows.

### 3. Docker (optional)

```bash
cp .env.example .env   # fill in real values
docker compose up --build
```

- Frontend: http://localhost:5187 (host port 5187; 5173 is often taken locally)
- API: http://localhost:3001/health

---

## Production deployment (Vercel)

Production uses **two** Vercel projects from this monorepo. Do not deploy only the frontend without the API.

### Project A — `king-g-api` (backend)

| Setting | Value |
|---------|--------|
| Root Directory | `server` |
| Framework Preset | Express |
| Output Directory | `dist` (filled by `npm run build`) |
| Build Command | `npm run build` |

**Environment variables** (Production + Preview):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

Health check: `GET https://king-g-api.vercel.app/api/health` → `{"ok":true}`.

### Project B — `king-g-system` (frontend)

| Setting | Value |
|---------|--------|
| Root Directory | `.` (repository root) |
| Framework Preset | Vite |
| Output Directory | `dist` |

**Environment variables** (required for login):

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://king-g-api.vercel.app` |
| `VITE_SUPABASE_URL` | your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon key |

Redeploy the frontend after adding or changing `VITE_API_URL` (baked in at build time).

Do **not** put `SUPABASE_SERVICE_ROLE_KEY` or `JWT_SECRET` on the frontend project.

### Common production issues

| Symptom | Cause | Fix |
|---------|--------|-----|
| Login **405** | Browser posts to frontend URL `/api/...` (SPA) | Set `VITE_API_URL` and redeploy frontend |
| Login **401** | Wrong password or profile not linked to Auth | See [docs/AUTH.md](./docs/AUTH.md) |
| API build: no entrypoint in `dist` | Old deploy or missing build script | Deploy latest `main`; `server` runs `scripts/vercel-build.mjs` |
| `/api/*` **404** on API host | Reserved `server/api/` folder conflict | Fixed on `main` — use Express in `dist/` only |

More detail: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

---

## Scripts

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | root | Vite dev server |
| `npm run build` | root | Production frontend build |
| `npm run test:unit` | root | Frontend unit tests (Vitest) |
| `npm start` | `server/` | API on port 3001 |
| `npm test` | `server/` | API unit + integration tests |
| `docker compose up` | root | Frontend + API containers |

---

## CI

On push/PR to `main`, GitHub Actions runs frontend unit tests, backend unit tests, optional Supabase integration tests (when secrets are configured), and Docker image builds.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [RUN.md](./RUN.md) | Day-to-day run, login, cashier workflow |
| [SYSTEM.md](./SYSTEM.md) | System overview and roles |
| [server/README.md](./server/README.md) | API layout and endpoints |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Vercel and env checklist |
| [docs/roles-permissions.md](./docs/roles-permissions.md) | RBAC matrix |

---

## Contributing

- Default branch: `main`
- Open PRs against `main`; ensure CI passes
- Never commit `.env`, service role keys, or real passwords
