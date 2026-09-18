import { test, expect } from "@playwright/test";
import { runLaneCeremony } from "../../ci.core/smoke/lane-ceremony.mjs";
import { laneById } from "../../ci.core/lanes.mjs";

/** EK lane smoke through the shared ceremony driver (see ci.core). */
test("ek lane ceremony", async ({ page }) => {
  await runLaneCeremony(page, laneById("ek"), expect);
});
