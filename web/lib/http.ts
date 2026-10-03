import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { PublicRateLimitError } from "@/lib/api-rate-limit";
import { SocialError } from "@/lib/social";
import { StoreError } from "@/lib/store";
import { ProductDatabaseError } from "@/lib/product-repository";

export function apiError(error: unknown): NextResponse {
  if (error instanceof ProductDatabaseError) return NextResponse.json({error: "DATABASE_UNAVAILABLE", message: error.message}, {status: 503});
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "INVALID_REQUEST", details: error.issues }, { status: 400 });
  }
  if (error instanceof PublicRateLimitError) {
    return NextResponse.json(
      { error: error.code, message: error.message, retryAfterMs: error.retryAfterMs },
      { status: 429 },
    );
  }
  if (error instanceof SocialError) {
    return NextResponse.json(
      { error: error.code, message: error.message, retryAfterMs: error.retryAfterMs },
      { status: error.code === "RATE_LIMITED" ? 429 : 400 },
    );
  }
  if (error instanceof StoreError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.code === "NOT_FOUND" ? 404 : 409 },
    );
  }
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "Request failed" }, { status: 500 });
}
