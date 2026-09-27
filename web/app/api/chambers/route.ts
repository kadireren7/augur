import { NextResponse } from "next/server";

import { chamberCreationSchema } from "@/lib/chamber-creation";
import { getDataSource } from "@/lib/data-source";
import { apiError } from "@/lib/http";
import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const source = getDataSource();
    return NextResponse.json({ mode: source.mode, chambers: await source.listChambers() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "create-chamber");
    if (process.env.ENVIO_GRAPHQL_URL) {
      return NextResponse.json(
        { error: "LIVE_MODE", message: "Use the configured wallet registration path in indexed mode" },
        { status: 409 },
      );
    }
    const input = chamberCreationSchema.parse(await request.json());
    const chamber = getStore().createChamber(input);
    return NextResponse.json(
      {
        mode: "LOCAL_DEMO",
        chamber,
        message: "Chamber stored locally in DRAFT state. No blockchain transaction was sent.",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
