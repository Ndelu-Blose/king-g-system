# Authentication (production)

King G uses a **two-layer** model that is standard for business apps:

| Layer | Where | Who maintains it |
|--------|--------|------------------|
| **Identity** (email + password, reset emails, lockout) | [Supabase](https://supabase.com) → **Authentication → Users** | Owners / managers via Supabase dashboard **or** in-app **User Management** |
| **Authorization** (role: owner, manager, cashier, active flag) | Postgres `public.users` | In-app **User Management** (owners only) |

You only maintain passwords **once** — in Supabase Auth. The app never stores duplicate passwords in `password_hash` for linked accounts.

## For owners (low-tech day-to-day)

### Add a new staff member

**Option A — In the app (recommended)**  
1. Sign in as **owner** → **Users & Roles** → **Add user**  
2. Enter name, email, role, and a temporary password  
3. Tell the person their email + password (or they use **Forgot password** on the login page)

**Option B — Supabase dashboard**  
1. **Authentication → Users → Add user** (email + password)  
2. Add a matching row in **Table Editor → `users`** with the same email and the correct **role**, **or** run the link script below  

### Reset a password

- **In app:** Users & Roles → ⋮ → **Change password**  
- **Self-service:** Login page → **Forgot password?** (sends Supabase email)  
- **Dashboard:** Authentication → Users → select user → send magic link / reset  

### Disable someone

Users & Roles → deactivate (or delete). Deleting removes both the Auth user and the profile.

## For developers (deployments & upgrades)

### Required environment variables

**API (`king-g-api` on Vercel)**

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server DB + Auth admin (never expose to browser) |
| `SUPABASE_ANON_KEY` | Server-side Auth sign-in (same as frontend anon key) |
| `JWT_SECRET` | Legacy dev tokens only; keep set until all users are on Auth |

**Frontend (`king-g-system` on Vercel)**

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | `https://king-g-api.vercel.app` (no trailing slash) |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon / publishable key |

Redeploy **both** projects after changing env vars.

### Database migration

Apply `supabase/migrations/20260525100000_link_auth_users.sql` (adds `auth_user_id` on `public.users`).

In Supabase SQL Editor, or:

```bash
supabase db push
```

### Link an existing Auth user to a profile

When someone was created under **Authentication → Users** before a `public.users` row existed:

```bash
cd server
set USER_EMAIL=owner@example.com
node scripts/link-auth-profile.js
```

### How sign-in works

1. Browser calls `supabase.auth.signInWithPassword`  
2. App sends the Supabase **access token** to `GET /api/auth/me`  
3. API validates the token with Supabase and loads **role** from `public.users`  
4. RBAC permissions use `public.users.role` only (never JWT `user_metadata`)

Legacy `password_hash` logins still work for old accounts until linked to Auth.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| Invalid credentials, user exists in Auth | Profile missing or `auth_user_id` not linked | Add/link `public.users` row; run `link-auth-profile.js` |
| Signed in but “no profile” | Auth OK, no `public.users` row | Owner adds user in User Management |
| Works locally, fails in production | Frontend missing `VITE_SUPABASE_*` or wrong API URL | Set Vercel env vars and redeploy |
| Password works in Supabase UI, not in app | Password only in Auth, profile uses old hash | Link profile; use Forgot password or Change password in app |
