// packages/lab.core/session-plan.ts
/**
 * Session lifecycle and invite entry for one lane app instance, in the plan
 * vocabulary the Flexibel lane host speaks (session / ui / onecore). One
 * instance per realm: a second sign-in in the same document throws instead
 * of replacing the first.
 */
export interface LaneUiState {
  ownerId: string | null;
  instanceId: string | null;
  authState: "logged_out" | "logging_in" | "logged_in";
  postLoginPlansReady: boolean;
  pendingInvitation: boolean;
}

export interface BootedInstance {
  ownerId: string;
  instanceId: string;
  instanceName: string;
  connectWithInvite(url: string): Promise<void>;
}

interface Credentials { email: string; secret: string; instanceName: string }

export function createSessionPlans({ boot }: { boot: (credentials: Credentials) => Promise<BootedInstance> }) {
  let instance: BootedInstance | null = null;
  let booting: Promise<BootedInstance> | null = null;
  let pendingInvitation: string | null = null;

  const state = (): LaneUiState => ({
    ownerId: instance?.ownerId ?? null,
    instanceId: instance?.instanceId ?? null,
    authState: instance ? "logged_in" : booting ? "logging_in" : "logged_out",
    postLoginPlansReady: instance !== null,
    pendingInvitation: pendingInvitation !== null,
  });

  const start = async (credentials: Credentials): Promise<{ readyState: LaneUiState }> => {
    if (instance || booting) throw new Error("Lane app: already signed in in this document.");
    booting = boot(credentials);
    try {
      instance = await booting;
    } finally {
      booting = null;
    }
    return { readyState: state() };
  };

  const session = {
    registerAndSetup: start,
    loginAndInit: start,
    async waitUntilReady({ timeoutMs }: { timeoutMs: number }): Promise<LaneUiState> {
      if (!instance && !booting) throw new Error("Lane app: still booting (no instance yet).");
      if (instance) return state();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          booting,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Lane app: waitUntilReady timed out.")), timeoutMs); }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      return state();
    },
  };

  const ui = {
    async getInviteState(): Promise<LaneUiState> {
      return state();
    },
    async loadPendingInvitation({ url }: { url: string }) {
      const parsed = new URL(url);
      if (parsed.searchParams.get("invited") !== "true" || !parsed.hash) throw new Error("Lane app: not a lane invitation URL.");
      pendingInvitation = url;
      return { loaded: true, pendingInvitationPresent: true };
    },
    async acceptPendingInvitation({ secret, displayName, expectedEmail }: { secret: string; displayName: string; expectedEmail: string }) {
      if (!pendingInvitation) throw new Error("Lane app: no pending invitation.");
      const url = pendingInvitation;
      await start({ email: expectedEmail.toLowerCase(), secret, instanceName: displayName });
      await instance!.connectWithInvite(url);
      pendingInvitation = null;
      return { ownerId: instance!.ownerId };
    },
  };

  const onecore = {
    async getStatus() {
      if (!instance) throw new Error("Lane app: no instance.");
      return { ownerId: instance.ownerId, instanceId: instance.instanceId, instanceName: instance.instanceName };
    },
  };

  return { session, ui, onecore };
}
