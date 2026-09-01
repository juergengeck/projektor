# Flyer Claims — Review Before Distribution

The participant flyer (`flyer-de.pdf`, `flyer-en.pdf`) is written for external
project participants: clients, authorities, specialist planners, and
contractors.

## What the page argues

The page describes the **federated model**: each participant keeps their own
project record, shares from it deliberately, and receives what others share.
Nobody holds the master copy. This follows MRD §5 — *"Each organization holds its
own record; the shared project state is the set of assertions the participants
have signed and exchanged"* — and §7.1's insistence that a participant gets
their own standing rather than a guest pass to someone else's system.

The body is **four USPs stated as capability**, in a 2×2 grid:

| Block | USP behind it |
|---|---|
| *Sofort startklar* | no barriers |
| *Offen und nachvollziehbar* | open |
| *Dauerhaft in Ihrer Hand* | no lock-in |
| *Belastbar über Jahre* | resilient |

An earlier draft used mechanism headings (hold / share / verify), which described
how the product works rather than why anyone should care. A second draft stated
the same four USPs as negations — *"Niemand muss Sie hereinlassen"*, *"Niemand
kann es Ihnen wegnehmen"* — which was rejected on the principle that **the page
should claim what the product does, not what nobody can do to you**. Negations
define the product by other people's absent power; they are reactive.

That principle is now enforced through the whole page. The strap is *Im Browser ·
In Minuten · Bei Ihnen* rather than "Kein Konto · Keine Installation", and the
data-residency footer states where data sits rather than which clouds it avoids.
**There is no "kein/keine" left in the German body copy** — the only remaining
negation is the eIDAS qualifier in fine print, which is required (see below).

**"So entsteht die Nachweiskette"** explains the mechanism in three lay
sentences: everyone keeps their own record, everyone signs what they commit to,
and what reaches you carries the signature of whoever stated it — *"damit ist
jede Kopie so belastbar wie das Original."*

That last line is doing the heaviest lifting on the page. It is the positive
answer to the question a federated model provokes — *if no one holds the
original, what proves anything?* Do not replace it with a statement about what
is absent.

## MRD alignment — RESOLVED

The MRD previously listed full peer participation as priority **C**, while the
flyer described it as the product. That is now fixed in
[projektor-mrd.md](../projektor-mrd.md):

- **`C` removed.** Peer participation is stated as the model. MR-6 now names
  **two participation tiers** — *peer* (holds their own record; the model) and
  *minimal* (holds nothing; reads a shared view or a bundle; the floor) — both
  **M**, with an explicit instruction that minimal-tier requirements must never
  constrain the peer tier into a read-only shape.
- **New peer requirements (M):** each organization holds its own record with no
  master copy; the record survives project end, a participant withdrawing, and
  licence lapse; a first-time participant obtains *their own* record rather than
  access to someone else's; sharing is bilateral and symmetric, with no party's
  release capability deriving from another's licence; disagreement surfaces as
  open divergence to both sides and is never silently merged.
- **§5 and §7.1 corrected** — both previously said participation begins by
  "opening a link", which was the guest-view framing.
- **Gate 15 rescoped** to the minimal tier; it does not arise in the peer tier,
  where the recipient holds keys of their own.
- **Gates 2 and 6 flagged as load-bearing** — the transport peers exchange over,
  and what a participant sees when two records disagree.
- **§8** now measures the peer/minimal split rather than view-opens.
- **§10 gained criteria 14 and 15** — mutual sharing actually happens (sharing
  that runs one way is "the minimal tier wearing the peer tier's clothes"), and
  divergence is survivable in the field.
- **§11 and §13** record that the peer model is the least-built part of the
  product and the part the positioning now rests on.

## Implementation status — verified, not assumed

An earlier version of this register gated most of the page on MRD §11's claim
that signed assertions and synchronization were unimplemented. **That was wrong.**
The mechanism is implemented in the ONE platform and green under test:

| Package | Tests | Relevant to |
|---|---|---|
| `assembly.core` | 72 in 17 files | Signing, verification, release/selective disclosure, head log, divergence |
| `trust.core` | 18 | Certificate bundles, effective issuer key, root selection |
| `sync.core` | 72 | Synchronization |

Directly supporting the page: a signed assembly rejects any mutation of a signed
field, rejects a signature by a key the named signer does not own, rejects a
transition whose signer falls outside the writer policy, and rejects a payload
whose calculated identity differs from its claimed entity. Divergent heads are
held as explicit concurrent state and never silently merged. Selective disclosure
is authored as a release carrying exactly the disclosed closure with **no
predecessors**, so no working history crosses the boundary.

**Caveat that matters:** all of this is in `one-experimental`. The projektor
prototype does not consume it yet. The flyer describes the product, and the
product's mechanism is real — but a demo of `app.js` will not show it.

## Claims that depend on an open gate

| Flyer statement | Basis | Gate | Status |
|---|---|---|---|
| "Jeder Beteiligte unterzeichnet seine Zusagen für die anderen" / "damit ist jede Kopie so belastbar wie das Original" | MR-2 Class B signed assertions | — | **Supported.** Deterministic gestalt signing; signed-field mutation, wrong-key and malformed-signature all rejected under test |
| "Jede Zusage trägt die Unterschrift dessen, der sie erklärt hat — mit Zeitpunkt und Grundlage" | MR-2; MR-5 attribution | — | **Supported.** `AssemblyVerifier` verifies signing keys, signer, primary identity and gestalt signature |
| "Wird nachträglich etwas daran geändert, trägt sie keine gültige Unterschrift mehr" | MR-5 no silent alteration | — | **Supported.** *"creates one deterministic signature and rejects any signed-field mutation"* |
| "Wer für einen Vorgang nicht zuständig war, kann ihn auch nicht fortschreiben" | MR-2 writer policy; MR-3 authority | — | **Supported.** *"rejects a genesis whose certified signer is outside its writer policy"*; successor authority is intersection over consumed predecessors |
| "Freigegeben wird genau das Ausgewählte — Ihre Vorgeschichte und Ihre internen Zwischenstände gehen nicht mit" | MR-4 selective disclosure | **Gate 8 — re-open** | **Supported, by a better mechanism than MR-4 specifies.** A release is a predecessor-free edge with `instance` absent, so no working history crosses the boundary. 15 passing tests |
| "Sie geben gezielt frei: genau den Stand, genau an den Empfänger" | MR-4 per-recipient release | — | **Supported.** `ReleaseState` binds source identity and audience; exact `Access` grant |
| **"Verfahren und Formate sind offengelegt und dokumentiert"** | — | **Unverified** | **Check before distribution.** The assembly architecture is documented in `one-experimental/docs/`, but that is an internal design doc. This claims *published* methods and formats to an outside reader. Either publish a spec, or soften to what is actually true |
| "Widersprechen sich zwei Stände, bleibt der Widerspruch stehen — beiden Seiten sichtbar" | MR-2 divergence never merged | **Gate 2 — UX only** | **Semantics supported** (*"keeps different concurrent exact releases as an explicit conflict"*). What a Projektleiter sees is unbuilt |
| "Die Prüfung läuft bei Ihnen — ohne Rückfrage bei uns und ohne Verbindung zu einem Server" | MR-3 local repeatable verification | — | **Supported for a peer.** Evidence coherence is decidable from the strong closure alone — no ambient keychain, global lookup or network fetch. Root acceptance is the receiver's own local trust selection |
| "Die anderen Beteiligten geben Ihnen gegenüber nach denselben Regeln frei" | MR-6 bilateral symmetry | **Gate 6 — metadata privacy** | Transport exists (`sync.core`); open question is what a peer learns from sync metadata |
| "Sie bestätigen Meilensteine in Ihrem eigenen Namen" *(strip)* | MR-6 countersigning | **Gate 9** | Signing exists; WebAuthn binding of a credential to a named party does not |
| "Er bleibt Ihrer … auch, wenn eine Lizenz ausläuft" | MR-3 licence-lapse position | **Gate 14** | Design is right — trust changes `EffectiveIssuerKeyHead` and never rewrites Assembly heads. Still needs the explicit as-of-assertion-time verifier test §13 demands |
| "Die Daten bleiben in Ihrem Browser, auf Ihrem Rechner" | MR-1 local control | **Gate 12** | Architectural; wording needs counsel sign-off |

## Removed because gate 7 does not support them

Two lines were cut from column three in this revision:

- *"Sie lassen sich jederzeit ein Dokument ausgeben, das Ihre Seite belegt"* — the
  PDF/A-3 dual-layer bundle does not exist in either repository.
- *"Prüfbar … im Browser, ohne Internetverbindung"* as addressed to a party who
  runs nothing — the standalone offline verifier does not exist.

They were replaced with claims that hold today: signature invalidation on
alteration, writer-policy authority, and local verification **by a peer who holds
the record**. The distinction is narrow but real — verification logic exists;
packaging it for someone who runs nothing does not. Restore both lines when
gate 7 closes; they are strong and worth having back.

**Net effect:** the page's central mechanism claims — signing, attribution,
selective disclosure, visible divergence — are supported. What remains genuinely
forward-looking is narrower than it looked: the **PDF/A-3 bundle and the offline
verifier** (gate 7), **WebAuthn countersignature binding** (gate 9), and the
**divergence UX** (gate 2).

## Claims that are safe as written

- No account, no installation, no common server, nothing to dismantle at project end.
- Participants keep Outlook, their file server, and existing programs.
- No single place where the project sits as a whole; no vendor to join.

## The eIDAS line is not optional

> *"Eine Bestätigung im Browser ist eine Projektbestätigung im Sinne der
> Zusammenarbeit und keine qualifizierte elektronische Signatur nach eIDAS."*

MRD §13 lists countersignature over-reading as a liability risk *to the product*,
not only to the user. The risk rose when countersigning became **M** and the page
began inviting the act. It sits in footer fine print — not in a disclaimer band,
which is bad use of a flyer — but it must not be deleted when the page is cut.

## Recommended handling

1. **Gate 7 is the page's real exposure.** Two lines depend on it — "ein Dokument,
   das Ihre Seite belegt" and "prüfbar … im Browser, ohne Internetverbindung".
   The verification logic exists in `assembly.core`; the PDF/A-3 container and the
   standalone offline verifier do not exist anywhere. Either build them or move
   those two lines to future tense. Everything else on the page stands.
2. **Gate 2 is a design task, not a research task.** Divergence semantics are
   implemented and correct; only the surface is missing. Success criterion 15.
3. **Re-open gate 8 before specifying it.** MR-4 assumes hash redaction with
   inclusion proofs; the platform discloses via release assemblies whose closure
   is exactly the disclosed content. Do not write a journal spec against the
   model that lost.
4. Gate 9 for the countersignature line; gate 12 (counsel) covers the whole page.
5. Watch success criterion 14 on the reference project. If external parties only
   ever receive and never share back, the page describes a model the deployment
   does not exhibit — a quiet failure, not a loud one.
6. **Check claims against packages and tests, not against prose.** This register
   was wrong for several revisions because it trusted §11's self-description.

## Files

| File | Purpose |
|---|---|
| `flyer-de.html`, `flyer-en.html` | Design source. `flyer-en.html` shares the German stylesheet verbatim — change layout in the German file and re-port so the two stay in lockstep |
| `flyer-de.pdf`, `flyer-en.pdf` | **Print-ready A4**, rendered from the HTML. The definitive artifact |
| `flyer-de.docx`, `flyer-en.docx` | **Editable Word version** for colleagues who need to revise text without touching HTML |
| `build-docx.cjs`, `logo.png` | Build script and logo asset for the Word version |

## Rebuilding

Print PDFs (the definitive artifact):

```bash
cd docs/flyer && for l in de en; do "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf=flyer-$l.pdf flyer-$l.html; done
```

Word versions:

```bash
cd docs/flyer && npm install docx && node build-docx.cjs
```

`docx` (npm) is **not installed on this machine** — the build script needs it.
For a small text change it is quicker to patch `word/document.xml` inside the
`.docx` directly (unzip, edit, rezip) than to install the toolchain.

**The two formats do not share a source.** `build-docx.cjs` carries its own copy
of the flyer text, so any copy change must be made in both the HTML and the
script or the versions will drift. When checking the Word output, convert to PDF
with `--outdir` pointing somewhere else — LibreOffice writes `flyer-de.pdf`
beside the input and will otherwise overwrite the print-ready PDF.
