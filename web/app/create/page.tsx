import { CreateChamberForm } from "@/components/create-chamber-form";

export default function CreatePage() {
  return <div className="page-shell narrow"><section className="page-heading"><div><p className="eyebrow">M7 · Permissionless Chambers</p><h1>Create a guarded Chamber</h1><p>Choose only supported species, sources, and deterministic rules. Arbitrary code and server-side URL fetching are not accepted.</p></div></section><CreateChamberForm /></div>;
}
