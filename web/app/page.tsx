import { Discovery } from "@/components/discovery";
import { getDataSource } from "@/lib/data-source";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const source = getDataSource();
  return <Discovery chambers={await source.listChambers()} dataMode={source.mode} />;
}
