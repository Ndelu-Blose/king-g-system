/**
 * Prints the SQL to run once in Supabase → SQL Editor (production migration).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const path = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../supabase/migrations/20260525100000_link_auth_users.sql"
);
console.log("Run this in Supabase Dashboard → SQL Editor → New query:\n");
console.log(readFileSync(path, "utf8"));
