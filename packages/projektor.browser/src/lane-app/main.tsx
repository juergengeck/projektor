// packages/projektor.browser/src/lane-app/main.tsx
/**
 * One role's lane app, hosted in a same-origin iframe by the lane shell.
 * Boots its own ONE instance lazily (the host drives `session.*` through
 * `window.__planRegistry`), renders the role screens with live data, and
 * routes CHUM over the host's `lab://` switch through the child port.
 */
import "@refinio/one.core/system/load-browser.js";
import React from "react";
import ReactDOM from "react-dom/client";
import { brandById } from "@projektor/lab.core/brand.ts";
import { LAB_ROLES } from "@projektor/lab.core/recipes.ts";
import { startLabInstance } from "@projektor/lab.core/worker/lab-instance.ts";
import { iframeChildPort } from "@projektor/lab.core/iframe-port.ts";
import { resolveStorageDirectory } from "@projektor/lab.core/storage.ts";
import { exposeRegistry } from "@projektor/lab.core/registry-bridge.ts";
import type { LabPort } from "@projektor/lab.core/port-ipc.ts";
import type { FeedRow } from "@projektor/lab.core/port-ipc.ts";
import "../../../amway.app/ui/styles.css";
import "./themes/amway.css";
import "./themes/ek.css";
import { AMWAY_CONTENT } from "./content.ts";
import type { LaneContent } from "./content.ts";
import { RoleApp } from "./RoleApp";
import type { LaneClient } from "./feed.ts";

if (window.parent === window) {
  const message = "Lane app runs only inside a lane host iframe.";
  const root = document.getElementById("lane-app-root");
  if (root) root.textContent = message;
  throw new Error(message);
}

const params = new URLSearchParams(window.location.search);
const brand = brandById(params.get("lane") ?? "");
const role = params.get("labInstance") ?? "";
if (!(LAB_ROLES as readonly string[]).includes(role)) {
  throw new Error(`${brand.label}: labInstance must be a lane role, got ${JSON.stringify(role)}.`);
}
const directory = resolveStorageDirectory(brand, window.location.search);

// Lane peers for the appoint/share subjects, supplied by the host once every
// role has signed in (`?peers=admin:<hash>,…`). Absent until then: the action
// buttons that need a subject report it through the plan validation.
const persons: Record<string, string> = {};
for (const pair of (params.get("peers") ?? "").split(",")) {
  const [name, hash] = pair.split(":");
  if (name && /^[0-9a-f]{64}$/.test(hash ?? "")) persons[name] = hash;
}

// EK content plugs into the same shape when the EK shell moves over in Task 13.
const content: LaneContent = AMWAY_CONTENT;
document.documentElement.dataset.brand = brand.id;

const origin = window.location.origin;
const childPort = iframeChildPort(window, origin);
// Feed tee: rows travel to the host (which snapshots columns from them) and
// stay visible to this realm, so the role screens render live CHUM too.
const feedTaps = new Set<(row: FeedRow) => void>();
const teePort: LabPort = {
  ...childPort,
  postMessage: (message, transfer) => {
    const row = (message as { kind?: string; row?: FeedRow })?.kind === "feed"
      ? (message as { row: FeedRow }).row
      : undefined;
    if (row) feedTaps.forEach(tap => tap(row));
    return childPort.postMessage(message, transfer);
  },
};

function laneCommServer(): string | undefined {
  const value = params.get("commServer") ?? "";
  return /^wss?:\/\//.test(value) ? value : undefined;
}

function laneAppBase(): string {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set("lane", brand.lane);
  return url.toString();
}

async function boot(): Promise<void> {
  const instance = await startLabInstance({
    brand,
    port: teePort,
    key: role,
    directory,
    createMessageChannel: () => new MessageChannel(),
    commServerUrl: laneCommServer(),
    appBaseUrl: laneAppBase(),
  });
  const laneClient: LaneClient = {
    call: <T,>(plan: string, method: string, callParams?: Record<string, unknown>): Promise<T> =>
      instance.call(plan, method, callParams) as Promise<T>,
    onFeed: callback => {
      feedTaps.add(callback);
      return () => {
        feedTaps.delete(callback);
      };
    },
  };
  exposeRegistry(window, { call: (plan, method, callParams) => laneClient.call(plan, method, callParams) });
  ReactDOM.createRoot(document.getElementById("lane-app-root")!).render(
    <React.StrictMode>
      <RoleApp brand={brand} content={content} role={role} client={laneClient} persons={persons} />
    </React.StrictMode>,
  );
}

boot().catch(error => {
  const root = document.getElementById("lane-app-root");
  if (root) root.textContent = error instanceof Error ? error.message : String(error);
  throw error;
});
