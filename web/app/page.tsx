import { Discovery } from "@/components/discovery";
import { getDataSource } from "@/lib/data-source";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const source = getDataSource();
  // Viewing and practice do not wait on indexed market I/O. Discovery uses the
  // existing public chambers API and retains an explicit unavailable state.
  return <Discovery chambers={[]} dataMode={source.mode} initialLoading />;
}
