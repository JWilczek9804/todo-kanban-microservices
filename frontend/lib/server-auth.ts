import { cookies } from "next/headers";

export const ACCESS_COOKIE = "tf_access";
export const REFRESH_COOKIE = "tf_refresh";

export const ACCESS_TOKEN_MAX_AGE = 60 * 30; // 30 min
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const INTERNAL_AUTH_URL = "http://localhost:8001";

export const INTERNAL_TASKS_URL = "http://localhost:8000";

interface CookieOptions {
  name: string;
  value: string;
  maxAge: number;
}

function cookieDefaults() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function setAuthCookies(access: string, refresh?: string) {
  const jar = await cookies();
  const items: CookieOptions[] = [
    { name: ACCESS_COOKIE, value: access, maxAge: ACCESS_TOKEN_MAX_AGE },
  ];
  if (refresh) {
    items.push({
      name: REFRESH_COOKIE,
      value: refresh,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }
  for (const c of items) {
    jar.set({
      ...cookieDefaults(),
      name: c.name,
      value: c.value,
      maxAge: c.maxAge,
    });
  }
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getAccessTokenCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshTokenCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}

export async function tryRefreshAccess(): Promise<string | null> {
  const refresh = await getRefreshTokenCookie();
  if (!refresh) return null;
  const res = await fetch(`${INTERNAL_AUTH_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
    cache: "no-store",
  });
  if (!res.ok) {
    await clearAuthCookies();
    return null;
  }
  const data = (await res.json()) as { access_token: string };
  await setAuthCookies(data.access_token);
  return data.access_token;
}

export async function isLoggedInServer(): Promise<boolean> {
  return !!(await getCurrentUser());
}

export interface CurrentUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
}

async function verifyToken(token: string): Promise<CurrentUser | null> {
  try {
    const res = await fetch(`${INTERNAL_AUTH_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      valid: boolean;
      user_id?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    };
    if (!data.valid || !data.user_id) return null;
    return {
      user_id: data.user_id,
      email: data.email ?? "",
      first_name: data.first_name ?? "",
      last_name: data.last_name ?? "",
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  let access = await getAccessTokenCookie();
  if (!access) {
    access = await tryRefreshAccess();
    if (!access) return null;
  }
  let user = await verifyToken(access);
  if (user) return user;
  const refreshed = await tryRefreshAccess();
  if (!refreshed) return null;
  return verifyToken(refreshed);
}
