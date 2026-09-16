import { useEffect, useState } from "react";
import { operation } from "../api";
import { applyTheme, setLanguage, t, useLang } from "../i18n";

interface Schema { fields: { key: string; type: string; options: { value: string; label: string }[]; default: string }[] }
interface Values { [key: string]: string }
interface TrustInfo { organizationManager: string; managerEnrolledBy: string; manager: string; trustedSigners: string[] }

function SettingsCard({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="settings-card" open={open}>
      <summary>{title}</summary>
      <div className="settings-card-body">{children}</div>
    </details>
  );
}

function DataSection({ department, onDone }: { department: string; onDone: () => void }) {
  const [notice, setNotice] = useState("");
  const [pendingSigner, setPendingSigner] = useState<string | null>(null);

  async function exportDept() {
    const envelope = await operation("exportDepartment", { department });
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${department}.amway.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setNotice(t("data.exported"));
  }

  async function importFile(file: File) {
    const envelope = JSON.parse(await file.text());
    const result = await operation<{ trustStatus: string; signer: string }>("importDepartment", { envelope });
    if (result.trustStatus === "unverified") {
      setPendingSigner(result.signer);
      setNotice(`${t("data.importUnverified")} ${result.signer}`);
    } else {
      setPendingSigner(null);
      setNotice(t("data.importOk"));
    }
    onDone();
  }

  async function elevate() {
    if (!pendingSigner) return;
    await operation("trustSigner", { signer: pendingSigner });
    setPendingSigner(null);
    setNotice(t("data.importOk"));
    onDone();
  }

  async function loadDemo() {
    const result = await operation<{ department: string }>("loadDemo", {});
    localStorage.setItem("amway.department", result.department);
    setNotice(t("data.importOk"));
    onDone();
  }

  async function publish() {
    const info = await operation<{ manager: string }>("getTrustInfo", { department });
    const result = await operation<{ rootRef: string }>("publishDepartment", { issuer: info.manager, department });
    setNotice(`${t("data.published")} ${result.rootRef.slice(0, 12)}`);
    onDone();
  }

  return (
    <SettingsCard title={t("settings.data")}>
      <button type="button" disabled={!department} onClick={() => void exportDept()}>⬇ {t("data.export")}</button>
      <label>{t("data.import")}
        <input type="file" accept=".json,application/json"
          onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); }} />
      </label>
      <button type="button" className="secondary" onClick={() => void loadDemo()}>✨ {t("data.demo")}</button>
      <button type="button" className="secondary" disabled={!department}
        onClick={() => void publish().catch(err => setNotice(err instanceof Error ? err.message : String(err)))}>
        ⬆ {t("data.publish")}
      </button>
      {notice ? <p>{notice}</p> : null}
      {pendingSigner ? <button type="button" className="warning" onClick={() => void elevate()}>{t("data.elevate")}</button> : null}
    </SettingsCard>
  );
}

function TrustSection({ department }: { department: string }) {
  const [info, setInfo] = useState<TrustInfo | null>(null);
  const [signer, setSigner] = useState("");
  useEffect(() => {
    if (department) void operation<TrustInfo>("getTrustInfo", { department }).then(setInfo);
  }, [department]);
  async function add() {
    if (!signer.trim()) return;
    await operation("trustSigner", { signer: signer.trim() });
    setSigner("");
    setInfo(await operation<TrustInfo>("getTrustInfo", { department }));
  }
  async function remove(name: string) {
    await operation("untrustSigner", { signer: name });
    setInfo(await operation<TrustInfo>("getTrustInfo", { department }));
  }
  return (
    <SettingsCard title={t("settings.trust")}>
      {!department ? <div className="state-empty">{t("scope.required")}</div> : !info ? null : (
        <>
          <div className="card" style={{ margin: 0 }}>
            <strong>{t("trust.chain")}: </strong>
            <p className="code-cell">{`${info.organizationManager} → ${info.managerEnrolledBy} → ${info.manager}`}</p>
          </div>
          <div>
            <strong>{t("trust.signers")}: </strong>
            {info.trustedSigners.length === 0 ? <span className="state-empty"> — </span> : null}
            {info.trustedSigners.map(name => (
              <div key={name} className="user-badge" style={{ margin: "0.25rem 0.25rem 0.25rem 0" }}>
                <span className="code-cell">{name}</span>
                <button type="button" className="danger sm" onClick={() => void remove(name)}>{t("trust.remove")}</button>
              </div>
            ))}
          </div>
          <div className="input-with-button" style={{ marginTop: "0.75rem" }}>
            <input placeholder={t("trust.signers")} aria-label={t("trust.signers")} value={signer} onChange={e => setSigner(e.target.value)} />
            <button type="button" onClick={() => void add()}>{t("trust.add")}</button>
          </div>
        </>
      )}
    </SettingsCard>
  );
}

export default function Settings({ email, department, onNavigate }: {
  email: string; department: string; onNavigate: () => void;
}) {
  useLang();
  const [schema, setSchema] = useState<Schema | null>(null);
  const [values, setValues] = useState<Values>({});
  useEffect(() => {
    void operation<{ schema: Schema; values: Values }>("getSettings", {}).then(result => {
      setSchema(result.schema);
      setValues(result.values);
      localStorage.setItem("amway.lang", result.values.language);
      localStorage.setItem("amway.theme", result.values.theme);
    });
  }, []);

  async function change(key: string, value: string) {
    const updated = await operation<{ values: Values }>("updateSettings", { key, value });
    setValues(updated.values);
    localStorage.setItem(key === "theme" ? "amway.theme" : "amway.lang", updated.values[key]);
    if (key === "language") setLanguage(updated.values[key]);
    else applyTheme();
  }

  return (
    <section>
      <div className="page-header">
        <h1>{t("settings.title")}</h1>
        <p>{t("settings.subtitle")}</p>
      </div>
      <div className="settings-grid">
        <SettingsCard title={t("settings.account")} open>
          <p>{t("auth.signedInAs")} {email}.</p>
          <p className="state-empty">{t("auth.restartHint")}</p>
        </SettingsCard>
        {(schema?.fields ?? []).filter(field => field.type === "select").map(field => (
          <SettingsCard key={field.key} title={t(`settings.${field.key === "theme" ? "appearance" : field.key}`)}>
            <label>{t(field.key === "theme" ? "settings.appearance" : "settings.language")}
              <select value={values[field.key] ?? field.default} onChange={e => void change(field.key, e.target.value)}>
                {field.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {field.key === "theme" ? t(`theme.${option.value}`) : option.label}
                  </option>
                ))}
              </select>
            </label>
          </SettingsCard>
        ))}
        <DataSection department={department} onDone={onNavigate} />
        <TrustSection department={department} />
      </div>
    </section>
  );
}
