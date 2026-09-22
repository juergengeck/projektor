import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../../amway.app/ui/styles.css";
import "./lane-app/themes/amway.css";
import "./lane-app/themes/ek.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
