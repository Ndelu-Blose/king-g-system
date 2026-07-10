# Deployment guide

## Vercel (recommended production)

### Checklist — `king-g-api`

- [ ] GitHub repo linked, branch `main`
- [ ] Root Directory: **`server`**
- [ ] Framework: **Express**
- [ ] Output Directory: **`dist`**
- [ ] Env: `SUPABASE_URL` = `https://tpydiklyduxjkvenfvzd.supabase.co` (**King G only** — not Physio-Med `suammivasszztkukzjeh`)
- [ ] Env: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `JWT_SECRET`
- [ ] Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL=noreply@kinggeelfs.co.za`
- [ ] Env: `APP_URL` = `https://king-g-system.vercel.app` (password-reset email links)
- [ ] Env: `SENTRY_DSN` = client/server DSN from Sentry project **cliveux / king-g-system**
- [ ] Deploy succeeds; `GET /api/health` returns `{"ok":true,"kingGProjectConfigured":true,"userEmailsReady":true}`

### Checklist — `king-g-system`

- [ ] Root Directory: **`.`** (repo root)
- [ ] Framework: **Vite**
- [ ] Output Directory: **`dist`**
- [ ] Env: `VITE_API_URL` = `https://king-g-api.vercel.app` (no trailing slash)
- [ ] Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Env: `VITE_SENTRY_DSN` = same DSN as API `SENTRY_DSN` (public; safe in the client bundle)
- [ ] Env: `SENTRY_AUTH_TOKEN` = org auth token for source map upload on build (**secret** — never commit)
- [ ] Optional: `SENTRY_ORG=cliveux`, `SENTRY_PROJECT=king-g-system`
- [ ] Redeploy after changing `VITE_API_URL` or `VITE_SENTRY_DSN`
- [ ] Login request in browser Network tab targets **king-g-api**, not king-g-system

### Verify Sentry

1. Local: set `VITE_SENTRY_DSN` / `SENTRY_DSN`, open `/sentry-example-page`, send a test error.
2. API: `GET /api/debug-sentry` should create an Issue (remove that route after verification).
3. Production build with `SENTRY_AUTH_TOKEN` uploads hidden source maps; `.env.sentry-build-plugin` must stay gitignored.
### Verify login path

1. Open frontend → DevTools → Network.
2. Sign in.
3. Confirm: `POST https://king-g-api.vercel.app/api/auth/login`
4. **200** + `token` = success; **401** = bad credentials; **405** = frontend still missing `VITE_API_URL`.

### Password-reset email links

Supabase Auth must use your **production** URL, not `localhost`:

```bash
npm run setup:auth-urls
```

This sets `site_url` to `https://king-g-system.vercel.app` and allows redirect URLs for production + local dev. After changing URLs, request a **new** reset email — old links still point at the previous `site_url`.

## Docker (local / staging)

```bash
cp .env.example .env
# fill Supabase + JWT values
docker compose up --build
```

- API: http://localhost:3001
- UI: http://localhost:5187

## Secrets

| Secret | Frontend Vercel | API Vercel | Git |
|--------|-----------------|------------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Never | Yes | Never |
| `JWT_SECRET` | Never | Yes | Never |
| `VITE_SUPABASE_ANON_KEY` | Yes | No | Never |
| `VITE_API_URL` | Yes | No | Never |
| `VITE_SENTRY_DSN` | Yes | No | Never (use `.env` locally) |
| `SENTRY_DSN` | No | Yes | Never |
| `SENTRY_AUTH_TOKEN` | Yes (build) | No | Never — also ignore `.env.sentry-build-plugin` |

Use `.env` locally only; never commit real values.
