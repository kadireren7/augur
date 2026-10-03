import { NextResponse } from "next/server";

import { checkProductHealth } from "@/lib/product-repository";
import { checkEnvioHealth } from "@/lib/envio-health";
import { checkRpcHealth } from "@/lib/rpc";
import { getServerConfig } from "@/lib/server-config";
import { getDataSource } from "@/lib/data-source";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getServerConfig();
  const source = getDataSource();
  const [rpc, envio, database, chambers] = await Promise.all([
    checkRpcHealth(),
    checkEnvioHealth(),
    checkProductHealth(),
    source.listChambers().catch(() => null),
  ]);
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
    database,
    lastOracleAttempt: process.env.AUGUR_ORACLE_DB_PATH
      ? "configured journal; inspect through oracle service"
      : null,
    latestSequences: chambers
      ? Object.fromEntries(
          chambers.map((chamber) => [
            chamber.id,
            chamber.latestOmen?.sequence ?? null,
          ]),
        )
      : null,
    dataSourceMode: process.env.ENVIO_GRAPHQL_URL ? "ENVIO" : "LOCAL",
    sourceModes: chambers
      ? Object.fromEntries(
          chambers.map((chamber) => [chamber.id, chamber.sourceMode]),
        )
      : null,
    dataStatus: chambers ? "AVAILABLE" : "UNAVAILABLE",
  });
}
