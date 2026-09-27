export interface EnvioHealth {
  configured: boolean;
  status: "UNCONFIGURED" | "HEALTHY" | "UNHEALTHY";
  lastIndexedBlock: string | null;
}

export async function checkEnvioHealth(): Promise<EnvioHealth> {
  const endpoint = process.env.ENVIO_GRAPHQL_URL;
  if (!endpoint) return { configured: false, status: "UNCONFIGURED", lastIndexedBlock: null };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "query Health { Omen(limit: 1, order_by: { blockNumber: desc }) { blockNumber } }",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("indexer unavailable");
    const body = await response.json() as {
      data?: { Omen?: Array<{ blockNumber: string | number }> };
      errors?: unknown[];
    };
    if (body.errors || !body.data) throw new Error("indexer query failed");
    return {
      configured: true,
      status: "HEALTHY",
      lastIndexedBlock: body.data.Omen?.[0]?.blockNumber?.toString() ?? null,
    };
  } catch {
    return { configured: true, status: "UNHEALTHY", lastIndexedBlock: null };
  }
}
