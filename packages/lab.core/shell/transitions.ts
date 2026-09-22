// Ported from one.flexibel/packages/flexibel.browser/browser-ui/src/lab/transport.ts (5e0370c5b); replace with the shared lane-shell package in Phase 4.

/** Debounce for app-transition snapshots: one refresh per burst of DOM updates. */
export const APP_TRANSITION_DEBOUNCE_MS = 800;

export interface AppTransitionObserver {
  observe(target: unknown, options?: unknown): void;
  disconnect(): void;
}

/**
 * Re-snapshot when the app instance visibly changes instead of polling on a
 * timer. The observer factory is injected so the debounce/disconnect contract
 * stays unit-testable without a DOM.
 */
export function observeAppTransitions(
  createObserver: (callback: () => void) => AppTransitionObserver,
  target: unknown,
  onTransition: () => void,
  debounceMs = APP_TRANSITION_DEBOUNCE_MS,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = createObserver(() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      onTransition();
    }, debounceMs);
  });
  observer.observe(target, { childList: true, subtree: true, attributes: true, characterData: true });
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    observer.disconnect();
  };
}
