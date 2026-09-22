// Ported from one.flexibel/packages/flexibel.browser/browser-ui/src/lab/transport.ts (5e0370c5b); replace with the shared lane-shell package in Phase 4.
import { callPlan, type PlanRegistry } from "./plan-client.ts";

/** Structural subset of the host lane client the retry helper needs. */
export interface ShellClient {
  key: string;
  registry: PlanRegistry;
}

/**
 * During boot, the operations this lane needs may not be registered yet and the
 * call fails with `Operation '<plan>' not found`. Wait for exactly the
 * operation being called instead of global readiness: a struggling instance
 * may never finish registering every plan, but the one we need usually
 * arrives early. Only the not-found error retries; any other failure (and
 * any success) settles immediately, so side-effecting calls can never run
 * twice — not-found throws before the method dispatches.
 */
export async function callWhenRegistered<T>(
  client: ShellClient,
  signal: AbortSignal,
  label: string,
  plan: string,
  method: string,
  params?: unknown,
  callTimeoutMs = 20_000,
  waitTimeoutMs = 60_000,
): Promise<T> {
  const notFound = `Operation '${plan}' not found`;
  const deadline = Date.now() + waitTimeoutMs;
  for (;;) {
    if (signal.aborted) throw new Error(`Lab ${client.key} ${label}: document was closed.`);
    try {
      return await callPlan<T>(client.registry, signal, plan, method, params, callTimeoutMs);
    } catch (error) {
      if (signal.aborted) throw error;
      if (!String((error as Error)?.message ?? error).includes(notFound) || Date.now() >= deadline) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

export async function poll(
  signal: AbortSignal,
  label: string,
  timeoutMs: number,
  check: () => Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (signal.aborted) throw new Error(`Lab ${label}: document was closed.`);
    if (await check()) return;
    if (Date.now() >= deadline) throw new Error(`Lab ${label}: timed out.`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
