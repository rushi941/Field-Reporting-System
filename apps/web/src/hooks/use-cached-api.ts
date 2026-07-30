import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cacheGet, cacheSet, scopedCacheKey } from "@/lib/offline-cache";
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
  userId?: string,
): CachedApiState<T> {
  const online = useOnlineStatus();
  const scopedKey = scopedCacheKey(userId, cacheKey);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setLoading(true);
    setRefreshing(false);
    setFromCache(false);
    setCacheSavedAt(null);
    setError(null);
  }, [scopedKey]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    const cached = cacheGet<T>(scopedKey);
    if (cached) {
      setData(cached.data);
      setFromCache(true);
      setCacheSavedAt(cached.savedAt);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const fresh = await apiFetch<T>(path);
      setData(fresh);
      cacheSet(scopedKey, fresh);
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
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scopedKey, path, userId]);

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
