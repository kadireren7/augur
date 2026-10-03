import { NextRequest, NextResponse } from "next/server";

import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";
import { getStore } from "@/lib/store";
import { getProductRepository, SupabaseProductRepository } from "@/lib/product-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chamberId = request.nextUrl.searchParams.get("chamberId");
  if (!chamberId) return NextResponse.json({ error: "chamberId is required" }, { status: 400 });
  try {const repository = getProductRepository(); return NextResponse.json({pulse: repository instanceof SupabaseProductRepository ? await repository.getPulse(chamberId) : getStore().social.getPulse(chamberId)});} catch (error) {return apiError(error);}
}

export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "reaction");
    const input = await request.json();
    const repository = getProductRepository();
    return NextResponse.json({ pulse: repository instanceof SupabaseProductRepository ? await repository.addReaction(input) : getStore().social.addReaction(input) });
  } catch (error) {
    return apiError(error);
  }
}
