# Implementation status

What is fully working in production today, what is partial, and what is not built yet. Updated November 2026.

## Features

| Feature | Status | Notes |
| --- | --- | --- |
| Public homepage and Google sign-in | Working | Allowlisted accounts only; App Check enforced |
| Start from a job | Working | The first page offers two ways in: search for open postings by role and location (read from company Greenhouse, Lever, and Ashby boards, including companies Gemini finds hiring; about 15 to 25 seconds), or paste a link to a posting (company, role, location, and description read from the page). The start page then matches or adds the company and role, with the user's reasons, and opens the opportunity. Coverage is limited to companies on those three boards until Adzuna or USAJobs keys are configured; links are fetched with SSRF protection |
| Direction | Working | Target companies and roles, each with a reason of at least 30 characters, plus must-haves and dealbreakers; Firestore (`directions`). The company name is a search box (Clearbit's free autocomplete and Wikidata); picking a company finds its Greenhouse, Lever, or Ashby board and an AI profile with sources and angles to look into. The role title is a search box too (a built-in list of common titles, ESCO, and Wikidata); picking a role fills in commonly requested skills as keywords and an AI profile with related titles and angles. The reason is always the user's own, and locations and remote preference are never filled in. Clearbit's endpoint is unofficial and free; search keeps working on Wikidata if it goes away |
| Research | Working | The user's notes and links per target, plus an AI summary from Gemini on Vertex AI with Google Search grounding and its sources, always labeled and kept apart; Firestore (`research`). Grounding is billed per request after a free daily allowance |
| Discovery | Partial | Reads each target company's own board (filtered to the target role titles) and searches each target role on the job boards; each posting says why it surfaced; Firestore (`postings`). Adzuna and USAJobs are skipped until their API keys are configured |
| Opportunity pipeline | Working | Consider, research, decide, tailor, apply, with a server-checked gate and the user's reason at every move; requirement checks with evidence; at most five decided or tailored at once; drop with a reason; timeline; Firestore (`opportunities`) |
| Outreach kit | Working | Per opportunity; LinkedIn searches are links the user opens, no scraping |
| Conversations | Working | Firestore; who the user asked for their time at each company, optionally linked to an opportunity, whether they agreed, the meeting time, what the user learned, and when to reach out again. Drafts the ask, then (once they agree) a message with the user's Google Calendar booking page or asking them to send an invite. The user sends every message; no Calendar API access |
| Chrome extension form filling and submit recording | Working | Loaded unpacked; lists the opportunities whose resume is ready; Greenhouse, Lever, Workday, Ashby; recording the submit moves the opportunity to applied. A manual apply can be confirmed (twice) in the web app instead |
| Interviews and outcome | Working | Firestore (`opportunity_rounds`); rounds for applied opportunities with interviews held and scheduled, skills to show and shown, learnings about the company, notes, and a prep checklist; "prepare for the next round" summary; outcome per opportunity |
| Google Calendar interviews | Working | Read-only OAuth, KMS-sealed tokens, events read live (past and next 60 days) and never stored; likely interviews matched to an applied opportunity and round for the user to confirm; consent screen in Testing mode (7-day token expiry, test users only) |
| Resume studio (Google Docs) | Working | Resumes are Google Docs in an "Unhurried resumes" folder in the user's Drive (`drive.file` scope, KMS-sealed token); master resume chosen with Google Picker (copied into the folder as "Master resume", the original untouched) or created from a template; a copy per opportunity from its Resume step; find-and-replace edits; move to trash; records in Firestore |
| AI resume rewriting | Working | Rewrites a resume copy for a job description using Gemini on Vertex AI, with the user's own reasons and requirement evidence as focus; strictly adheres to honesty rules (only rewords work already in the resume, never invents); previews proposed find-and-replace edits and requirements gaps before applying them directly to the Google Doc; maintains document formatting |
| Email posting digests | Working once SMTP is configured | After the daily discovery (07:00 Central), job-search sends each user one morning digest of new postings for their target companies and roles, each with why it surfaced; users opt in under Settings. Sent through an SMTP relay (`smtp_host`, `smtp_username`, `smtp_password`); without one the emails are safely logged to Cloud Run. Preferences are in Firestore (`notification_preferences`) |
| Interview scheduling | Partial | Proposes five free one-hour slots from busy times sent by the client; confirming creates a placeholder calendar ID; no Google Calendar API calls; slots stored in Firestore (`interviews`) |
| Pub/Sub events | Not used | Topics exist; no service publishes or subscribes |

## Platform

| Area | Status |
| --- | --- |
| Production at https://unhurried-careers.com | Live; `www` redirects |
| Staging environment | Branches and `envs/staging` ready; turns on automatically once the staging GCP project is created and applied |
| CI on every repository | GitHub Actions (`.github/workflows/ci.yml` on PRs, pushes & daily 06:00 UTC scans; zero GCP credentials) |
| Deploys from `main` (services, web, Terraform) | Google Cloud Build + Google Cloud Deploy (`cloudbuild.yaml`); all deployment secrets in GCP Secret Manager |
| Firestore persistence | All five backend services: applications (opportunities, conversations, interview rounds), resume, inbox (Google Calendar connections and interview proposals), job-search (directions, research, postings), and notifications (alert preferences) |

## Known gaps

1. **Third-party credentials** for Adzuna and USAJobs are not configured; the placeholder secrets in Secret Manager have no values and are not wired to the services.
2. **Security follow-ups** are listed in [Security → Known risks](security.md#known-risks-and-recommended-next-steps), notably enabling `require_deploy_approval = true` on production Cloud Deploy rollouts (or GitHub branch protection on `main`) and removing the unused placeholder secrets and Pub/Sub topics. Closed signups, deny-all Firestore rules, the Content-Security-Policy, split CI (GitHub Actions with zero GCP access) + CD (Google Cloud Build & Cloud Deploy), and the redirect to the custom domain are in place.
