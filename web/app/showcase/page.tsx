import { ShowcaseClient } from "@/components/showcase-client";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function ShowcasePage() {
  return <ShowcaseClient initial={getStore().showcaseState()} />;
}
