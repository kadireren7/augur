import { NextRequest, NextResponse } from "next/server";

import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const chamberId = request.nextUrl.searchParams.get("chamberId");
  if (!chamberId) return NextResponse.json({ error: "chamberId is required" }, { status: 400 });
  return NextResponse.json({ pulse: getStore().social.getPulse(chamberId) });
}

export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "reaction");
    return NextResponse.json({ pulse: getStore().social.addReaction(await request.json()) });
  } catch (error) {
    return apiError(error);
  }
}
