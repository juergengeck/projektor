import React from "react";
import ReactDOM from "react-dom/client";
import Lab from "./Lab";
import "../../../amway.app/ui/styles.css";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("lab-root")!).render(
  <React.StrictMode>
    <Lab />
  </React.StrictMode>,
);
