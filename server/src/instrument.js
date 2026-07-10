/**
 * Sentry must initialize before Express routes handle traffic.
 * Imported first from app.js (covers local + Vercel entry).
 */
import * as Sentry from "@sentry/node";

const dsn = (process.env.SENTRY_DSN || "").trim();
const isProd = process.env.NODE_ENV === "production";

if (dsn) {
  if (!Sentry.getClient()) {
    Sentry.init({
      dsn,
      environment: isProd ? "production" : "development",
      sendDefaultPii: false,
      tracesSampleRate: isProd ? 0.15 : 1.0,
    });
  }
} else if (!isProd) {
  console.info("[sentry] SENTRY_DSN not set — API monitoring disabled");
}

export { Sentry };
