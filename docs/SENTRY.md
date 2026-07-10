# Sentry (King G)

Organisation: **cliveux** · Project: **king-g-system**

This app is **Vite + React + Express**, not Next.js. Do not run `npx @sentry/wizard -i nextjs`.

## Local setup

1. In Sentry → Project Settings → Client Keys (DSN), copy the DSN.
2. Add to repo-root `.env` (gitignored):

```bash
VITE_SENTRY_DSN=https://...@....ingest.sentry.io/...
SENTRY_DSN=https://...@....ingest.sentry.io/...
```

3. For source map uploads on `npm run build`, create an org auth token with `project:releases` / `org:read` and either:

```bash
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=cliveux
SENTRY_PROJECT=king-g-system
```

or a gitignored `.env.sentry-build-plugin` (never commit this file).

4. Verify:

- UI: `npm run dev` → [http://localhost:8080/sentry-example-page](http://localhost:8080/sentry-example-page) → send test error
- API: with server running, `GET http://localhost:3001/api/debug-sentry`

Then open Sentry → Issues for **king-g-system**.

Remove `/sentry-example-page` and `/api/debug-sentry` after verification.

## Vercel

| Project | Variables |
|---------|-----------|
| `king-g-system` (frontend) | `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (secret), optional `SENTRY_ORG` / `SENTRY_PROJECT` |
| `king-g-api` (API) | `SENTRY_DSN` |

Redeploy after setting env vars. DSN is safe in the client bundle; **`SENTRY_AUTH_TOKEN` must never be committed**.
