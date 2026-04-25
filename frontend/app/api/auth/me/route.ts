import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/server-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ authenticated: false }, { status: 200 });
  return NextResponse.json({ authenticated: true, user });
}
