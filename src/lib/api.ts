'use client';
import { useCallback, useEffect, useState } from 'react';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(path.startsWith('/api/') ? path : `/api/backend/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    cache: 'no-store',
  });
  const body = await r
    .json()
    .catch(() => ({ message: 'Unexpected server response. Please try again.' }));
  if (!r.ok) {
    if (r.status === 401 && !path.includes('session'))
      window.dispatchEvent(new Event('farm:unauthorized'));
    throw new ApiError(body.message || 'Request failed', r.status, body.errors || []);
  }
  return body.data;
}
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!path) {
      setData(undefined);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    setData(undefined);
    api<T>(path, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);
  return { data, loading, error, refresh };
}
