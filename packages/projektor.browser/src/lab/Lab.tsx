// packages/projektor.browser/src/lab/Lab.tsx
/**
 * Flexibel-style lane host: one lane-app iframe per role, seeded through
 * invites. The host never touches lab data — columns render snapshot chrome
 * (owner/instance ids, roles, app state) around the live iframe, and every
 * role action happens inside the lane app. CHUM stays between the instances
 * over the lab:// switch with the glue commserver for IoM discovery.
 */
import { useEffect, useRef, useState } from "react";
import amwayLogo from "../../../amway.app/assets/amway-logo-black.svg";
import ekLogo from "../lane-app/assets/ek/elektro-klein-logo.jpg";
import ekFavicon from "../lane-app/assets/ek/favicon.png";
import omniturm from "../lane-app/assets/ek/omniturm.jpg";
import igmLogo from "../lane-app/assets/igm/igm-logo.svg";
import igmFavicon from "../lane-app/assets/igm/favicon.svg";
import porscheTower from "../lane-app/assets/igm/porsche-design-tower.jpg";
import { LabDeviceInvite } from "../components/LabDeviceInvite";
import { Badge, RoleBadge } from "../components/ui";
import {
  bootJoinInstance,
  bootLab,
  LAB_KEYS,
  pairMesh,
  seedDepartment,
  seedRole,
  type LabClient,
  type LabKey,
  type LabSnapshot,
} from "./transport";
import { AMWAY_CONTENT, EK_CONTENT, IGM_CONTENT, displayRoleText } from "../lane-app/content";
import { SNAPSHOT_TRIGGER_KINDS } from "../lane-app/feed";
import type { LaneContent } from "../lane-app/content";
import { brandById, type LabBrand } from "@projektor/lab.core/brand.ts";
import { callPlan, type PlanRegistry } from "@projektor/lab.core/shell/plan-client.ts";
import { observeAppTransitions } from "@projektor/lab.core/shell/transitions.ts";
import { laneFromHostPath } from "@projektor/lab.core/shell/urls.ts";
import {
  nextLabThemeMode,
  parseLabThemeMode,
  resolveLabEffectiveTheme,
  type LabThemeMode,
} from "@projektor/lab.core/shell/theme.ts";

interface ShellMeta {
  pageTitle: string;
  heading: string;
  subtitle: string;
  logo: string;
  logoAlt: string;
  logoWidth: number;
  logoHeight: number;
  favicon: string;
  themeColor: string;
  laneClass: string;
  content: LaneContent;
  website?: string;
  eyebrow?: string;
  artwork?: { src: string; alt: string; caption: string };
  /** Device name in the IoM invitation chrome (the forks disagreed; keep both). */
  deviceName(key: LabKey): string;
}

const SHELL: Record<LabBrand["id"], ShellMeta> = {
  amway: {
    pageTitle: "Amway · Demo workspace",
    heading: "Demo workspace",
    subtitle: "Four federated solutions in one real time view",
    logo: amwayLogo,
    logoAlt: "Amway",
    logoWidth: 142,
    logoHeight: 48,
    favicon: "/amway/assets/amway-logo-black.svg",
    themeColor: "#38539a",
    laneClass: "amway-lane",
    content: AMWAY_CONTENT,
    deviceName: key => key,
  },
  ek: {
    pageTitle: "Elektro Klein AG · EK Lab",
    heading: "EK lab",
    subtitle: "Four independent instances in one browser tab",
    logo: ekLogo,
    logoAlt: "Elektro Klein AG",
    logoWidth: 200,
    logoHeight: 70,
    favicon: ekFavicon,
    themeColor: "#ED1D1E",
    laneClass: "ek-lane",
    content: EK_CONTENT,
    website: "https://www.e-k-ag.de/",
    eyebrow: "ELEKTRO KLEIN AG",
    artwork: { src: omniturm, alt: "Omniturm, an Elektro Klein project in Frankfurt", caption: "Omniturm · Frankfurt" },
    deviceName: key => EK_CONTENT.roleTitles[key] ?? key,
  },
  igm: {
    pageTitle: "IGM · Facade Lab",
    heading: "IGM lab",
    subtitle: "Facade construction demo · Illustrative items & prices",
    logo: igmLogo,
    logoAlt: "IGM",
    logoWidth: 178,
    logoHeight: 61,
    favicon: igmFavicon,
    themeColor: "#8d1d2c",
    laneClass: "igm-lane",
    content: IGM_CONTENT,
    website: "https://www.igmfassaden.de/",
    eyebrow: "VISIONÄRE FASSADEN",
    artwork: { src: porscheTower, alt: "Porsche Design Tower in Stuttgart, an IGM facade project", caption: "Porsche Design Tower · Stuttgart" },
    deviceName: key => IGM_CONTENT.roleTitles[key] ?? key,
  },
};

/**
 * Invitation link opened from a QR code (`?invited=true` plus the pairing
 * payload in the hash): the lane offers to join as a second device instead
 * of booting another mesh.
 */
function inviteLinkFromLocation(): string | null {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("invited") === "true" && url.hash.length > 1 ? url.toString() : null;
  } catch {
    return null;
  }
}

interface ColumnState {
  snapshot: LabSnapshot | null;
  notice: string;
  seed: string;
}

function initialColumns(): Record<LabKey, ColumnState> {
  return Object.fromEntries(
    LAB_KEYS.map(key => [key, { snapshot: null, notice: "", seed: "" }]),
  ) as Record<LabKey, ColumnState>;
}

function appStateOf(snapshot: LabSnapshot | null): string {
  const state = snapshot?.inviteState;
  if (!state) return "unknown";
  if (state.authState === "logged_in") return state.postLoginPlansReady ? "ready" : "signing in";
  if (state.authState === "logging_in") return "signing in";
  return "pre-login";
}

function shortId(id: string | null | undefined): string {
  return id ? `${id.slice(0, 10)}…${id.slice(-6)}` : "Initializing…";
}

export default function Lab() {
  const [brand] = useState<LabBrand>(() => brandById(laneFromHostPath(window.location.pathname) ?? ""));
  const shell = SHELL[brand.id];
  const content = shell.content;
  const [boot, setBoot] = useState<"booting" | "live" | string>("booting");
  const [bootStage, setBootStage] = useState("starting");
  const [seedLog, setSeedLog] = useState<string[]>([]);
  const [columns, setColumns] = useState<Record<LabKey, ColumnState>>(initialColumns);
  const [clients, setClients] = useState<Record<LabKey, LabClient> | null>(null);
  const handle = useRef<{ setSwitch(key: LabKey, open: boolean): void; stop(): Promise<void> } | null>(null);
  const mounts = useRef<Record<LabKey, HTMLDivElement | null>>({ admin: null, manager: null, seller: null, customer: null });
  const [joinInvite] = useState<string | null>(() => inviteLinkFromLocation());
  const [joinStatus, setJoinStatus] = useState("");
  const [joined, setJoined] = useState<{ key: LabKey; person: string } | null>(null);
  const joinHandle = useRef<{ stop(): void } | null>(null);
  const joinMount = useRef<HTMLDivElement | null>(null);
  const [themeMode, setThemeMode] = useState<LabThemeMode>(
    () => parseLabThemeMode(localStorage.getItem("lab.themeMode")) ?? "system",
  );
  const [systemDark, setSystemDark] = useState(
    () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    document.title = shell.pageTitle;
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = shell.favicon;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = shell.themeColor;
  }, [shell]);

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const effectiveTheme = resolveLabEffectiveTheme(themeMode, systemDark);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    try {
      localStorage.setItem("lab.themeMode", themeMode);
    } catch {
      // Private browsing: the toggle still applies to this page load.
    }
    for (const key of LAB_KEYS) {
      try {
        const doc = handle.current ? clients?.[key].iframe.contentDocument : undefined;
        if (doc) doc.documentElement.dataset.theme = effectiveTheme;
      } catch {
        // Same-origin write; a navigating iframe reports it on its next snapshot.
      }
    }
  }, [effectiveTheme, themeMode, clients]);

  useEffect(() => {
    if (joinInvite) {
      setBootStage("invitation link — join only");
      setBoot("live");
      return;
    }
    const controller = new AbortController();
    const signal = controller.signal;
    let cancelled = false;
    const stops: (() => void)[] = [];
    const log = (line: string) => {
      if (!cancelled) setSeedLog(current => [...current, line]);
    };
    const snapshotSequence = Object.fromEntries(LAB_KEYS.map(key => [key, 0])) as Record<LabKey, number>;
    const snapshotColumn = async (client: LabClient) => {
      const sequence = ++snapshotSequence[client.key];
      try {
        const snapshot = await client.snapshot(signal);
        if (!cancelled && sequence === snapshotSequence[client.key]) {
          setColumns(current => ({ ...current, [client.key]: { ...current[client.key], snapshot, notice: "" } }));
        }
      } catch (error) {
        if (!cancelled) {
          const notice = error instanceof Error ? error.message : String(error);
          setColumns(current => ({ ...current, [client.key]: { ...current[client.key], notice } }));
        }
      }
    };
    const setSeed = (key: LabKey, seed: string) => {
      if (!cancelled) setColumns(current => ({ ...current, [key]: { ...current[key], seed } }));
    };
    (async () => {
      const booted = await bootLab(brand, {
        document,
        mount: key => {
          const mount = mounts.current[key];
          if (!mount) throw new Error(`Lab ${key}: column mount is missing.`);
          return mount;
        },
        onStage: line => {
          setBootStage(line);
          log(line);
        },
      });
      if (cancelled) {
        await booted.stop();
        return;
      }
      handle.current = booted;
      setClients(booted.clients);
      const { clients: lane } = booted;
      // Refresh from the instance's semantic feed. DOM transitions still
      // cover sign-in and device state changes, without polling.
      for (const key of LAB_KEYS) {
        const unsubscribe = lane[key].onFeed?.(row => {
          if (SNAPSHOT_TRIGGER_KINDS.includes(row.kind ?? "")) void snapshotColumn(lane[key]);
        });
        if (unsubscribe) stops.push(unsubscribe);
        const root = lane[key].iframe.contentDocument?.documentElement;
        if (root) {
          stops.push(
            observeAppTransitions(callback => new MutationObserver(callback), root, () => void snapshotColumn(lane[key])),
          );
        }
      }
      await seedDepartment(lane.admin, brand, signal);
      setSeed("admin", `department ${brand.department.id} created`);
      log(`department ${brand.department.id} created`);
      for (const key of ["manager", "seller", "customer"] as const) {
        const line = await seedRole(lane.admin, lane[key], key, `${key}@${brand.emailDomain}`, window.location.href, signal);
        setSeed(key, line);
        log(line);
      }
      await pairMesh(lane, signal);
      log("mesh paired: manager–seller, manager–customer, seller–customer");
      // Appoint/share subjects: every role's owner, pushed into the iframes
      // (a URL renavigation cannot supply them — see lane-app/main.tsx).
      const persons: Record<string, string> = {};
      for (const key of LAB_KEYS) {
        const snapshot = await lane[key].snapshot(signal);
        const owner = snapshot.inviteState?.ownerId;
        if (!owner) throw new Error(`Lab ${key}: no owner after seed.`);
        persons[key] = owner;
      }
      for (const key of LAB_KEYS) {
        await callPlan(lane[key].registry, signal, "ui", "setLanePeers", { peers: persons });
      }
      log(`peers shared (${LAB_KEYS.length} roles)`);
      for (const key of LAB_KEYS) await snapshotColumn(lane[key]);
      setBoot("live");
    })().catch(error => {
      if (!cancelled) setBoot(error instanceof Error ? error.message : String(error));
    });
    return () => {
      cancelled = true;
      controller.abort();
      stops.forEach(stop => stop());
      const running = handle.current;
      handle.current = null;
      setClients(null);
      void running?.stop().catch(() => {});
    };
  }, [brand, joinInvite]);

  const onlineCount = LAB_KEYS.filter(key => columns[key].snapshot?.inviteState?.authState === "logged_in").length;

  /** Join link opened from a QR invitation: boot a same-person device and pair it. */
  async function joinWithInviteLink(invitationUrl: string) {
    if (joinHandle.current) {
      setJoinStatus("A joined device is already active; leave it first.");
      return;
    }
    let key: LabKey | null = null;
    let email = "";
    try {
      email = new URL(invitationUrl).searchParams.get("fe") ?? "";
      const prefix = email.split("@")[0];
      key = (LAB_KEYS as readonly string[]).includes(prefix) ? (prefix as LabKey) : null;
    } catch {
      key = null;
    }
    if (!key || !email.includes("@")) {
      setJoinStatus("That URL is not a lab device invitation.");
      return;
    }
    const role = key;
    setJoinStatus("booting device…");
    setJoined(null);
    try {
      const controller = new AbortController();
      const { client, stop } = await bootJoinInstance(brand, role, {
        document,
        mount: () => {
          if (!joinMount.current) throw new Error(`Lab ${role}: join mount is missing.`);
          return joinMount.current;
        },
        onStage: setJoinStatus,
      });
      joinHandle.current = { stop };
      // Same role credentials reproduce the invited Person; the invitation
      // authorizes this instance's additional keys through the commserver.
      await callPlan(client.registry, controller.signal, "session", "registerAndSetup", {
        email,
        secret: `lab-${role}`,
        instanceName: role,
      }, 125_000);
      const accepted = await callPlan<{ person: string }>(
        client.registry, controller.signal, "lab", "acceptIoMInvite", { invitationUrl }, 120_000,
      );
      setJoined({ key: role, person: accepted.person });
      setJoinStatus("device paired ✓");
    } catch (error) {
      try {
        joinHandle.current?.stop();
      } catch {
        // Removal is best-effort; the status below already reports the failure.
      }
      joinHandle.current = null;
      setJoined(null);
      setJoinStatus(`join failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function leaveJoined() {
    try {
      joinHandle.current?.stop();
    } catch {
      // Removal is best-effort; the state below already reset.
    }
    joinHandle.current = null;
    setJoined(null);
    setJoinStatus("");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("invited");
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch {
      // Link cleanup is cosmetic; the join state above already reset.
    }
  }

  return (
    <div className={`lab-container ${shell.laneClass}`}>
      <header className="lab-header">
        {shell.website ? (
          <>
            <div className={`${brand.id}-brand-heading`}>
              <a className={`${brand.id}-logo`} href={shell.website} target="_blank" rel="noreferrer" aria-label={`${shell.logoAlt} website`}>
                <img src={shell.logo} width={shell.logoWidth} height={shell.logoHeight} alt={shell.logoAlt} />
              </a>
              <div className="lab-title-group">
                <p className={`${brand.id}-eyebrow`}>{shell.eyebrow}</p>
                <h1>{shell.heading}</h1>
                <p className="lab-subtitle">{shell.subtitle}</p>
              </div>
            </div>
            <div className={`${brand.id}-project-art`}>
              <img src={shell.artwork!.src} alt={shell.artwork!.alt} />
              <span>{shell.artwork!.caption}</span>
            </div>
          </>
        ) : (
          <div className="amway-brand-heading">
            <div className="lab-title-group">
              <h1>{shell.heading}</h1>
              <p className="lab-subtitle">{shell.subtitle}</p>
            </div>
          </div>
        )}

        <div className="lab-header-actions">
          <div className="lab-mesh-badge">
            <span className={boot === "live" && onlineCount === 4 ? "lab-pulse-online" : "lab-pulse-paused"} />
            <span>
              {boot === "booting"
                ? `Starting ${onlineCount}/4 nodes…`
                : boot === "live"
                  ? `Mesh: ${onlineCount}/4 Nodes Online`
                  : "Mesh unavailable"}
            </span>
          </div>

          <button
            type="button"
            className="secondary sm"
            onClick={() => setThemeMode(nextLabThemeMode(themeMode))}
            title={`Theme: ${themeMode} (effective ${effectiveTheme})`}
          >
            Theme: {themeMode}
          </button>
        </div>
      </header>

      {boot !== "live" && (
        <div className={`card ${boot === "booting" ? "" : "state-denied"}`} style={{ marginBottom: "1.25rem", textAlign: "center" }}>
          {boot === "booting" ? (
            <p style={{ margin: 0, fontWeight: 600 }}>
              <span className="lab-pulse-online" /> Booting… {displayRoleText(bootStage, content)}
            </p>
          ) : (
            <p style={{ margin: 0, fontWeight: 600 }}>Boot Failure: {boot}</p>
          )}
        </div>
      )}

      {joinInvite && (
        <div className="card" role="dialog" aria-label="Join with device invitation" style={{ marginBottom: "1.25rem", fontSize: "0.8rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <strong>This device was invited to join the lane as a second device.</strong>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <button type="button" className="secondary sm" onClick={() => void joinWithInviteLink(joinInvite)}>
                Join
              </button>
              <button type="button" className="secondary sm" onClick={() => void leaveJoined()}>
                Dismiss
              </button>
              {joinStatus && <span style={{ color: "var(--amway-muted)" }}>{joinStatus}</span>}
            </div>
            {joined && (
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", fontSize: "0.72rem" }}>
                <span style={{ color: "var(--amway-muted)" }}>Joined as {content.roleTitles[joined.key] ?? joined.key}:</span>
                <span>{joined.person.slice(0, 10)}…{joined.person.slice(-4)}</span>
                <button type="button" className="secondary sm" onClick={() => void leaveJoined()}>
                  Leave
                </button>
              </div>
            )}
            <div
              ref={element => {
                joinMount.current = element;
              }}
            />
          </div>
        </div>
      )}

      {!joinInvite && (
        <>
          <div className="lab-grid">
            {LAB_KEYS.map(key => {
              const column = columns[key];
              const title = content.roleTitles[key] ?? key;
              const ownerId = column.snapshot?.inviteState?.ownerId;
              const instanceId = column.snapshot?.inviteState?.instanceId;
              const roles = column.snapshot?.department && column.snapshot.department.known
                ? column.snapshot.department.roles
                : [];
              const registry: PlanRegistry | undefined = clients?.[key].registry;
              return (
                <div className="lab-device" key={key}>
                  <section
                    aria-label={title}
                    className="lab-column"
                  >
                    <div className="lab-column-frame">
                      <div
                        ref={element => {
                          mounts.current[key] = element;
                        }}
                      />
                    </div>
                    <div className="lab-column-meta">
                      {column.notice && (
                        <div className="state-denied" style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>
                          <span style={{ userSelect: "text" }}>{column.notice}</span>
                        </div>
                      )}

                      <div className="lab-person-id">
                        <span title={ownerId ?? ""}>ID: {shortId(ownerId)}</span>
                      </div>
                      <div className="lab-person-id">
                        <span title={instanceId ?? ""}>Instance: {shortId(instanceId)}</span>
                      </div>

                      <div className="lab-role-tags">
                        <span style={{ fontSize: "0.72rem", color: "var(--amway-muted)", marginRight: "2px" }}>Roles:</span>
                        {roles.length > 0 ? (
                          roles.map(role => <RoleBadge key={role} role={role} label={content.roleTitles[role] ?? role} />)
                        ) : (
                          <Badge text={content.appointment.waiting} variant="neutral" />
                        )}
                      </div>

                      <div className="lab-role-tags">
                        <span style={{ fontSize: "0.72rem", color: "var(--amway-muted)", marginRight: "2px" }}>App:</span>
                        <span style={{ fontSize: "0.72rem" }}>{displayRoleText(appStateOf(column.snapshot), content)}</span>
                        {column.seed && (
                          <span style={{ fontSize: "0.72rem", color: "var(--amway-muted)" }}> · {displayRoleText(column.seed, content)}</span>
                        )}
                      </div>
                    </div>
                  </section>
                  <LabDeviceInvite
                    client={boot === "live" ? registry : undefined}
                    plan="lab"
                    deviceKey={shell.deviceName(key)}
                  />
                </div>
              );
            })}
          </div>

          {seedLog.length > 0 && (
            <section aria-label="Seed log" style={{ marginTop: "1.25rem", fontSize: "0.75rem" }}>
              <div className="lab-section-title">Seed log</div>
              <ul style={{ margin: "0.4rem 0", paddingLeft: "1.2rem" }}>
                {seedLog.map((line, index) => <li key={`${index}-${line}`}>{displayRoleText(line, content)}</li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
