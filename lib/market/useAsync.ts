"use client";
/**
 * Minimal data-fetching hook — the same ergonomics as TanStack Query's
 * `useQuery` (data / loading / error / refetch + optional polling), with zero
 * dependencies. Swap for `@tanstack/react-query` later by replacing this file;
 * call sites use `{ data, loading, error }` which React Query also provides.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseAsyncOptions {
  /** Poll interval in ms (0 = disabled). */
  refetchInterval?: number;
  /** Skip fetching until true. */
  enabled?: boolean;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  options: UseAsyncOptions = {},
): AsyncState<T> {
  const { refetchInterval = 0, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fnRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run();
    if (refetchInterval > 0) {
      const id = setInterval(run, refetchInterval);
      return () => clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, refetchInterval]);

  return { data, loading, error, refetch: run };
}
