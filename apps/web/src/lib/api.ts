import { attachmentUploadMeta } from "@frs/shared";

const TOKEN_KEY = "frs_auth_token";

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions?: Record<string, string>;
};

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const FILE_TOO_LARGE_MESSAGE = `File must be ${attachmentUploadMeta.maxLabel} or smaller`;

function isAbortError(err: unknown, signal?: AbortSignal | null) {
  return (
    signal?.aborted ||
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

async function parseError(res: Response) {
  if (res.status === 413) return FILE_TOO_LARGE_MESSAGE;
  try {
    const body = (await res.json()) as ApiErrorBody;
    return body.error?.message ?? res.statusText;
  } catch {
    if (/too large|entity too large|payload/i.test(res.statusText)) {
      return FILE_TOO_LARGE_MESSAGE;
    }
    return res.statusText || "Request failed";
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!headers.has("Content-Type") && init.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (err) {
    if (isAbortError(err, init.signal)) throw err;
    if (isFormData) {
      throw new Error(
        "Upload failed. Use a photo or PDF up to 5 MB and try again.",
      );
    }
    throw new Error(
      err instanceof Error && err.message ? err.message : "Network error",
    );
  }
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Multipart upload helper (does not force JSON Content-Type) */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  init: RequestInit = {},
): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: formData, ...init });
}

/** Download file (CSV export, etc.) with auth header */
export async function apiDownload(path: string, filename: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { headers });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function loginRequest(email: string, password: string) {
  return apiFetch<{ token: string; user: AuthUser }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function meRequest() {
  return apiFetch<{ user: AuthUser }>("/api/v1/auth/me");
}

export async function logoutRequest() {
  return apiFetch<{ ok: boolean }>("/api/v1/auth/logout", { method: "POST" });
}

export type ManagedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  division: string | null;
  managerId: string | null;
  crewId: string | null;
  roles: string[];
  manager: { id: string; name: string; email: string } | null;
  crew: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type PermissionMatrixRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  sortOrder: number;
  accessByRole: Record<string, string>;
};
