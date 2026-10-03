import { checkProductHealth } from "@/lib/product-repository";
import { checkEnvioHealth } from "@/lib/envio-health";
import { checkRpcHealth } from "@/lib/rpc";
import { getServerConfig } from "@/lib/server-config";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const [rpc,envio,database] = await Promise.all([checkRpcHealth(),checkEnvioHealth(),checkProductHealth()]);
  const config = getServerConfig();
  const rows = [
    ["Web", "HEALTHY"],
    ["Data source", process.env.ENVIO_GRAPHQL_URL ? "ENVIO" : "LOCAL"],
    ["RPC", `${rpc.status} · ${rpc.provider}`],
    ["Chain ID", rpc.chainId?.toString() ?? "Not available"],
    ["Creature Registry", config.creatureRegistryAddress ? `Configured · code ${rpc.contractCode.creatureRegistry ? "present" : "not detected"}` : "Not configured"],
    ["Room Registry", config.roomRegistryAddress ? `Configured · code ${rpc.contractCode.roomRegistry ? "present" : "not detected"}` : "Not configured"],
    ["Omen Publisher", config.omenPublisherAddress ? `Configured · code ${rpc.contractCode.omenPublisher ? "present" : "not detected"}` : "Not configured"],
    ["Token contract", config.tokenAddress ? `Configured · code ${rpc.contractCode.token ? "present" : "not detected"}` : "Not configured"],
    ["Market contract", config.marketAddress ? "Configured" : "Not configured"],
    ["Battle contract", config.battleAddress ? "Configured" : "Not configured"],
    ["Envio", `${envio.status}${envio.lastIndexedBlock ? ` · block ${envio.lastIndexedBlock}` : ""}`],
    ["Privy", config.privyAppId ? "SDK configured" : "Local dev session"],
    ["Chainlink CRE", process.env.CHAINLINK_CRE_WORKFLOW_ID ? "Workflow ID configured; execution unverified" : "Not configured"],
    ["Database", `${database.mode} · ${database.status}`],
    ["Build", process.env.NEXT_PUBLIC_BUILD_VERSION || "development"],
  ];
  return <div className="page-shell narrow"><section className="page-heading"><div><p className="eyebrow">Developer health</p><h1>Runtime boundaries</h1><p>No endpoint value, key, token, or secret is exposed here.</p></div></section><section className="panel"><dl className="health-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{rpc.error && <p className="error">{rpc.error}</p>}</section><section className="panel"><h2>Latest local oracle sequence</h2>{getStore().listChambers().map((chamber) => <p className="history-row" key={chamber.id}><strong>{chamber.id}</strong><span>{chamber.latestOmen ? `#${chamber.latestOmen.sequence}` : "No Omen"} · {chamber.sourceMode}</span></p>)}</section></div>;
}
