import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cacheGet, cacheSet } from "@/lib/offline-cache";
import { useOnlineStatus } from "@/hooks/use-online-status";

type CachedApiState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  fromCache: boolean;
  cacheSavedAt: number | null;
  error: string | null;
  online: boolean;
  refresh: () => Promise<void>;
};

export function useCachedApi<T>(
  cacheKey: string,
  path: string,
): CachedApiState<T> {
  const online = useOnlineStatus();
  const [data, setData] = useState<T | null>(() => cacheGet<T>(cacheKey)?.data ?? null);
  const [loading, setLoading] = useState(() => cacheGet<T>(cacheKey) === null);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(() => cacheGet<T>(cacheKey) !== null);
  const [cacheSavedAt, setCacheSavedAt] = useState<number | null>(
    () => cacheGet<T>(cacheKey)?.savedAt ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const cached = cacheGet<T>(cacheKey);
    if (cached) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const fresh = await apiFetch<T>(path);
      setData(fresh);
      cacheSet(cacheKey, fresh);
      setFromCache(false);
      setCacheSavedAt(Date.now());
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      setError(msg);
      if (cached) {
        setData(cached.data);
        setFromCache(true);
        setCacheSavedAt(cached.savedAt);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, path]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data,
    loading,
    refreshing,
    fromCache,
    cacheSavedAt,
    error,
    online,
    refresh,
  };
}
