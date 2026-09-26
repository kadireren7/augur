import { NextResponse } from "next/server";

import { requireMutationCapacity } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    requireMutationCapacity(request, "fixture");
    if (process.env.ENVIO_GRAPHQL_URL) {
      return NextResponse.json(
        { error: "DISABLED", message: "Fixture control is disabled in Envio mode" },
        { status: 409 },
      );
    }
    const { slug } = await context.params;
    return NextResponse.json({ chamber: getStore().advanceFixture(slug) });
  } catch (error) {
    return apiError(error);
  }
}
