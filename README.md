# projektor.one Prototype

This folder contains a static browser prototype for `projektor.one`, based on:

- `STEERINGone_20260525_V001.pdf`
- `flexibel-rollenflows-patient-arzt-studienzentrum.pptx`
- the role, trust, channel, and journal patterns from `../heiner/one.flexibel`
- the goal-first AI run model from `../vger` and `@refinio/coding.core`
- the reusable runtime/package owners in `../one` whenever they already cover the primitive

## Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy

Build a clean static bundle:

```bash
npm run build
```

Deploy to Cloudflare Pages project `projektor-one`:

```bash
npm run deploy
```

## Prototype Intent

The app models project management software for architecture offices first. The current seeded dataset uses a municipal Kita build only as an example from the source docs:

- project cockpit for communication, documents, and decisions
- role certificates and channel access derived from the Flexibel role model
- HOAI phase tracking with cross-cutting topics
- VGER-style AI surface with `ProjectGoal`, `ProjectPreparedWorkload`, and `ProjectAIRun`
- ONE-style journal events with object references
- `settings.core`-style management surface for UI theme and project-scoped source settings
- `source.mail` / `@refinio/source.imap` IMAP account configuration with password/token represented as a `SecretsPlan` reference
- Flexibel-inspired data import/export section with template CSV, preview/warnings, project export bundle, and source-mail/settings/journal sections
- UI language support for German, English, French, and Spanish via the `UISettings.language` preference
- first-run onboarding that explains the web-as-app-store model, local-only browser data, optional local password protection, email-as-identity, and procurement usage-statistics consent

## ../one Reuse Rule

When a primitive already exists in `../one`, `projektor.one` should consume it rather than recreate it:

- `@refinio/one.core` for recipes, content-addressed objects, access and storage
- `@refinio/one.models` for runtime models, channels, Leute/contact model and MultiUser wiring
- `@refinio/settings.core` for `UISettings`, `SettingsPlan` and `SecretsPlan`
- `@refinio/source.core` for `Source`, `SourceEntry`, `SourceRun`, `Book` and provenance contracts
- `@refinio/trust.core` for trust relationships, role evidence, revocation and verification
- `@refinio/calendar.core` and `@refinio/chat.core` for calendar/chat primitives
- `@refinio/refinio.api` for ModuleRegistry demand/supply and public operation registration

This is not a live ONE.core runtime yet. The current code intentionally keeps the object names, identity hints, channel boundaries, and AI lifecycle visible so the next step can turn the prototype vocabulary into recipes and registered runtime surfaces.

## Product Docs

- [Onboarding MRD](./docs/projektor-onboarding-mrd.md)
- [Onboarding PRD](./docs/projektor-onboarding-prd.md)
