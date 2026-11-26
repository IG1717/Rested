/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { MARK_DATA_URI } from "@/lib/brand";
import { SPLASH_SIZES } from "@/lib/splash";

// iOS launch screens for the home-screen app, so it opens to the app's background and mark
// instead of a white flash. Spec: "<width>x<height>-<light|dark>" in device pixels.
export async function GET(_req: Request, ctx: RouteContext<"/pwa-splash/[spec]">) {
  const m = /^(\d+)x(\d+)-(light|dark)$/.exec((await ctx.params).spec);
  if (!m || !SPLASH_SIZES.some((s) => s.w === Number(m[1]) && s.h === Number(m[2]))) {
    return new Response(null, { status: 404 });
  }
  const [w, h] = [Number(m[1]), Number(m[2])];
  const mark = Math.round(w * 0.26);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: m[3] === "dark" ? "#000000" : "#f2f2f7",
        }}
      >
        <img src={MARK_DATA_URI} width={mark} height={mark} style={{ borderRadius: mark * 0.225 }} alt="" />
      </div>
    ),
    { width: w, height: h, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
