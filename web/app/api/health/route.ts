import { NextResponse } from "next/server";

import { getPublicConfig } from "@/lib/config";
import { checkRpcHealth } from "@/lib/rpc";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getPublicConfig();
  const store = getStore();
  return NextResponse.json({
    web: "HEALTHY",
    rpc: await checkRpcHealth(),
    contracts: {
      token: Boolean(config.tokenAddress),
      nextOmenMarket: Boolean(config.marketAddress),
      battleCoordinator: Boolean(config.battleAddress),
    },
    integrations: {
      envio: Boolean(process.env.ENVIO_GRAPHQL_URL),
      privy: Boolean(config.privyAppId),
      chainlinkCre: Boolean(process.env.CHAINLINK_CRE_WORKFLOW_ID),
    },
    latestSequences: Object.fromEntries(
      store.listChambers().map((chamber) => [chamber.id, chamber.latestOmen.sequence]),
    ),
    dataSourceMode: process.env.ENVIO_GRAPHQL_URL ? "ENVIO" : "LOCAL",
    sourceModes: Object.fromEntries(
      store.listChambers().map((chamber) => [chamber.id, chamber.sourceMode]),
    ),
  });
}
