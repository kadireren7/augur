import { NextResponse } from "next/server";

import { prepareChamber } from "@/lib/chamber-creation";
import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "prepare-chamber");
    const prepared = prepareChamber(await request.json());
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
    });
  } catch (error) {
    return apiError(error);
  }
}
