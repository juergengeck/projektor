// packages/lab.core/registry-bridge.ts
/**
 * Control plane between the lane host and one lane app instance, matching
 * Flexibel's DemoPlanRegistry contract (flexibel.browser/browser-ui/src/demo/
 * runner-client.ts): the host waits for `#__api_bridge`, then calls
 * `window.__planRegistry.call(plan, method, params)`. The registry is set
 * before the marker is appended, so the marker alone proves readiness.
 * Plans may not be registered yet; that failure comes back as the
 * `Operation '<plan>' not found` message the host's callWhenRegistered expects.
 */
export interface PlanRegistry {
  call(plan: string, method: string, params?: unknown): Promise<{ success: boolean; data?: unknown; error?: { message?: string } }>;
}

export function exposeRegistry(
  win: Window & { __planRegistry?: PlanRegistry },
  registry: { call(plan: string, method: string, params: unknown): Promise<unknown> },
): () => void {
  win.__planRegistry = {
    async call(plan, method, params) {
      try {
        return { success: true, data: await registry.call(plan, method, params ?? {}) };
      } catch (error) {
        return { success: false, error: { message: error instanceof Error ? error.message : String(error) } };
      }
    },
  };
  const marker = win.document.createElement("div");
  marker.id = "__api_bridge";
  marker.hidden = true;
  win.document.body.appendChild(marker);
  return () => {
    marker.remove?.();
    delete win.__planRegistry;
  };
}
