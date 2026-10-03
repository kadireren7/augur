import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/data-source";
import { getProductRepository } from "@/lib/product-repository";
import { apiError } from "@/lib/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const chamber = await getDataSource().getChamber(slug);
    if (!chamber)
      return NextResponse.json(
        { message: "Chamber unavailable" },
        { status: 404 },
      );
    const repository = getProductRepository();
    const [media, metadata] = await Promise.all([
      repository.getMedia(chamber.id),
      repository.getMetadata(chamber.id),
    ]);
    return NextResponse.json({
      media,
      metadata:
        metadata?.registrationStatus !== "pending_operator" ? metadata : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
