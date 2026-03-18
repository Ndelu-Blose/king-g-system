import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = "<div style='padding:2rem;background:#1a1d24;color:#e8e4dc;min-height:100vh;font-family:sans-serif'>No root element. Check index.html.</div>";
} else {
  try {
    createRoot(rootEl).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    rootEl.innerHTML = `<div style='padding:2rem;background:#1a1d24;color:#e8e4dc;min-height:100vh;font-family:sans-serif'><h1>Failed to start</h1><p>${msg}</p><button onclick="location.reload()" style='margin-top:1rem;padding:0.5rem 1rem;background:#b8956e;color:#1a1d24;border:none;border-radius:0.5rem;cursor:pointer'>Reload</button></div>`;
    console.error(err);
  }
}
