import {describe, expect, it} from "vitest";
// The startup boundary is also usable by deployment checks without loading secrets.
import {productionErrors} from "../scripts/production-check.mjs";
describe("production configuration", () => {
  it("rejects localhost indexing and missing database credentials", () => {
    const errors = productionErrors({ENVIO_GRAPHQL_URL:"http://localhost:8080/v1/graphql",NEXT_PUBLIC_MONAD_CHAIN_ID:"10143"});
    expect(errors).toContain("ENVIO_GRAPHQL_URL must be a publicly reachable HTTPS service, not localhost");
    expect(errors).toContain("Missing NEXT_PUBLIC_SUPABASE_URL");
    expect(errors).toContain("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});
