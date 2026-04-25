import { NextResponse } from "next/server";
import { INTERNAL_AUTH_URL } from "../../../../lib/server-auth";

export async function POST(req: Request) {
  let payload: { username?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const res = await fetch(`${INTERNAL_AUTH_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { detail: safeDetail(text) || "Registration failed" },
      { status: res.status },
    );
  }
  try {
    return NextResponse.json(JSON.parse(text), { status: 201 });
  } catch {
    return NextResponse.json({ ok: true }, { status: 201 });
  }
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
