import { NextResponse } from "next/server";

import { getDataSource } from "@/lib/data-source";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const source = getDataSource();
    const chamber = await source.getChamber(slug);
    if (!chamber) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ mode: source.mode, chamber });
  } catch (error) {
    return apiError(error);
  }
}
