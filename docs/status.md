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
| Google invites | Working | Firestore; who the user reached out to at each company, invite status, what they learned, and when to reach out again. Prefills Google Calendar invites and reminders the user sends from their own calendar; no Calendar API access |
| Apply from the shortlist | Working | Creates the application in Firestore |
| Chrome extension form filling and submit recording | Working | Loaded unpacked; Greenhouse, Lever, Workday, Ashby |
| Application tracker | Working | Firestore; shortlist and Gmail applications, timeline, review queue |
| Gmail connection and import | Working | Read-only OAuth, KMS-sealed tokens, past-year backfill, 15-minute sync, review queue; consent screen in Testing mode (7-day token expiry, test users only) |
| Resume studio (Google Docs) | Working | Resumes are Google Docs in an "Unhurried resumes" folder in the user's Drive (`drive.file` scope, KMS-sealed token); master resume chosen with Google Picker or created from a template; tailored copies per shortlisted role; find-and-replace edits; move to trash; records in Firestore |
| AI resume rewriting | Not built | No model is called; it would generate the edits the edit endpoint applies |
| Email job alerts | Working once SMTP is configured | After the daily scan (07:00 Central), job-search sends each user one email listing the new jobs that fit their search criteria; users opt in on the Alerts page. Sent through an SMTP relay (`smtp_host`, `smtp_username`, `smtp_password`); without one the emails are only logged. Preferences are in memory. SMS was removed |
| Interview scheduling | Partial | Proposes five free one-hour slots from busy times sent by the client; confirming creates a placeholder calendar ID; no Google Calendar API calls; in memory |
| Pub/Sub events | Not used | Topics exist; no service publishes or subscribes |

## Platform

| Area | Status |
| --- | --- |
| Production at https://unhurried-careers.com | Live; `www` redirects |
| Staging environment | Branches and configuration ready; project, OAuth client, reCAPTCHA key, and first apply pending; deploy jobs switched off |
| CI on every repository | Working |
| Deploys from `main` (services, web, Terraform) | Working, keyless |
| Firestore persistence | applications (including Google invites), inbox (Gmail), and resume |

## Known gaps

1. **In-memory stores** in job-search, notifications, and inbox interviews. Cloud Run scales to zero, so this data disappears after idle periods. The applications and resume stores (`internal/store` with Memory and Firestore implementations behind one interface) are the pattern to copy.
2. **Third-party credentials** for Adzuna and USAJobs are not configured; the placeholder secrets in Secret Manager have no values and are not wired to the services. The SMTP relay for alert emails is not configured yet either.
3. **AI tailoring** needs a model call (for example Vertex AI) that turns the job description and master resume into find-and-replace edits.
4. **Leftover files**: `unhurried-infra/cloudbuild.yaml` and `firestore.indexes.json` are not used.
5. **Security follow-ups** are listed in [Security → Known risks](security.md#known-risks-and-recommended-next-steps), notably turning off new signups, branch protection, Firestore rules, and a Content-Security-Policy.
