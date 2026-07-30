import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<T | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const refresh = useCallback(async () => {
    if (!path) {
      setData(null);
      dataRef.current = null;
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const hasContent = dataRef.current !== null;
    if (hasContent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const fresh = await apiFetch<T>(path);
      setData(fresh);
      dataRef.current = fresh;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      if (!hasContent) {
        setData(null);
        dataRef.current = null;
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [path]);

  useEffect(() => {
    setData(null);
    dataRef.current = null;
    setLoading(true);
    setRefreshing(false);
    setError(null);
    void refresh();
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps -- reset when path changes

  return { data, loading, refreshing, error, refresh };
};
