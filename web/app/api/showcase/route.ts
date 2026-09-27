import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const cycleSchema = z.object({
  durationMs: z.number().int().min(5_000).max(15_000).default(5_000),
  predictionsPerChamber: z.number().int().min(1).max(1_000).default(9),
});

export function GET() {
  return NextResponse.json({ showcase: getStore().showcaseState() });
}

export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "showcase");
    if (process.env.ENVIO_GRAPHQL_URL) {
      return NextResponse.json(
        { error: "LIVE_MODE", message: "Local speed cycles are disabled in indexed mode" },
        { status: 409 },
      );
    }
    const input = cycleSchema.parse(await request.json());
    return NextResponse.json({
      showcase: getStore().runShowcaseCycle(
        ["pablo", "bubbles"],
        input.durationMs,
        input.predictionsPerChamber,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
