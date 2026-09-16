import { useCallback, useEffect, useState } from "react";
import { currentDepartment, operation } from "./api";

export function useDepartment(): string {
  return currentDepartment();
}

export function useOp<T>(method: string, params: Record<string, unknown> = {}, deps: unknown[] = []): {
  data: T | null; error: Error | null; reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce(n => n + 1), []);
  useEffect(() => {
    let live = true;
    operation<T>(method, params)
      .then(result => { if (live) { setData(result); setError(null); } })
      .catch(err => { if (live) setError(err as Error); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, nonce, ...deps]);
  return { data, error, reload };
}

export function withDepartment(params: Record<string, unknown> = {}): Record<string, unknown> {
  const department = currentDepartment();
  return department ? { ...params, department } : { ...params };
}
