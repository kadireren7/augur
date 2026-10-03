import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {readMarketPosition} from "@/lib/market-position";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const wallet = z.string().regex(/^0x[0-9a-fA-F]{40}$/).safeParse(request.nextUrl.searchParams.get("wallet"));
  if(!wallet.success || !/^\d{1,20}$/.test(id) || BigInt(id)===0n) return NextResponse.json({message:"Invalid wallet or market"},{status:400});
  try {return NextResponse.json({position:await readMarketPosition(BigInt(id),wallet.data as `0x${string}`)});} catch {return NextResponse.json({message:"Position unavailable: check Monad RPC and chain 10143. No fixture position substituted."},{status:503});}
}
