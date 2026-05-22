# Deployment guide

## Vercel (recommended production)

### Checklist — `king-g-api`

- [ ] GitHub repo linked, branch `main`
- [ ] Root Directory: **`server`**
- [ ] Framework: **Express**
- [ ] Output Directory: **`dist`**
- [ ] Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`
- [ ] Deploy succeeds; `GET /api/health` returns `{"ok":true}`

### Checklist — `king-g-system`

- [ ] Root Directory: **`.`** (repo root)
- [ ] Framework: **Vite**
- [ ] Output Directory: **`dist`**
- [ ] Env: `VITE_API_URL` = `https://king-g-api.vercel.app` (no trailing slash)
- [ ] Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Redeploy after changing `VITE_API_URL`
- [ ] Login request in browser Network tab targets **king-g-api**, not king-g-system

### Verify login path

1. Open frontend → DevTools → Network.
2. Sign in.
3. Confirm: `POST https://king-g-api.vercel.app/api/auth/login`
4. **200** + `token` = success; **401** = bad credentials; **405** = frontend still missing `VITE_API_URL`.

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

Use `.env` locally only; never commit real values.
