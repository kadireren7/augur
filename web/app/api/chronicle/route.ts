import { NextResponse } from "next/server";

import { getDataSource } from "@/lib/data-source";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const source = getDataSource();
    return NextResponse.json({ mode: source.mode, chronicle: await source.getChronicle() });
  } catch (error) {
    return apiError(error);
  }
}
