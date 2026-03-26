import app from "./app.js";

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`King G API running at http://localhost:${PORT} (SQLite database)`);
});

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT=3002.`);
    process.exit(1);
  }
  throw err;
});

