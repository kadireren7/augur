import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";
import { getStore } from "@/lib/store";

const schema = z.object({
  actor: z.string().min(8).max(100),
  status: z.enum(["ACTIVE", "PAUSED", "CLOSED"]),
});

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    requireMutationCapacity(request, "chamber-status");
    if (process.env.ENVIO_GRAPHQL_URL) {
      return NextResponse.json(
        { error: "LIVE_MODE", message: "Use the owner wallet transaction in indexed mode" },
        { status: 409 },
      );
    }
    const { slug } = await context.params;
    const input = schema.parse(await request.json());
    return NextResponse.json({ chamber: getStore().setChamberStatus(slug, input.actor, input.status) });
  } catch (error) {
    return apiError(error);
  }
}
