const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const API_BASE = RAW_API_BASE.endsWith("/") ? RAW_API_BASE.slice(0, -1) : RAW_API_BASE;
const TOKEN_KEY = "stackzyro.token";

export type Query = Record<string, string | number | boolean | null | undefined>;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string, remember: boolean): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    const detail = payload?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item: { msg?: string; loc?: string[] }) => {
          const field = item.loc?.filter((part) => part !== "body").join(".");
          return field ? `${field}: ${item.msg}` : item.msg;
        })
        .filter(Boolean)
        .join(" · ");
    }
    return "Something went wrong. Please try again.";
  } catch {
    if (response.status === 0) return "Cannot reach the CRM API. Is the backend running?";
    return `Request failed (${response.status}). Please try again.`;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Cannot reach the CRM API. Make sure the backend server is running.",
      0
    );
  }

  if (response.status === 401 && auth) {
    clearStoredToken();
    window.dispatchEvent(new Event("stackzyro:unauthorized"));
  }

  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => apiFetch<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = getStoredToken();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(buildUrl(path), {
      method: "POST",
      headers,
      body: formData,
    });
    if (response.status === 401) {
      clearStoredToken();
      window.dispatchEvent(new Event("stackzyro:unauthorized"));
    }
    if (!response.ok) {
      throw new ApiError(await errorMessage(response), response.status);
    }
    return (await response.json()) as T;
  },
};

export async function downloadFile(
  path: string,
  query: Query | undefined,
  fallbackName: string
): Promise<void> {
  const token = getStoredToken();
  const response = await fetch(buildUrl(path, query), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new Event("stackzyro:unauthorized"));
  }
  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
