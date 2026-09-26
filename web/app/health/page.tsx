import { getPublicConfig } from "@/lib/config";
import { checkRpcHealth } from "@/lib/rpc";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const rpc = await checkRpcHealth();
  const config = getPublicConfig();
  const rows = [
    ["Web", "HEALTHY"],
    ["Data source", process.env.ENVIO_GRAPHQL_URL ? "ENVIO" : "LOCAL"],
    ["RPC", rpc.status],
    ["Chain ID", rpc.chainId?.toString() ?? "Not available"],
    ["Token contract", config.tokenAddress ? "Configured" : "Not configured"],
    ["Market contract", config.marketAddress ? "Configured" : "Not configured"],
    ["Battle contract", config.battleAddress ? "Configured" : "Not configured"],
    ["Envio", process.env.ENVIO_GRAPHQL_URL ? "Configured" : "Not configured"],
    ["Privy", config.privyAppId ? "SDK configured" : "Local dev session"],
    ["Chainlink CRE", process.env.CHAINLINK_CRE_WORKFLOW_ID ? "Workflow ID configured; execution unverified" : "Not configured"],
  ];
  return <div className="page-shell narrow"><section className="page-heading"><div><p className="eyebrow">Developer health</p><h1>Runtime boundaries</h1><p>No endpoint value, key, token, or secret is exposed here.</p></div></section><section className="panel"><dl className="health-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{rpc.error && <p className="error">{rpc.error}</p>}</section><section className="panel"><h2>Latest local oracle sequence</h2>{getStore().listChambers().map((chamber) => <p className="history-row" key={chamber.id}><strong>{chamber.id}</strong><span>#{chamber.latestOmen.sequence} · {chamber.sourceMode}</span></p>)}</section></div>;
}
