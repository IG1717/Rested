import { ImageResponse } from "next/og";
import { getInviter } from "@/lib/friends";
import { MARK_DATA_URI } from "@/lib/brand";

// Link preview for friend links (iMessage, WhatsApp, Slack): the inviter's photo and name.
export const alt = "Compete with me on Rested";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const inviter = await getInviter(code);
  const first = inviter?.name.split(" ")[0] ?? "a friend";
  const initials = (inviter?.name ?? "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "linear-gradient(135deg, #7472F5 0%, #3A2EA6 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {inviter?.avatarUrl ? (
            <img src={inviter.avatarUrl.replace(/=s\d+-c$/, "=s400-c")} width={180} height={180} style={{ borderRadius: 90, border: "6px solid rgba(255,255,255,.9)" }} alt="" />
          ) : (
            <div style={{ width: 180, height: 180, borderRadius: 90, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, fontWeight: 700 }}>
              {initials}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>{`Compete with ${first}`}</div>
            <div style={{ fontSize: 38, opacity: 0.85, marginTop: 14 }}>Sleep and activity leaderboards on Rested</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, position: "absolute", bottom: 56, left: 90 }}>
          <img src={MARK_DATA_URI} width={64} height={64} style={{ borderRadius: 14 }} alt="" />
          <div style={{ fontSize: 34, fontWeight: 700 }}>Rested</div>
        </div>
      </div>
    ),
    size,
  );
}
