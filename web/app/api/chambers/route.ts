import { NextResponse } from "next/server";

import { chamberCreationSchema } from "@/lib/chamber-creation";
import { getDataSource } from "@/lib/data-source";
import { apiError } from "@/lib/http";
import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { getStore } from "@/lib/store";
import { getProductRepository } from "@/lib/product-repository";
import { creatureMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const source = getDataSource();
    return NextResponse.json({
      mode: source.mode,
      chambers: await source.listChambers(),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "create-chamber");
    if (process.env.ENVIO_GRAPHQL_URL) {
      return NextResponse.json(
        {
          error: "LIVE_MODE",
          message:
            "Use the configured wallet registration path in indexed mode",
        },
        { status: 409 },
      );
    }
    const input = chamberCreationSchema.parse(await request.json());
    const chamber = getStore().createChamber(input);
    if (input.viewingSource)
      await getProductRepository().savePrepared(
        {
          id: chamber.id,
          creatureId: chamber.creature.id,
          slug: chamber.slug,
          name: chamber.creature.name,
          species: chamber.creature.species,
          description: chamber.creature.description,
          registrationStatus: "local_demo",
        },
        {
          id: `source-${chamber.id}`,
          chamberId: chamber.id,
          creatureId: chamber.creature.id,
          sourceType: input.viewingSource.sourceType,
          sourceUrl: input.viewingSource.sourceUrl,
          poster: creatureMedia[chamber.creature.species].media.poster,
          status: "available",
          evidence: "illustrative",
          attribution: "User-configured local viewing source · not attested",
        },
      );
    return NextResponse.json(
      {
        mode: "LOCAL_DEMO",
        chamber,
        message:
          "Chamber stored locally in DRAFT state. No blockchain transaction was sent.",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
