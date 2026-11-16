const DEFAULT_HTTP = "http://127.0.0.1:8080";

export const BACKEND_HTTP_URL = (
  process.env.NEXT_PUBLIC_RUST_URL ?? DEFAULT_HTTP
).replace(/\/$/, "");

export interface Health {
  status: string;
  service: string;
  version: string;
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BACKEND_HTTP_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || `Server returned ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHealth(): Promise<Health> {
  return request<Health>("/api/health", { method: "GET" }, 3000);
}

export function slugifyWorkspace(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "workspace";
}

export interface PushFile {
  path: string;
  content: string;
}

export interface PushResult {
  workspace: string;
  written: number;
}

export async function pushWorkspace(name: string, files: PushFile[]): Promise<PushResult> {
  return request<PushResult>("/api/v1/workspaces/sync", {
    method: "POST",
    body: JSON.stringify({ name, files }),
  }, 15000);
}

export function describeBackendError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The Rust server did not answer in time.";
  }
  if (error instanceof TypeError) {
    return "Can't reach the Rust server. Start it with npm run server.";
  }
  return error instanceof Error ? error.message : "Unknown server error.";
}
