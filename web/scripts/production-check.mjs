export function productionErrors(env) {
  const errors = [];
  for (const name of [
    "NEXT_PUBLIC_PRIVY_APP_ID",
    "NEXT_PUBLIC_MONAD_RPC_URL",
    "ALCHEMY_MONAD_RPC_URL",
    "ENVIO_GRAPHQL_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_DEMO_TOKEN_ADDRESS",
    "NEXT_PUBLIC_CREATURE_REGISTRY_ADDRESS",
    "NEXT_PUBLIC_ROOM_REGISTRY_ADDRESS",
    "NEXT_PUBLIC_OMEN_PUBLISHER_ADDRESS",
    "NEXT_PUBLIC_NEXT_OMEN_MARKET_ADDRESS",
    "NEXT_PUBLIC_BATTLE_COORDINATOR_ADDRESS",
  ])
    if (!env[name]) errors.push(`Missing ${name}`);
  if (!env.SUPABASE_SECRET_KEY && !env.SUPABASE_SERVICE_ROLE_KEY)
    errors.push("Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
  if (env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "10143")
    errors.push("NEXT_PUBLIC_MONAD_CHAIN_ID must be 10143");
  if (env.NEXT_PUBLIC_PRIVY_LOCAL_MODE === "true")
    errors.push("Local wallet mode must be disabled in production");
  for (const name of ["ENVIO_GRAPHQL_URL", "SUPABASE_URL"]) {
    if (!env[name]) continue;
    try {
      const url = new URL(env[name]);
      if (
        url.protocol !== "https:" ||
        ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
      )
        throw new Error();
    } catch {
      errors.push(
        `${name} must be a publicly reachable HTTPS service, not localhost`,
      );
    }
  }
  return errors;
}
if (process.argv[1]?.endsWith("production-check.mjs")) {
  const errors = productionErrors(process.env);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "Production configuration present: Monad 10143, ENVIO, Privy, Alchemy, Supabase. Runtime connectivity still requires verification.",
    );
}
