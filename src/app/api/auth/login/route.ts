import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl } from "@/lib/google";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const state = randomBytes(16).toString("hex");
  (await cookies()).set(
    "rested_oauth",
    JSON.stringify({ state, next: next?.startsWith("/") ? next : "/" }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    },
  );
  return NextResponse.redirect(authorizeUrl(state));
}
