import { NextResponse } from "next/server";
import {
  INTERNAL_AUTH_URL,
  clearAuthCookies,
  getRefreshTokenCookie,
} from "../../../../lib/server-auth";

export async function POST() {
  const refresh = await getRefreshTokenCookie();
  if (refresh) {
    try {
      await fetch(`${INTERNAL_AUTH_URL}/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
        cache: "no-store",
      });
    } catch {
      /* ignore */
    }
  }
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
