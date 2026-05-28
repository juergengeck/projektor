# projektor.one Onboarding MRD

## Market Problem

Architecture offices manage long-running projects with many external participants, formal roles, project mail, documents, decisions, and procurement-sensitive evidence. New software is often blocked by trust questions before users ever reach the project workflow:

- Is this a cloud account or a local project tool?
- Where does project data live?
- Will client, authority, or project mail be uploaded automatically?
- Can procurement teams understand usage without exposing project content?
- Is the password a vendor login or a local protection choice?

The onboarding must answer these questions before the first demo project opens.

## Target Users

- Architecture office owners evaluating projektor.one for office-wide use.
- Project leads who need a controlled cockpit for multi-year architecture projects.
- Procurement and public-sector stakeholders who need transparent usage evidence.
- Data protection reviewers who need a clear local-first story.

## Positioning

projektor.one uses the web as an app store: the browser can install and run project software without an app-store gatekeeper. The product should feel like a local-first project management system for architects, not a SaaS login screen.

## Core Message

1. The web is the app store: install or open projektor.one from the browser.
2. User and project data stays local on the user's machine, in the user's browser, unless they explicitly configure sharing or sync.
3. projektor.one does not upload project data to vendor servers automatically.
4. With consent, usage statistics can be collected for procurement and adoption reporting.
5. The optional password protects local data only.
6. Email is used as an identity ID, not as a login credential.

## Experience Principles

- Start with a friendly identity question, not an account wall.
- Separate trust, local storage, password, and statistics consent into understandable steps.
- Avoid implying that email plus password creates a central server account.
- Make opt-in statistics separate from required onboarding.
- Support German, English, French, and Spanish from the first screen.
- Keep language suitable for architects and procurement teams.

## Success Metrics

- Users complete onboarding without asking whether projektor.one uploads project data automatically.
- Procurement reviewers can repeat what statistics are and are not collected.
- Users understand that email is an identity field, not a vendor login.
- Users who choose no password still reach the prototype.
- Users can later reset or revisit onboarding from settings.

## Risks And Open Questions

- Exact legal wording for privacy and telemetry consent needs counsel review.
- Production encryption behavior must define how the optional password protects local data.
- The telemetry schema must be finalized before real collection starts.
- Browser storage limits and backup expectations need a production help surface.
- Multi-device sync, when introduced, needs a new consent and trust step.
