import { NextResponse } from "next/server";
import {
  INTERNAL_TASKS_URL,
  getAccessTokenCookie,
  tryRefreshAccess,
} from "../../../../lib/server-auth";

type Ctx = { params: Promise<{ path?: string[] }> };

async function forward(req: Request, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  const upstreamPath = path.length ? `/${path.join("/")}` : "";
  const url = new URL(req.url);
  const target = `${INTERNAL_TASKS_URL}/tasks${upstreamPath}${url.search}`;

  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  let bodyText: string | undefined;
  if (req.method !== "GET" && req.method !== "DELETE") {
    bodyText = await req.text();
  }

  const send = async (token: string) => {
    headers.set("authorization", `Bearer ${token}`);
    return fetch(target, {
      method: req.method,
      headers,
      body: bodyText,
      cache: "no-store",
    });
  };

  let token = await getAccessTokenCookie();
  if (!token) {
    token = await tryRefreshAccess();
    if (!token) return unauthorized();
  }

  let res = await send(token);
  if (res.status === 401) {
    const newToken = await tryRefreshAccess();
    if (!newToken) return unauthorized();
    res = await send(newToken);
  }

  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const text = await res.text();
  const respHeaders = new Headers();
  const respCt = res.headers.get("content-type");
  if (respCt) respHeaders.set("content-type", respCt);
  return new NextResponse(text, { status: res.status, headers: respHeaders });
}

function unauthorized() {
  return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
