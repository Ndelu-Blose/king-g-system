# King G API

Express REST API for the King G frontend. All persistent data goes through **Supabase** (no local JSON/SQLite store).

## Run locally

```bash
cd server
npm install
npm start
```

Requires root `.env` (or `server/.env`) with:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

Default URL: http://localhost:3001

## Tests

```bash
npm run test:unit          # fast tests (no live Supabase)
npm run test:integration   # workflows (needs Supabase env)
```

## Vercel

This folder is the **Root Directory** for the `king-g-api` Vercel project.

- `npm run build` → `scripts/vercel-build.mjs` prepares `dist/` for the Express preset
- `vercel.json` sets `outputDirectory: dist`
- Do not add a `server/api/` folder; Vercel reserves `/api/*` for separate functions and breaks Express routes

## Layout

```
server/
├── src/
│   ├── app.js              # Express app and routes
│   ├── index.js            # Local dev server (listen on PORT)
│   ├── lib/                # Supabase client, passwords, auth helpers
│   └── services/           # pos, receiving, users, reports
├── auth.js                 # JWT login + middleware
├── permissions.js          # RBAC helpers
├── tests/
└── scripts/
    ├── vercel-build.mjs    # Vercel production build
    └── set-user-password.js
```

## Main endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health`, `/api/health` | No | Health check |
| POST | `/api/auth/login` | No | Email/password → JWT |
| GET | `/api/auth/me` | Bearer | Current user |
| GET | `/api/products` | No* | Product catalog |
| POST | `/api/sales` | Bearer | Create sale |
| … | receiving, users, audit | Varies | See `src/app.js` |

\*Some routes are public for POS reads; writes require JWT and permissions.

## Set a user password (local)

```bash
cd server
# Windows
set OWNER_EMAIL=owner@kingg.co.za
set OWNER_PASSWORD=your-secure-password
node scripts/set-user-password.js
```

Use User Management in the app when an owner is already signed in.
