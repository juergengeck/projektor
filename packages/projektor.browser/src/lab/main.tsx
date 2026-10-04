import React from "react";
import ReactDOM from "react-dom/client";
import Lab from "./Lab";
import { brandById } from "@projektor/lab.core/brand.ts";
import { laneHostUrl } from "@projektor/lab.core/shell/urls.ts";
import "../../../amway.app/ui/styles.css";
import "../lane-app/themes/amway.css";
import "../lane-app/themes/ek.css";
import "../lane-app/themes/igm.css";

// `/browser/lab/?lane=` is the former address: move to `/lab/<lane>`, keeping
// the other query parameters (notably `?commServer=`) and an invitation hash.
const here = new URL(window.location.href);
const formerLane = here.pathname.startsWith("/browser/lab") ? here.searchParams.get("lane") : null;
if (formerLane !== null) {
  here.searchParams.delete("lane");
  const target = new URL(laneHostUrl(here.origin, brandById(formerLane)));
  target.search = here.search;
  target.hash = here.hash;
  window.location.replace(target.href);
} else {
  ReactDOM.createRoot(document.getElementById("lab-root")!).render(
    <React.StrictMode>
      <Lab />
    </React.StrictMode>,
  );
}
