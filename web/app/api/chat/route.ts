import { NextRequest, NextResponse } from "next/server";

import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";
import { requireProductIdentity } from "@/lib/product-auth";
import {
  postAuthenticatedMessage,
  publicMessages,
} from "@/lib/product-actions";
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
    return NextResponse.json({ messages: await publicMessages(chamberId) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireMutationCapacity(request, "chat");
    const identity = await requireProductIdentity(request);
    const input = z
      .object({
        chamberId: z.string().min(1).max(100),
        displayName: z.string().min(1).max(32),
        text: z.string().min(1).max(280),
      })
      .parse(await request.json());
    return NextResponse.json(
      { message: await postAuthenticatedMessage(identity, input) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
