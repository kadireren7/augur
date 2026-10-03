import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
// Explicit shell variables win; Next production-local files win over root defaults.
for (const path of [".env.production.local", ".env.local", "../.env", ".env.production", ".env"]) {
  const absolute = resolve(webRoot, path);
  if (existsSync(absolute)) loadEnvFile(absolute);
}
process.env.ENVIO_GRAPHQL_URL ||= "http://localhost:8080/v1/graphql";

try {
  if (process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "10143") throw new Error();
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID || !process.env.NEXT_PUBLIC_MONAD_RPC_URL) throw new Error();
  if (process.env.NEXT_PUBLIC_PRIVY_LOCAL_MODE === "true") throw new Error();
} catch {
  console.error("Demo requires Monad chain 10143, NEXT_PUBLIC_PRIVY_APP_ID and NEXT_PUBLIC_MONAD_RPC_URL.");
  process.exit(1);
}

try {
  const endpoint = new URL(process.env.ENVIO_GRAPHQL_URL);
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))) throw new Error();
  const response = await fetch(endpoint, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "{ chain_metadata { chain_id } Chamber { id } }" }),
    signal: AbortSignal.timeout(5000),
  });
  const body = await response.json();
  if (!response.ok || body.errors || !body.data?.chain_metadata?.some(row => Number(row.chain_id) === 10143)
    || !body.data?.Chamber?.some(row => row.id === "0x9d6541b7a855bf7ca5f61517da868a754950af304a1953120ff275bdde0cfc2a")) throw new Error();
} catch {
  console.error("Envio unavailable, misconfigured, or missing the deployed Monad Chamber. Demo startup stopped; check ENVIO_GRAPHQL_URL and the indexer.");
  process.exit(1);
}
console.log("Demo configuration verified: ENVIO data, Monad Testnet 10143, Privy configured.");
const require = createRequire(import.meta.url);
const command = process.argv[2] === "build" ? "build" : "start";
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), command], {
  cwd: webRoot, env: process.env, stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
