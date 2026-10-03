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
      profile: await productRequest(
        `profiles?id=eq.${identity.userId}&select=id,display_name,avatar_url,wallet_address`,
        identity,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    requireMutationCapacity(request, "profile");
    const identity = await requireProductIdentity(request);
    const input = z
      .object({
        display_name: z.string().trim().min(1).max(32),
        avatar_url: z.string().url().startsWith("https://").nullable(),
      })
      .strict()
      .parse(await request.json());
    return NextResponse.json({
      profile: await productRequest(
        `profiles?id=eq.${identity.userId}`,
        identity,
        input,
        "PATCH",
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
