import { NextResponse } from "next/server";
import { INTERNAL_AUTH_URL, setAuthCookies } from "../../../../lib/server-auth";

export async function POST(req: Request) {
  let payload: { email?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const { email, password } = payload;
  if (!email || !password) {
    return NextResponse.json(
      { detail: "Email and password required" },
      { status: 400 },
    );
  }

  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const res = await fetch(`${INTERNAL_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { detail: safeDetail(detail) || "Invalid credentials" },
      { status: res.status },
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };
  await setAuthCookies(data.access_token, data.refresh_token);
  return NextResponse.json({ ok: true });
}

function safeDetail(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === "string") return parsed.detail;
  } catch {
    /* ignore */
  }
  return null;
}
