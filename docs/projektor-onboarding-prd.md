# projektor.one Onboarding PRD

## Objective

Create a first-run onboarding flow for projektor.one that introduces the product as local-first architecture project management software and captures a local identity profile before opening the demo project cockpit.

## Scope

- First-run wizard rendered before the main app shell.
- Four supported UI languages: German, English, French, Spanish.
- Local identity profile with display name and email.
- Trust explanation for web-as-app-store and local-only data.
- Optional local data protection password state.
- Usage statistics consent for procurement reporting.
- Reset onboarding action in Settings.

## Non-Goals

- No real user account creation.
- No server login.
- No password hashing or encryption implementation in this static prototype.
- No telemetry upload.
- No production legal consent system.

## Flow

1. Identity
   - Ask: "How should the system address you?"
   - Ask for email: "Please enter your email so you can identify yourself securely."
   - Explain that email is an identity ID, not a login.
   - Require a non-empty name and a plausible email.

2. Web App Store And Local Data
   - Explain that the web is used as an app store.
   - Explain that data stays local on the user's machine and browser.
   - State that no project data is uploaded automatically.

3. Optional Password
   - Explain that the password protects local data only.
   - Password fields are optional.
   - If either password field is filled, require both fields to match.
   - Do not persist the entered password in the prototype.

4. Usage Statistics
   - Present an optional consent checkbox.
   - Explain that statistics support procurement and adoption reporting.
   - State that project content, documents, and mail bodies are not included.

5. Review And Start
   - Summarize local identity, password protection state, and statistics consent.
   - Persist profile and consent state to browser localStorage.
   - Open the main projektor.one cockpit.

## Prototype Data Model

- `projektor-profile-name`: local display name.
- `projektor-profile-email`: local identity email.
- `projektor-usage-stats`: boolean consent state.
- `projektor-password-enabled`: boolean state only; no password value stored.
- `projektor-onboarding-complete`: first-run completion marker.
- Existing `projektor-language` and `projektor-theme` remain `UISettings`-style preferences.

Future ONE.core implementation should map these to local profile/settings objects owned by reusable primitives from `../one`, especially `@refinio/settings.core`, `@refinio/one.models`, and `@refinio/trust.core` where sensible.

## Acceptance Criteria

- Fresh browser state shows onboarding before the main app.
- Name and email validation blocks an empty identity step.
- Optional password can be skipped.
- Password mismatch is shown as an inline onboarding error.
- Usage statistics can be accepted or declined.
- Completion hides onboarding and shows the existing app.
- Settings contains a reset onboarding action.
- Resetting onboarding returns to the first onboarding step.
- Language switching before completion re-renders onboarding copy in the selected language.
- No password text is saved to localStorage.
