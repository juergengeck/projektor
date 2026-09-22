import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PortApiClient } from "@projektor/amway.lab/port-ipc.ts";
import "./LabDeviceInvite.css";

/** The device invitation belongs below the app frame, independent of its tabs. */
export function LabDeviceInvite({ client, plan, deviceKey }: {
  client: Pick<PortApiClient, "call"> | undefined;
  plan: string;
  deviceKey: string;
}) {
  const [generation, setGeneration] = useState(0);
  const [invite, setInvite] = useState({ url: "", status: "Waiting for boot…", busy: false });
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const qrDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = qrDialog.current;
    if (!expanded || !invite.url || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [expanded, invite.url]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    setInvite({ url: "", status: "Creating invitation…", busy: true });
    setCopyStatus("");
    void (async () => {
      try {
        const result = await client.call<{ invitationUrl: string; token: string }>(plan, "createIoMInvite", {});
        if (cancelled) return;
        const url = result.invitationUrl;
        setInvite({ url, status: "Scan to connect a second device", busy: false });
        // Observe this exact token's completion; no status polling or stale
        // completion updates after a replacement invitation or unmount.
        try {
          await client.call(plan, "awaitIoMInvite", { token: result.token, timeoutMs: 600_000 });
          if (!cancelled) setInvite({ url: "", status: "device paired ✓", busy: false });
        } catch (error) {
          if (!cancelled) setInvite({ url: "", status: `Pairing failed: ${error instanceof Error ? error.message : String(error)}`, busy: false });
        }
      } catch (error) {
        if (!cancelled) setInvite({ url: "", status: `Invite failed: ${error instanceof Error ? error.message : String(error)}`, busy: false });
      }
    })();
    return () => { cancelled = true; };
  }, [client, plan, generation]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Select the link to copy it");
    }
  }

  return (
    <section className="lab-device-invite" aria-label="Second device invitation">
      <div className="lab-section-title">
        <span>Second device · IoM</span>
        <button type="button" className="secondary sm" disabled={!client || invite.busy}
          onClick={() => setGeneration(value => value + 1)}>
          {invite.url ? "New invitation" : "Invite device"}
        </button>
      </div>
      {invite.url && (
        <div className="lab-device-invite-content">
          <button type="button" className="lab-device-qr" aria-label={`Enlarge device invitation QR for ${deviceKey}`}
            onClick={() => setExpanded(true)}>
            <QRCodeSVG value={invite.url} size={160} marginSize={4} bgColor="#ffffff" fgColor="#000000"
              role="img" aria-label={`Device invitation QR for ${deviceKey}`} />
          </button>
          <div className="lab-device-invite-link">
            <label>
              Invitation link
              <input readOnly value={invite.url} aria-label="Device invitation URL" onFocus={event => event.target.select()} />
            </label>
            <button type="button" className="secondary sm" onClick={() => void copy()}>Copy link</button>
            <span role="status">{copyStatus}</span>
          </div>
        </div>
      )}
      <p className="lab-device-invite-status" role="status">{invite.status}</p>
      {expanded && invite.url && (
        <dialog ref={qrDialog} className="lab-device-qr-dialog" aria-label={`Device invitation for ${deviceKey}`}
          onCancel={event => { event.preventDefault(); setExpanded(false); }}>
          <button type="button" className="secondary sm" onClick={() => setExpanded(false)}>Close QR</button>
          <QRCodeSVG value={invite.url} size={480} marginSize={4} bgColor="#ffffff" fgColor="#000000" />
          <p>Scan to connect a second device</p>
        </dialog>
      )}
    </section>
  );
}
