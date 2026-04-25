"use client";

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  deadline?: string | null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((d: { msg?: string }) => d?.msg ?? JSON.stringify(d))
        .join("; ");
    }
    return JSON.stringify(data);
  } catch {
    return res.statusText || "Request failed";
  }
}

async function jsonFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers, credentials: "same-origin" });
}

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tf-auth-changed"));
  }
}

// ---------- Auth ----------

export interface RegisterInput {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}

export async function register(input: RegisterInput) {
  const res = await jsonFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  notifyAuthChanged();
  return res.json();
}

export async function logout() {
  try {
    await jsonFetch("/api/auth/logout", { method: "POST" });
  } finally {
    notifyAuthChanged();
  }
}

export interface CurrentUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await jsonFetch("/api/auth/me");
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated: boolean;
      user?: CurrentUser;
    };
    return data.authenticated && data.user ? data.user : null;
  } catch {
    return null;
  }
}

export async function checkAuth(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

// ---------- Tasks ----------

export async function listTasks(status?: TaskStatus): Promise<Task[]> {
  const url = new URL("/api/tasks", window.location.origin);
  if (status) url.searchParams.set("status", status);
  const res = await jsonFetch(url.toString());
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.json();
}

export async function getTask(id: string): Promise<Task> {
  const res = await jsonFetch(`/api/tasks/${id}`);
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.json();
}

export async function createTask(input: TaskInput): Promise<Task> {
  const res = await jsonFetch("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.json();
}

export async function updateTask(
  id: string,
  input: Partial<TaskInput>,
): Promise<Task> {
  const res = await jsonFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res.json();
}

export async function deleteTask(id: string): Promise<void> {
  const res = await jsonFetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204)
    throw new ApiError(res.status, await parseError(res));
}
