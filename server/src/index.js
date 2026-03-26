import app from "./app.js";

const PORT = process.env.PORT || 3001;
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET"];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const server = app.listen(PORT, () => {
  console.log(`King G API running at http://localhost:${PORT} (Supabase-backed)`);
});

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT=3002.`);
    process.exit(1);
  }
  throw err;
});

