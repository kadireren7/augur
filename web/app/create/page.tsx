import { CreateChamberForm } from "@/components/create-chamber-form";
import { readRegistrationPolicy } from "@/lib/registration-policy";

export const dynamic = "force-dynamic";
export default async function CreatePage() {
  const policy = await readRegistrationPolicy();
  return (
    <div className="page-shell narrow">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Chamber configuration</p>
          <h1>Give instinct a Chamber.</h1>
          <p>
            Choose a creature, viewing source, and deterministic rules. Sources
            are not fetched by the server. Operator review does not attest
            source honesty.
          </p>
        </div>
      </section>
      {policy.status !== "VERIFIED" && (
        <p className="notice">
          Registration policy {policy.status.toLowerCase().replaceAll("_", " ")}
          . Only offchain preparation is available; contract registration is not
          offered.
        </p>
      )}
      <CreateChamberForm
        indexedMode={Boolean(process.env.ENVIO_GRAPHQL_URL)}
        permissionlessEnabled={policy.enabled}
      />
    </div>
  );
}
