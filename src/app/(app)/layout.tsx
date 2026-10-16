import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SyncProvider } from "@/components/sync-provider";
import { TabBar } from "@/components/tab-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Signed-out visitors only ever reach "/" here, which renders the welcome screen.
  if (!user) return <>{children}</>;
  if (!user.connected) redirect("/connect");
  return (
    <SyncProvider>
      <div className="app">{children}</div>
      <TabBar />
    </SyncProvider>
  );
}
