import type { ReactNode } from "react";
import { Sentry } from "@/sentry";

interface Props {
  children: ReactNode;
}

function FallbackUI({ resetError }: { resetError: () => void }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "hsl(220 20% 10%)",
        color: "hsl(40 20% 92%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ maxWidth: "28rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
        <p style={{ color: "hsl(220 10% 55%)", marginBottom: "1rem" }}>
          Please refresh the page and try again.
        </p>
        <button
          type="button"
          onClick={() => {
            resetError();
            window.location.reload();
          }}
          style={{
            padding: "0.5rem 1rem",
            background: "hsl(32 45% 58%)",
            color: "hsl(220 20% 8%)",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: Props) {
  return (
    <Sentry.ErrorBoundary fallback={({ resetError }) => <FallbackUI resetError={resetError} />}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
