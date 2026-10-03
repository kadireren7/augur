import { NextResponse } from "next/server";

import { prepareChamber } from "@/lib/chamber-creation";
import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";
import { getProductRepository } from "@/lib/product-repository";
import { creatureMedia } from "@/lib/media";

export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "prepare-chamber");
    const prepared = prepareChamber(await request.json());
    const viewing = prepared.value.viewingSource;
    await getProductRepository().savePrepared({id: prepared.contractChamberId, creatureId: prepared.contractCreatureId, name: prepared.value.name, slug: prepared.slug, species: prepared.value.species, description: prepared.value.description, registrationStatus: "pending_operator"}, {
      id: `source-${prepared.configHash}`, chamberId: prepared.contractChamberId, creatureId: prepared.contractCreatureId,
      sourceType: viewing?.sourceType ?? "fixture", sourceUrl: viewing?.sourceUrl ?? null,
      poster: creatureMedia[prepared.value.species].media.poster, status: "pending", evidence: "illustrative", attribution: "Operator-provided viewing source · pending review",
    });
    return NextResponse.json({
      registration: {
        creatureId: prepared.contractCreatureId,
        chamberId: prepared.contractChamberId,
        metadataHash: prepared.contractMetadataHash,
        configHash: prepared.contractConfigHash,
        rulesetHash: prepared.contractRulesetHash,
      },
      rules: prepared.rules,
      metadata: prepared.metadata,
      status: "PENDING_OPERATOR_REGISTRATION",
      message: "Configuration saved offchain. No contract was registered, no stream was attested, and no transaction was sent. An authorized operator must review and register this Chamber.",
    });
  } catch (error) {
    return apiError(error);
  }
}
