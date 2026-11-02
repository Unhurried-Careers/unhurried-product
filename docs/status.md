# Implementation status

What is fully working in production today, what is partial, and what is not built yet. Updated November 2026.

## Features

| Feature | Status | Notes |
| --- | --- | --- |
| Public homepage and Google sign-in | Working | Allowlisted accounts only; App Check enforced |
| Company watchlist | Working, not persisted | Reads Greenhouse, Lever, and Ashby public boards; data is held in memory by job-search and lost when its instance restarts |
| Saved searches and opportunities | Partial, not persisted | Adzuna and USAJobs are skipped until their API keys are configured; Greenhouse/Lever single-company search via environment variables; in memory |
| Shortlist, reasons, five-role limit | Working | Firestore |
| Outreach kit and contact tracker | Working | Firestore; LinkedIn searches are links the user opens, no scraping |
| Apply from the shortlist | Working | Creates the application in Firestore |
| Chrome extension form filling and submit recording | Working | Loaded unpacked; Greenhouse, Lever, Workday, Ashby |
| Application tracker | Working | Firestore; shortlist and Gmail applications, timeline, review queue |
| Gmail connection and import | Working | Read-only OAuth, KMS-sealed tokens, past-year backfill, 15-minute sync, review queue; consent screen in Testing mode (7-day token expiry, test users only) |
| Resume studio | Stubbed | Endpoints and records exist; Google Docs calls return placeholder document IDs, the tailoring prompt is built but no AI model is called; records are in memory |
| LinkedIn profile import | Partial | Stores pasted profile text (in memory) for tailoring; no LinkedIn API connection |
| Notifications (email, SMS) | Stubbed | Preferences saved in memory; messages are logged, not sent; no service calls `/internal/notify` yet |
| Interview scheduling | Partial | Proposes five free one-hour slots from busy times sent by the client; confirming creates a placeholder calendar ID; no Google Calendar API calls; in memory |
| Pub/Sub events | Not used | Topics exist; no service publishes or subscribes |

## Platform

| Area | Status |
| --- | --- |
| Production at https://unhurried-careers.com | Live; `www` redirects |
| Staging environment | Branches and configuration ready; project, OAuth client, reCAPTCHA key, and first apply pending; deploy jobs switched off |
| CI on every repository | Working |
| Deploys from `main` (services, web, Terraform) | Working, keyless |
| Firestore persistence | applications and inbox (Gmail) only |

## Known gaps

1. **In-memory stores** in job-search, resume, notifications, and inbox interviews. Cloud Run scales to zero, so this data disappears after idle periods. The applications store (`internal/store` with Memory and Firestore implementations behind one interface) is the pattern to copy.
2. **Third-party credentials** for Adzuna, USAJobs, and Twilio are not configured; the placeholder secrets in Secret Manager have no values and are not wired to the services.
3. **Google Docs and AI tailoring** need per-user Google OAuth (like Gmail, with the Docs/Drive scopes) and a model call (for example Vertex AI).
4. **Leftover files**: `unhurried-infra/cloudbuild.yaml` and `firestore.indexes.json` are not used.
5. **Security follow-ups** are listed in [Security → Known risks](security.md#known-risks-and-recommended-next-steps), notably turning off new signups, branch protection, Firestore rules, and a Content-Security-Policy.
