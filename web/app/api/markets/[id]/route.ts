import { NextResponse } from "next/server";
import { z } from "zod";

import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";
import { getStore } from "@/lib/store";
import { requirePrivyIdentity } from "@/lib/product-auth";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    sessionId: z.string().min(8).max(100),
    amount: z.number().int().positive().max(1_000_000),
  }),
  z.object({
    action: z.literal("predict"),
    sessionId: z.string().min(8).max(100),
    outcome: z.enum(["BUY", "HOLD", "SELL"]),
    amount: z.number().int().positive().max(1_000_000),
  }),
  z.object({ action: z.literal("claim"), sessionId: z.string().min(8).max(100) }),
  z.object({ action: z.literal("refund"), sessionId: z.string().min(8).max(100) }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireMutationCapacity(request, "market");
    if (process.env.ENVIO_GRAPHQL_URL) {
      return NextResponse.json(
        { error: "READ_ONLY", message: "Local writes are disabled in Envio mode" },
        { status: 409 },
      );
    }
    const { id } = await context.params;
    const subject = await requirePrivyIdentity(request);
    const marketId = z.coerce.number().int().positive().parse(id);
    const input = actionSchema.parse({...await request.json(),sessionId:subject});
    const store = getStore();
    const feedback =
      input.action === "approve"
        ? store.approve(marketId, input.sessionId, input.amount)
        : input.action === "predict"
          ? store.predict(marketId, input.sessionId, input.outcome, input.amount)
          : input.action === "claim"
            ? store.claim(marketId, input.sessionId)
            : store.refund(marketId, input.sessionId);
    return NextResponse.json({ feedback, market: store.getMarket(marketId) });
  } catch (error) {
    return apiError(error);
  }
}
