import { useState } from "react";
import { EMAIL_KEY, REMEMBER_KEY, unlockSession } from "../api";
import { AMWAY_LANGUAGES } from "@projektor/amway/i18n.js";
import { setLanguage, t, useLang } from "../i18n";

const LABELS: Record<string, string> = { de: "Deutsch", en: "English", fr: "Français" };

export default function Auth({ onUnlock }: { onUnlock: (email: string) => void }) {
  useLang();
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) !== "false");
  const [email, setEmail] = useState(() => (localStorage.getItem(REMEMBER_KEY) !== "false" ? localStorage.getItem(EMAIL_KEY) || "" : ""));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await unlockSession(email.trim(), password);
      if (remember) {
        localStorage.setItem(EMAIL_KEY, email.trim());
        localStorage.setItem(REMEMBER_KEY, "true");
      } else {
        localStorage.removeItem(EMAIL_KEY);
        localStorage.setItem(REMEMBER_KEY, "false");
      }
      onUnlock(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "");
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/amway/assets/amway-logo-black.svg" alt="Amway" width={100} height={34} />
          <h1>{t("auth.signin")}</h1>
          <p>{t("auth.tagline")}</p>
        </div>
        <form onSubmit={submit}>
          <label>{t("lang.label")}
            <select aria-label={t("lang.label")} value={document.documentElement.lang} onChange={e => setLanguage(e.target.value)}>
              {AMWAY_LANGUAGES.map(lang => <option key={lang} value={lang}>{LABELS[lang]}</option>)}
            </select>
          </label>
          <label>{t("auth.email")}
            <input type="email" id="amway-email" name="username" autoComplete="username"
              placeholder="seller@example.de" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>{t("auth.password")}
            <input type="password" id="amway-password" name="password" autoComplete="current-password"
              placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" id="amway-remember" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span>{t("auth.remember")}</span>
          </label>
          <button type="submit">{t("auth.signin")}</button>
          {error ? <p className="state-denied">{error}</p> : null}
        </form>
        <div className="auth-footer"><span>{t("auth.instanceInfo")}</span></div>
      </div>
    </div>
  );
}
