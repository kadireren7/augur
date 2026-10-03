import {NextResponse} from "next/server";
import {z} from "zod";
import {getStore} from "@/lib/store";
import {requireMutationCapacity} from "@/lib/api-rate-limit";
import {apiError} from "@/lib/http";

// Explicit demo boundary. Does not touch Envio, the oracle publisher, or contract writes.
export async function POST(request: Request) {
  try {
    requireMutationCapacity(request,"replay-showcase");
    const input = z.object({durationMs:z.number().int().min(5000).max(15000),predictionsPerChamber:z.number().int().min(1).max(1000)}).parse(await request.json());
    return NextResponse.json({mode:"LOCAL_DEMO",showcase:getStore().runShowcaseCycle(["pablo","bubbles","turbo"],input.durationMs,input.predictionsPerChamber)});
  } catch(error) {return apiError(error);}
}
