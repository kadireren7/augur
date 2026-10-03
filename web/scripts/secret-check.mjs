import { existsSync, readFileSync, readdirSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "../..");
for (const path of [".env", "web/.env.local"]) {
  const full = join(root, path);
  if (existsSync(full)) loadEnvFile(full);
}
const secrets = Object.entries(process.env).filter(
  ([name, value]) =>
    !name.startsWith("NEXT_PUBLIC_") &&
    !/(ADDRESS|WORKFLOW_ID|CHAIN_ID)$/.test(name) &&
    /(PRIVATE_KEY|API_KEY|API_TOKEN|SECRET|TOKEN)/.test(name) &&
    value?.length >= 16,
);
if (process.env.ALCHEMY_MONAD_RPC_URL) {
  secrets.push(["ALCHEMY_MONAD_RPC_URL", process.env.ALCHEMY_MONAD_RPC_URL]);
  const segments = new URL(process.env.ALCHEMY_MONAD_RPC_URL).pathname
    .split("/")
    .filter(Boolean);
  const key = segments.at(-1);
  if (key?.length >= 16) secrets.push(["ALCHEMY_RPC_CREDENTIAL", key]);
}
const hits = [];
function check(text, label) {
  for (const [name, value] of secrets)
    if (text.includes(value)) hits.push({ name, location: label });
}
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (/\.(js|json|css)$/.test(entry.name))
      check(readFileSync(path, "utf8"), "browser bundle");
  }
}
if (existsSync(join(root, "web/.next/static")))
  scan(join(root, "web/.next/static"));
check(
  execFileSync("git", ["diff", "--cached", "--no-ext-diff"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  }),
  "staged diff",
);
const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);
const privateFiles = staged.filter(
  (path) =>
    (/(^|\/)\.env($|\.)/.test(path) && !path.endsWith(".env.example")) ||
    path.includes(".vercel/") ||
    /\.sqlite3$/.test(path),
);
console.log(
  JSON.stringify(
    {
      status: hits.length || privateFiles.length ? "FAIL" : "PASS",
      credentialMatches: hits,
      privateFiles,
    },
    null,
    2,
  ),
);
if (hits.length || privateFiles.length) process.exitCode = 1;
