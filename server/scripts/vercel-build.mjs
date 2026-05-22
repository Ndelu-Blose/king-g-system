/**
 * Vercel Express preset expects an entry under outputDirectory (often "dist").
 * Copy runtime sources into dist/ so detection finds dist/index.js + dist/src/app.js.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const copyFile = (name) => {
  fs.copyFileSync(path.join(root, name), path.join(dist, name));
};

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(path.join(root, "src"), path.join(dist, "src"), { recursive: true });
copyFile("auth.js");
copyFile("permissions.js");
fs.writeFileSync(
  path.join(dist, "index.js"),
  "export { default } from './src/app.js';\n",
  "utf8"
);

console.log("Prepared dist/ for Vercel Express");
