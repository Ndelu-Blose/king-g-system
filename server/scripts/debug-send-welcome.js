/**
 * Test welcome email send for one user (local diagnostic).
 * Usage: USER_EMAIL=someone@example.com node server/scripts/debug-send-welcome.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const email = process.env.USER_EMAIL?.trim().toLowerCase();
if (!email) {
  console.error("Set USER_EMAIL");
  process.exit(1);
}

const { getUserByEmail } = await import("../src/services/users.service.js");
const { sendUserWelcomeEmail } = await import("../src/services/users.service.js");

const user = await getUserByEmail(email);
if (!user) {
  console.error("User not found:", email);
  process.exit(1);
}

console.log("Sending welcome to", email, "id=", user.id, "authUserId=", user.authUserId);

try {
  const result = await sendUserWelcomeEmail(user.id);
  console.log("OK", result);
} catch (e) {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
}
