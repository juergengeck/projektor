import { test, expect } from "@playwright/test";
import { runLaneCeremony } from "../../ci.core/smoke/lane-ceremony.mjs";
import { laneById } from "../../ci.core/lanes.mjs";

/** Amway lane smoke through the shared ceremony driver (see ci.core). */
test("amway lane ceremony", async ({ page }) => {
  await runLaneCeremony(page, laneById("amway"), expect);
});
