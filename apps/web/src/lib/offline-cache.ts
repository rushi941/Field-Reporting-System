const CACHE_PREFIX = "frs_cache_v1_";

type CacheEnvelope<T> = {
  data: T;
  savedAt: number;
};

export const OFFLINE_CACHE_KEYS = {
  fieldProjects: "field_projects",
  fieldReports: "field_reports",
  approvalsPending: "approvals_pending",
  fieldProjectDetail: (projectId: string) => `field_project_${projectId}`,
} as const;

function storageKey(key: string) {
  return `${CACHE_PREFIX}${key}`;
}

export function cacheGet<T>(key: string): CacheEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T) {
  try {
    const envelope: CacheEnvelope<T> = { data, savedAt: Date.now() };
    localStorage.setItem(storageKey(key), JSON.stringify(envelope));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function cacheRemove(key: string) {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    /* ignore */
  }
}

export function formatCacheAge(savedAt: number) {
  const mins = Math.round((Date.now() - savedAt) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}
