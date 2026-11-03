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
| Conversations | Working | Firestore; who the user asked for their time at each company, whether they agreed, the meeting time, what the user learned, and when to reach out again. Drafts the ask, then (once they agree) a message with the user's Google Calendar booking page or asking them to send an invite. The user sends every message; no Calendar API access |
| Apply from the shortlist | Working | Creates the application in Firestore |
| Chrome extension form filling and submit recording | Working | Loaded unpacked; Greenhouse, Lever, Workday, Ashby |
| Application tracker | Working | Firestore; the user sets each status; timeline; interview rounds with interviews held and scheduled, skills to show and shown, learnings about the company, notes, and a prep checklist; "prepare for the next round" summary |
| Google Calendar interviews | Working | Read-only OAuth, KMS-sealed tokens, events read live (past and next 60 days) and never stored; likely interviews matched to an application and round for the user to confirm; consent screen in Testing mode (7-day token expiry, test users only) |
| Gmail connection and import | Removed | Applications imported earlier remain and can be removed from the tracker; old `gmail_connections` documents should be deleted |
| Resume studio (Google Docs) | Working | Resumes are Google Docs in an "Unhurried resumes" folder in the user's Drive (`drive.file` scope, KMS-sealed token); master resume chosen with Google Picker or created from a template; tailored copies per shortlisted role; find-and-replace edits; move to trash; records in Firestore |
| AI resume rewriting | Not built | No model is called; it would generate the edits the edit endpoint applies |
| Email job alerts | Working once SMTP is configured | After the daily scan (07:00 Central), job-search sends each user one email listing the new jobs that fit their search criteria; users opt in on the Alerts page. Sent through an SMTP relay (`smtp_host`, `smtp_username`, `smtp_password`); without one the emails are only logged. Preferences are in memory. SMS was removed |
| Interview scheduling | Partial | Proposes five free one-hour slots from busy times sent by the client; confirming creates a placeholder calendar ID; no Google Calendar API calls; in memory |
| Pub/Sub events | Not used | Topics exist; no service publishes or subscribes |

## Platform

| Area | Status |
| --- | --- |
| Production at https://unhurried-careers.com | Live; `www` redirects |
| Staging environment | Branches and `envs/staging` ready; turns on automatically once the staging GCP project is created and applied |
| CI on every repository | Google Cloud Build (`cloudbuild-ci.yaml` on PRs & daily 06:00 scans) |
| Deploys from `main` (services, web, Terraform) | Google Cloud Build + Google Cloud Deploy, zero GitHub secrets |
| Firestore persistence | applications (including Conversations and interview rounds), inbox (Google Calendar connections), and resume |

## Known gaps

1. **In-memory stores** in job-search, notifications, and inbox interviews. Cloud Run scales to zero, so this data disappears after idle periods. The applications and resume stores (`internal/store` with Memory and Firestore implementations behind one interface) are the pattern to copy.
2. **Third-party credentials** for Adzuna and USAJobs are not configured; the placeholder secrets in Secret Manager have no values and are not wired to the services. The SMTP relay for alert emails is not configured yet either.
3. **AI tailoring** needs a model call (for example Vertex AI) that turns the job description and master resume into find-and-replace edits.
4. **Security follow-ups** are listed in [Security → Known risks](security.md#known-risks-and-recommended-next-steps), notably enabling `require_deploy_approval = true` on production Cloud Deploy rollouts (or GitHub branch protection on `main`) and removing the unused placeholder secrets and Pub/Sub topics. Closed signups, deny-all Firestore rules, the Content-Security-Policy, GCP-native CI/CD with zero GitHub secrets, and the redirect to the custom domain are in place.
