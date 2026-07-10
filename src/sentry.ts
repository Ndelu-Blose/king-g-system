import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim() || "";
const isProd = import.meta.env.PROD;

export function initSentry() {
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info("[sentry] VITE_SENTRY_DSN not set — client monitoring disabled");
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: isProd ? "production" : "development",
    sendDefaultPii: false,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: isProd ? 0.15 : 1.0,
    replaysSessionSampleRate: isProd ? 0.05 : 0.1,
    replaysOnErrorSampleRate: 1.0,
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/king-g-api\.vercel\.app\/api/,
      /^\//,
    ],
  });
}

export { Sentry };
