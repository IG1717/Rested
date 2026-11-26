import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getInviteCode } from "@/lib/friends";
import { finishOnboarding } from "@/app/actions";
import { PwaProvider } from "@/components/pwa";
import { ToastProvider } from "@/components/toast";
import { SetupFlow } from "@/components/setup-flow";

// First run, after Google sign-in: import status, invite friends, then install + notifications.
export default async function SetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?next=/setup");
  if (!user.connected) redirect("/connect?next=/setup");
  const code = await getInviteCode(user.id);
  const inviteUrl = `${process.env.APP_URL}/add/${code}`;
  const qr = await QRCode.toString(inviteUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <PwaProvider badge={0}>
      <ToastProvider>
        <SetupFlow
          firstName={user.nickname || user.name.split(" ")[0]}
          imported={!!user.lastSyncedAt}
          inviteUrl={inviteUrl}
          qr={qr}
          vapidKey={process.env.VAPID_PUBLIC_KEY ?? null}
          finish={finishOnboarding}
        />
      </ToastProvider>
    </PwaProvider>
  );
}
