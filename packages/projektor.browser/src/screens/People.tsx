import { useState } from "react";
import { operation } from "../api";
import { Badge, Card, DataTable, Empty, RoleBadge } from "../components/ui";
import { useOp } from "../hooks";
import { personLabel, t, useLang } from "../i18n";
import { parsePairingUrl } from "../pairing/invitation";

interface Names { [id: string]: { name?: string; organization?: boolean } }
interface Directory { assignments: Assignment[]; contacts: Contact[]; names: Names }
interface Assignment { id: string; subject: string; role: string; issuer: string; revokedAt: number | null }
interface Contact { name: string; person: string; role: string; certified: { current: boolean }[] }
interface Invite { token: string; url: string; role: string; pairing?: { topic: string; connectionMode: string } | null }
interface Trust { manager: string }

function InvitePanel({ department, manager, onChange }: { department: string; manager: string; onChange: () => void }) {
  const [role, setRole] = useState("seller");
  const [url, setUrl] = useState("");
  const [person, setPerson] = useState("");
  const [name, setName] = useState("");
  const [pairUrl, setPairUrl] = useState("");
  const [pairToken, setPairToken] = useState("");
  const [pairPerson, setPairPerson] = useState("");
  const [pairName, setPairName] = useState("");
  const [notice, setNotice] = useState("");
  const { data } = useOp<{ invites: Invite[] }>("listInvites", { department }, [department]);
  const invites = data?.invites ?? [];

  async function run(task: () => Promise<void>) {
    setNotice("");
    try { await task(); } catch (err) { setNotice(err instanceof Error ? err.message : String(err)); }
  }

  return (
    <div className="settings-card">
      <h2>{t("invites.title")}</h2>
      <label>{t("invites.role")}
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="seller">seller</option>
          <option value="customer">customer</option>
        </select>
      </label>
      <button type="button" onClick={() => void run(async () => {
        const invite = await operation<Invite>("createInvite", { issuer: manager, department, role, pairing: {} });
        setNotice(invite.url);
        onChange();
      })}>{t("invites.create")}</button>
      {invites.length === 0 ? <Empty /> : (
        <table>
          <tbody>
            <tr><th>{t("invites.role")}</th><th>{t("invites.url")}</th><th>{t("invites.pairing")}</th><th /></tr>
            {invites.map(entry => (
              <tr key={entry.token}>
                <td>{entry.role}</td>
                <td><span style={{ wordBreak: "break-all" }}>{entry.url}</span></td>
                <td>{entry.pairing ? `${entry.pairing.connectionMode} · ${entry.pairing.topic}` : "—"}</td>
                <td><button type="button" onClick={() => void run(async () => {
                  await operation("revokeInvite", { issuer: manager, token: entry.token });
                  onChange();
                })}>{t("invites.revoke")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>{t("invites.accept")}</h3>
      <div className="form-row">
        <label>{t("invites.url")}<input value={url} onChange={e => setUrl(e.target.value)} placeholder={t("invites.url")} /></label>
        <label>{t("invites.person")}<input value={person} onChange={e => setPerson(e.target.value)} /></label>
        <label>{t("invites.name")}<input value={name} onChange={e => setName(e.target.value)} /></label>
        <button type="button" onClick={() => void run(async () => {
          const result = await operation<{ pairing: { person: string } }>("acceptInvite", {
            invitationUrl: url.trim(), person: person.trim(), name: name.trim(),
          });
          setNotice(`${t("data.importOk")} ${result.pairing.person}`);
          onChange();
        })}>{t("invites.accept")}</button>
      </div>
      <h3>{t("invites.pair")}</h3>
      <div className="form-row">
        <label>{t("invites.pairingUrl")}<input value={pairUrl} onChange={e => setPairUrl(e.target.value)} placeholder="https://…" /></label>
        <label>{t("invites.token")}<input value={pairToken} onChange={e => setPairToken(e.target.value)} /></label>
        <label>{t("invites.person")}<input value={pairPerson} onChange={e => setPairPerson(e.target.value)} /></label>
        <label>{t("invites.name")}<input value={pairName} onChange={e => setPairName(e.target.value)} /></label>
        <button type="button" onClick={() => void run(async () => {
          const parsed = parsePairingUrl(pairUrl.trim());
          const result = await operation<{ pairing: { person: string } }>("pairingComplete", {
            token: pairToken.trim(), person: pairPerson.trim(), name: pairName.trim(),
            topicId: `amway.department:${department}`, pairingUrl: parsed.url,
          });
          setNotice(`${t("data.importOk")} ${result.pairing.person}`);
          onChange();
        })}>{t("invites.pair")}</button>
      </div>
      {notice ? <p>{notice}</p> : null}
    </div>
  );
}

export default function People({ department, refresh }: { department: string; refresh: number }) {
  useLang();
  const { data, reload } = useOp<Directory>("getDirectory", { department }, [department, refresh]);
  const { data: trust } = useOp<Trust>("getTrustInfo", { department }, [department, refresh]);
  if (!data) return null;
  const { assignments, contacts, names } = data;
  return (
    <div>
      <InvitePanel department={department} manager={trust?.manager ?? ""} onChange={reload} />
      <Card title={t("section.teamAssignments")}>
        {assignments.length ? (
          <DataTable headers={[t("table.subject"), t("table.role"), t("table.issuer"), t("table.revoked")]}
            rows={assignments.map(entry => [
              personLabel(names, entry.subject),
              <RoleBadge key="r" role={entry.role} />,
              personLabel(names, entry.issuer),
              entry.revokedAt === null
                ? <Badge key="a" text={t("badge.active")} variant="success" />
                : <Badge key="x" text={t("badge.revoked")} variant="danger" />,
            ])} />
        ) : <Empty />}
      </Card>
      <Card title={t("section.contactsDirectory")}>
        {contacts.length ? (
          <DataTable headers={[t("table.name"), t("table.person"), t("table.role"), t("table.certified")]}
            rows={contacts.map(entry => [
              <strong key="n">{entry.name}</strong>,
              <span key="p" className="code-cell">{entry.person}</span>,
              <RoleBadge key="r" role={entry.role} />,
              entry.certified.some(cert => cert.current)
                ? <Badge key="v" text={t("badge.verified")} variant="success" dot />
                : <Badge key="u" text="—" variant="neutral" />,
            ])} />
        ) : <Empty />}
      </Card>
    </div>
  );
}
