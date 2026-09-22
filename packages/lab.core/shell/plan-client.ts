// Ported from one.flexibel/packages/flexibel.browser/browser-ui/src/demo/runner-client.ts (5e0370c5b); replace with the shared lane-shell package in Phase 4.

/** A consumer of the very same registry/UI plan the lane app exposes. No
 * product model, storage, debug server, cross-origin RPC, or second instance.
 */
export interface PlanRegistry {
  call(handler: string, method: string, params?: unknown): Promise<{
    success: boolean;
    data?: unknown;
    error?: { message?: string };
  }>;
}

export type InstrumentedWindow = Window & { __planRegistry?: PlanRegistry };

export function waitForRegistry(
  app: InstrumentedWindow,
  signal: AbortSignal,
  timeoutMs = 30_000,
): Promise<PlanRegistry> {
  return new Promise((resolve, reject) => {
    let observer: MutationObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let poller: ReturnType<typeof setInterval> | undefined;
    const finish = (error?: Error, registry?: PlanRegistry) => {
      observer?.disconnect();
      clearTimeout(timer);
      clearInterval(poller);
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(registry!);
    };
    const abort = () => finish(new Error("App document was closed."));
    const liveDocument = (): Document | undefined => {
      try {
        return app.document ?? undefined;
      } catch {
        return undefined;
      }
    };
    let observedDocument: Document | undefined;
    const inspect = () => {
      // The iframe document is replaced when navigation commits. An observer
      // captured beforehand watches a dead document forever, so always
      // re-resolve the live document and re-attach when it changes.
      const doc = liveDocument();
      if (!doc) return;
      if (doc !== observedDocument) {
        if (observedDocument) observer?.disconnect();
        observedDocument = doc;
        try {
          observer?.observe(doc.documentElement, { childList: true, subtree: true });
        } catch {
          return;
        }
      }
      try {
        if (doc.getElementById("__api_bridge")) {
          if (!app.__planRegistry) throw new Error("QA bridge present, plan registry missing.");
          finish(undefined, app.__planRegistry);
        }
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => finish(new Error("The app QA interface is not ready.")), timeoutMs);
    try {
      // The registry is exposed before the runner's __api_bridge is appended.
      observer = new MutationObserver(inspect);
      poller = setInterval(inspect, 250);
      inspect();
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** Liveness bound only; never retries a read or a user action. */
export function callPlan<T>(
  registry: PlanRegistry,
  signal: AbortSignal,
  handler: string,
  method: string,
  params?: unknown,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("App document was closed."));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`${handler}.${method}: no response within the time limit.`));
    }, timeoutMs);
    Promise.resolve()
      .then(() => {
        if (signal.aborted) throw new Error("App document was closed.");
        return registry.call(handler, method, params);
      })
      .then(result => {
        cleanup();
        if (!result.success) {
          reject(new Error(result.error?.message || `${handler}.${method} failed.`));
        } else {
          // PlanRegistry passes through plans that already return { success, ... }.
          resolve(("data" in result ? result.data : result) as T);
        }
      }, error => {
        cleanup();
        reject(error);
      });
  });
}
