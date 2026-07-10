/**
 * Temporary page to verify Sentry client capture.
 * Remove after confirming Issues appear in the king-g-system project.
 */
import { useState } from "react";
import { Sentry } from "@/sentry";

export default function SentryExamplePage() {
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "hsl(220 20% 10%)",
        color: "hsl(40 20% 92%)",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ maxWidth: "28rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Sentry test</h1>
        <p style={{ color: "hsl(220 10% 55%)", marginBottom: "1.5rem", fontFamily: "Arial, sans-serif", fontSize: "0.9rem" }}>
          Triggers a client error for the <code>king-g-system</code> project. Remove this page after verification.
        </p>
        <button
          type="button"
          onClick={() => {
            setLastAction("captureException");
            Sentry.captureException(new Error("King G Sentry example error"));
          }}
          style={{
            display: "block",
            width: "100%",
            marginBottom: "0.75rem",
            padding: "0.75rem 1rem",
            background: "hsl(32 45% 58%)",
            color: "hsl(220 20% 8%)",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Send test error to Sentry
        </button>
        <button
          type="button"
          onClick={() => {
            setLastAction("throw");
            throw new Error("King G Sentry uncaught example error");
          }}
          style={{
            display: "block",
            width: "100%",
            padding: "0.75rem 1rem",
            background: "transparent",
            color: "hsl(40 20% 92%)",
            border: "1px solid hsl(32 45% 58%)",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Throw uncaught error
        </button>
        {lastAction === "captureException" && (
          <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "hsl(142 40% 55%)", fontFamily: "Arial, sans-serif" }}>
            Event sent. Check Sentry → Issues → king-g-system.
          </p>
        )}
      </div>
    </div>
  );
}
