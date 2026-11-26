import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { unseenReactionCount } from "@/lib/friends";
import { SyncProvider } from "@/components/sync-provider";
import { TabBar } from "@/components/tab-bar";
import { OfflineBanner, PwaProvider } from "@/components/pwa";
import { ToastProvider } from "@/components/toast";
import { PullToRefresh } from "@/components/pull-to-refresh";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Signed-out visitors only ever reach "/" here, which renders the welcome screen.
  if (!user) return <>{children}</>;
  if (!user.connected) redirect("/connect");
  const unseen = await unseenReactionCount(user.id);
  return (
    <PwaProvider badge={unseen}>
      <SyncProvider>
        <ToastProvider>
          <OfflineBanner lastSyncedAt={user.lastSyncedAt} />
          <PullToRefresh />
          <div className="app">{children}</div>
          <TabBar unseen={unseen} />
        </ToastProvider>
      </SyncProvider>
    </PwaProvider>
  );
}
