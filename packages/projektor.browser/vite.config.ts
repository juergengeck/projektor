import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const ONE = "/Users/gecko/src/one/packages";
const VGER_BROWSER_UI = "/Users/gecko/src/vger/packages/vger.browser/browser-ui/src";
const HERE = __dirname;

export default defineConfig({
  base: "/browser/",
  plugins: [react()],
  // Single React identity: every copy resolves to the local install.
  resolve: {
    alias: [
      { find: /^react$/, replacement: path.join(HERE, "node_modules/react/index.js") },
      { find: /^react-dom$/, replacement: path.join(HERE, "node_modules/react-dom/index.js") },
      { find: /^react-dom\/client$/, replacement: path.join(HERE, "node_modules/react-dom/client.js") },
      // Built connection stack (dist ESM, no cross-repo install needed).
      { find: /^@refinio\/connection\.core\/(.*)$/, replacement: `${ONE}/connection.core/dist/esm/$1` },
      { find: /^@refinio\/connection\.core$/, replacement: `${ONE}/connection.core/dist/esm/index.js` },
      // Compiled one.core lib (same files the node server uses, browser branch).
      // Specific first: one.models/refinio.api import @refinio/one.core/lib/* with the lib/ prefix.
      { find: /^@refinio\/one\.core\/lib\/(.*)$/, replacement: `${ONE}/one.core/lib/$1` },
      { find: /^@refinio\/one\.models\/lib\/(.*)$/, replacement: `${ONE}/one.models/lib/$1` },
      { find: /^@refinio\/one\.core\/(.*)$/, replacement: `${ONE}/one.core/lib/$1` },
      { find: /^@refinio\/one\.core$/, replacement: `${ONE}/one.core/lib/index.js` },
      { find: /^@refinio\/one\.models\/(.*)$/, replacement: `${ONE}/one.models/lib/$1` },
      { find: /^@refinio\/one\.models$/, replacement: `${ONE}/one.models/lib/index.js` },
      // vger.browser sources reused directly: invitation URL parser.
      { find: /^@vger\/browser-ui\/(.*)$/, replacement: `${VGER_BROWSER_UI}/$1` },
      { find: /^@vger\/vger\.core\/(.*)$/, replacement: `${ONE}/vger.core/dist/$1` },
      { find: /^@vger\/vger\.core$/, replacement: `${ONE}/vger.core/dist/index.js` },
      // Amway domain modules (plain JS, same-origin ops).
      { find: /^@projektor\/amway\/(.*)$/, replacement: "/Users/gecko/src/projektor/packages/amway.app/$1" },
      { find: /^@projektor\/amway\.lab\/(.*)$/, replacement: "/Users/gecko/src/projektor/packages/amway.lab/$1" },
      { find: /^@refinio\/api\/(.*)$/, replacement: `${ONE}/refinio.api/dist/src/$1` },
      { find: "@", replacement: path.join(HERE, "src") },
    ],
  },
  server: {
    fs: { allow: [HERE, "/Users/gecko/src/one", "/Users/gecko/src/vger", "/Users/gecko/src/projektor"] },
  },
  worker: { format: "es" },
  build: {
    rollupOptions: {
      input: {
        main: path.join(HERE, "index.html"),
        lab: path.join(HERE, "lab/index.html"),
      },
    },
  },
});
