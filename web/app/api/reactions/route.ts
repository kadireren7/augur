import { NextRequest, NextResponse } from "next/server";

import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";
import { getStore } from "@/lib/store";
import {
  getProductRepository,
  SupabaseProductRepository,
} from "@/lib/product-repository";
import { requireProductIdentity } from "@/lib/product-auth";
import { productRequest } from "@/lib/product-actions";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chamberId = request.nextUrl.searchParams.get("chamberId");
  if (!chamberId)
    return NextResponse.json(
      { error: "chamberId is required" },
      { status: 400 },
    );
  try {
    const repository = getProductRepository();
    return NextResponse.json({
      pulse:
        repository instanceof SupabaseProductRepository
          ? await repository.getPulse(chamberId)
          : getStore().social.getPulse(chamberId),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "reaction");
    const identity = await requireProductIdentity(request);
    const input = z
      .object({
        chamberId: z.string().min(1).max(100),
        reaction: z.enum(["BUY", "HOLD", "SELL", "HYPE", "RIP"]),
      })
      .parse(await request.json());
    return NextResponse.json({
      pulse: await productRequest("rpc/react_product", identity, {
        room: input.chamberId,
        value: input.reaction,
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
