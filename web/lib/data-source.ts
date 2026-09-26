import type { ChamberView, ChronicleView } from "@/lib/types";
import { buildChronicle } from "@/lib/chronicle";
import { getStore } from "@/lib/store";

export interface AugurDataSource {
  readonly mode: "LOCAL" | "ENVIO";
  listChambers(): Promise<ChamberView[]>;
  getChamber(slug: string): Promise<ChamberView | null>;
  getChronicle(): Promise<ChronicleView>;
}

export class LocalDataSource implements AugurDataSource {
  readonly mode = "LOCAL" as const;

  async listChambers(): Promise<ChamberView[]> {
    return getStore().listChambers();
  }

  async getChamber(slug: string): Promise<ChamberView | null> {
    try {
      return getStore().getChamber(slug);
    } catch {
      return null;
    }
  }

  async getChronicle(): Promise<ChronicleView> {
    return buildChronicle(getStore());
  }
}

export class EnvioDataSource implements AugurDataSource {
  readonly mode = "ENVIO" as const;

  constructor(private readonly endpoint: string) {
    if (!endpoint.startsWith("https://") && !endpoint.startsWith("http://localhost:")) {
      throw new Error("ENVIO_GRAPHQL_URL must use HTTPS or localhost HTTP");
    }
  }

  async listChambers(): Promise<ChamberView[]> {
    const data = await this.query<{ ChamberView: Array<{ payload: ChamberView }> }>(
      `query Chambers { ChamberView(order_by: { id: asc }) { payload } }`,
    );
    return data.ChamberView.map((entry) => entry.payload);
  }

  async getChamber(slug: string): Promise<ChamberView | null> {
    const data = await this.query<{ ChamberView: Array<{ payload: ChamberView }> }>(
      `query Chamber($slug: String!) { ChamberView(where: { slug: { _eq: $slug } }) { payload } }`,
      { slug },
    );
    return data.ChamberView[0]?.payload ?? null;
  }

  async getChronicle(): Promise<ChronicleView> {
    const data = await this.query<{ ChronicleSnapshot: Array<{ payload: ChronicleView }> }>(
      `query Chronicle { ChronicleSnapshot(limit: 1, order_by: { updatedAt: desc }) { payload } }`,
    );
    const snapshot = data.ChronicleSnapshot[0];
    if (!snapshot) throw new Error("Envio returned no Chronicle snapshot");
    return snapshot.payload;
  }

  private async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Envio request failed with status ${response.status}`);
    const body = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (body.errors?.length || !body.data) throw new Error("Envio query failed");
    return body.data;
  }
}

export function getDataSource(): AugurDataSource {
  const endpoint = process.env.ENVIO_GRAPHQL_URL;
  return endpoint ? new EnvioDataSource(endpoint) : new LocalDataSource();
}
