import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProductIdentity } from "@/lib/product-auth";
import { productRequest } from "@/lib/product-actions";
import { apiError } from "@/lib/http";
import { requireMutationCapacity } from "@/lib/api-rate-limit";
export async function GET(request: Request) {
  try {
    const identity = await requireProductIdentity(request);
    return NextResponse.json({
      favorites: await productRequest("favorites?select=chamber_id", identity),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "favorite");
    const identity = await requireProductIdentity(request);
    const input = z
      .object({ chamberId: z.string().min(1).max(100), favorite: z.boolean() })
      .strict()
      .parse(await request.json());
    if (input.favorite)
      await productRequest("favorites", identity, {
        user_id: identity.userId,
        chamber_id: input.chamberId,
      });
    else
      await productRequest(
        `favorites?user_id=eq.${identity.userId}&chamber_id=eq.${encodeURIComponent(input.chamberId)}`,
        identity,
        undefined,
        "DELETE",
      );
    return NextResponse.json({ favorite: input.favorite });
  } catch (error) {
    return apiError(error);
  }
}
