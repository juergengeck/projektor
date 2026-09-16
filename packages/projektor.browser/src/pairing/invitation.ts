/**
 * Pairing invitation parsing, reused from the vger.browser stack: the same
 * parser the InvitationAcceptance flow uses, so pairing URLs are validated
 * identically on both sides.
 */
import { parseInvitationUrl } from "@vger/browser-ui/utils/invitation-url-parser";

export interface ParsedPairing {
  url: string;
  token: string;
  mode?: string;
}

export function parsePairingUrl(url: string): ParsedPairing {
  const parsed = parseInvitationUrl(url);
  if (parsed.error || !parsed.invitation) {
    throw new Error(parsed.error || "Invalid pairing invitation URL.");
  }
  return { url, token: parsed.invitation.token, mode: parsed.mode };
}
