import { useEffect, useState } from "react";
import { EMAIL_KEY, currentDepartment, operation, setDepartment } from "./api";
import { applyTheme, setLanguage, t, useLang } from "./i18n";
import Auth from "./screens/Auth";
import Lab from "./lab/Lab";
import Chat from "./screens/Chat";
import { Earnings, Returns } from "./screens/Finance";
import Inventory from "./screens/Inventory";
import Journal from "./screens/Journal";
import Orders from "./screens/Orders";
import Overview from "./screens/Overview";
import People from "./screens/People";
import Products from "./screens/Products";
import Settings from "./screens/Settings";

const SCREENS = ["overview", "people", "chat", "products", "orders", "inventory", "earnings", "returns", "journal"] as const;
type Screen = (typeof SCREENS)[number] | "settings";

function screenFromHash(): Screen {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "settings") return "settings";
  return (SCREENS as readonly string[]).includes(hash) ? (hash as Screen) : "overview";
}

function isLabHash(): boolean {
  return window.location.hash.replace(/^#\/?/, "").startsWith("lab");
}

function ScopeBanner({ department, onScope }: { department: string; onScope: (dept: string) => void }) {
  const [input, setInput] = useState("");
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!department) {
      operation<{ departments?: { id: string; name: string }[] }>("getScope", {})
        .then(scope => setDepts(scope.departments ?? []))
        .catch(() => {});
    }
  }, [department]);

  async function select(id: string) {
    const value = id.trim();
    if (!value) { setError(t("scope.missing")); return; }
    setError("");
    await operation("selectDepartment", { department: value });
    setDepartment(value);
    onScope(value);
  }

  return (
    <div id="scope-banner" role="status" aria-live="polite">
      {!department ? (
        <>
          <div className="scope-content">
            <span className="badge badge-warning">{t("scope.none")}</span>
            <span className="scope-hint-text">{t("scope.hint")}</span>
          </div>
          <div className="scope-controls">
            <input id="department-input" placeholder={t("scope.placeholder")} aria-label={t("scope.department")}
              value={input} onChange={e => setInput(e.target.value)} />
            <button type="button" onClick={() => void select(input)}>{t("scope.select")}</button>
            {depts.length ? (
              <div className="scope-quick-chips">
                <span className="scope-hint-text">{t("scope.quickSelect")}</span>
                {depts.map(dept => (
                  <button key={dept.id} type="button" className="scope-chip" onClick={() => void select(dept.id)}>
                    {dept.name || dept.id}
                  </button>
                ))}
              </div>
            ) : null}
            {error ? <p className="state-denied">{error}</p> : null}
          </div>
        </>
      ) : (
        <>
          <div className="scope-content">
            <span className="scope-hint-text">{t("scope.active")}:</span>
            <span className="scope-pill">🏢 {department}</span>
          </div>
          <div className="scope-controls">
            <button type="button" className="secondary sm" onClick={() => { setDepartment(""); onScope(""); }}>
              {t("scope.change")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  useLang();
  const [email, setEmail] = useState(localStorage.getItem(EMAIL_KEY) || "");
  const [screen, setScreen] = useState<Screen>(screenFromHash());
  const [isLab, setIsLab] = useState(isLabHash());
  const [department, setDept] = useState(currentDepartment());
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const onHash = () => { setScreen(screenFromHash()); setIsLab(isLabHash()); };
    window.addEventListener("hashchange", onHash);
    document.title = t("app.title");
    setLanguage(document.documentElement.lang === "fr" || document.documentElement.lang === "en"
      ? document.documentElement.lang : "de");
    applyTheme();
    // The lab is deliberately sessionless; do not issue a guaranteed 401 from
    // the single-instance shell when it is opened directly.
    if (!isLabHash()) {
      operation<{ values: { language: string; theme: string } }>("getSettings", {})
        .then(({ values }) => {
          localStorage.setItem("amway.lang", values.language);
          localStorage.setItem("amway.theme", values.theme);
          setLanguage(values.language);
          applyTheme();
        })
        .catch(() => {});
    }
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => { document.title = t("app.title"); });

  // The lab is a separate shell: each column carries its own worker-owned
  // session, so the global single-instance login must not gate or leak into it.
  if (isLab) {
    return <Lab />;
  }

  if (!email) {
    return <Auth onUnlock={address => { setEmail(address); setRefresh(n => n + 1); }} />;
  }

  const go = (id: Screen) => { window.location.hash = `#/${id}`; };
  const titles: Record<string, string> = {
    overview: t("nav.overview"), people: t("nav.people"), chat: t("nav.chat"),
    products: t("nav.products"), orders: t("nav.orders"), inventory: t("nav.inventory"),
    earnings: t("nav.earnings"), returns: t("nav.returns"), journal: t("nav.journal"),
  };

  return (
    <>
      <header className="shell-header">
        <img id="brand-logo" src="/amway/assets/amway-logo-black.svg" alt="Amway" width={71} height={24} />
        <nav id="main-nav" aria-label={t("nav.label")}>
          {SCREENS.map(id => (
            <a key={id} href={`#/${id}`} aria-current={id === screen ? "page" : undefined}>{titles[id]}</a>
          ))}
        </nav>
      </header>
      <ScopeBanner department={department} onScope={dept => { setDept(dept); setRefresh(n => n + 1); }} />
      <p id="message" role="alert" />
      <main id="screen">
        {screen !== "settings" && (
          <section>
            <div className="page-header"><h1>{titles[screen]}</h1></div>
            {screen === "overview" && <Overview key={refresh} />}
            {screen === "people" && <People key={refresh} department={department} refresh={refresh} />}
            {screen === "chat" && <Chat key={refresh} department={department} refresh={refresh} />}
            {screen === "products" && <Products key={refresh} refresh={refresh} />}
            {screen === "orders" && <Orders key={refresh} department={department} refresh={refresh} />}
            {screen === "inventory" && <Inventory key={refresh} department={department} refresh={refresh} />}
            {screen === "earnings" && <Earnings key={refresh} department={department} refresh={refresh} />}
            {screen === "returns" && <Returns key={refresh} refresh={refresh} />}
            {screen === "journal" && <Journal key={refresh} department={department} refresh={refresh} />}
          </section>
        )}
        {screen === "settings" && (
          <Settings email={email} department={department} onNavigate={() => setRefresh(n => n + 1)} />
        )}
      </main>
      <button id="settings-cog" type="button" aria-label={t("settings.title")}
        aria-current={screen === "settings" ? "page" : undefined} onClick={() => go("settings")}>
        &#9881;&#xFE0E;
      </button>
    </>
  );
}
