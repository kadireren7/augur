import { NextResponse } from "next/server";

import { checkProductHealth } from "@/lib/product-repository";
import { checkEnvioHealth } from "@/lib/envio-health";
import { checkRpcHealth } from "@/lib/rpc";
import { getServerConfig } from "@/lib/server-config";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getServerConfig();
  const store = getStore();
  const [rpc, envio] = await Promise.all([checkRpcHealth(), checkEnvioHealth()]);
  return NextResponse.json({
    web: "HEALTHY",
    buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION || "development",
    chainMode: config.rpcUrl ? "CONFIGURED" : "LOCAL",
    rpc,
    contracts: {
      creatureRegistry: Boolean(config.creatureRegistryAddress),
      roomRegistry: Boolean(config.roomRegistryAddress),
      omenPublisher: Boolean(config.omenPublisherAddress),
      token: Boolean(config.tokenAddress),
      nextOmenMarket: Boolean(config.marketAddress),
      battleCoordinator: Boolean(config.battleAddress),
    },
    integrations: {
      envio,
      privy: Boolean(config.privyAppId),
      alchemy: Boolean(process.env.ALCHEMY_MONAD_RPC_URL),
      chainlinkCre: Boolean(process.env.CHAINLINK_CRE_WORKFLOW_ID),
    },
    database: await checkProductHealth(),
    lastOracleAttempt: process.env.AUGUR_ORACLE_DB_PATH ? "configured journal; inspect through oracle service" : null,
    latestSequences: Object.fromEntries(
      store.listChambers().map((chamber) => [chamber.id, chamber.latestOmen?.sequence ?? null]),
    ),
    dataSourceMode: process.env.ENVIO_GRAPHQL_URL ? "ENVIO" : "LOCAL",
    sourceModes: Object.fromEntries(
      store.listChambers().map((chamber) => [chamber.id, chamber.sourceMode]),
    ),
  });
}
