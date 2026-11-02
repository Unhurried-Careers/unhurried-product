# Unhurried

Job search, resume tailoring, application tracking, and interview scheduling — split into independent git repositories and deployed on Google Cloud managed services.

**Why:** AI auto-apply tools have flooded every role with applicants and left both job seekers and recruiters worse off. Unhurried uses AI the other way round: as a personal researcher that finds a small, curated set of roles worth pursuing deliberately, so candidates can apply to fewer places with real intent and fit. Read the full [motivation](MOTIVATION.md).

## How the app puts that into practice

| Motivation | Feature |
| --- | --- |
| Know which companies you want, and why, before roles are posted widely | **Watchlist**: each company needs a written reason; Unhurried reads its own Greenhouse, Lever, or Ashby board so new roles surface as soon as they are published |
| Select a small handful of roles and think critically about each | **Shortlist**: at most 5 active roles, each with a written "why this role" and "why this company"; applying is only possible from the shortlist |
| Find team members and learn about the role, culture, and day-to-day | **Outreach kit**: LinkedIn searches you open yourself, a 300-character note that asks to learn rather than for a referral, questions for the conversation, and a contact tracker |
| Keep track of the people you talk to and what you learn | **Conversations**: drafted messages asking people for a few minutes of their time; once they agree, your Google Calendar booking link or a request for them to send an invite. Grouped by company, with what you learned from each person and a queue of who to reach out to again |
| Customize materials intentionally | **Resume studio**: tailor a Google Doc to one shortlisted role with a chosen skill focus |

## Documentation

Full documentation is in [docs/](docs/README.md): [architecture](docs/architecture.md), [codebase guide](docs/codebase.md), [CI/CD](docs/ci-cd.md), [security](docs/security.md), and [implementation status](docs/status.md).

## Repositories

| Repo | Role |
| --- | --- |
| [unhurried-infra](https://github.com/Unhurried-Careers/unhurried-infra) | Terraform for GCP (API Gateway, Cloud Run, Firestore, Pub/Sub, Scheduler, Firebase Auth + Hosting) |
| [unhurried-common](https://github.com/Unhurried-Careers/unhurried-common) | Shared Go library (auth, HTTP hardening, validation, models) |
| [unhurried-job-search](https://github.com/Unhurried-Careers/unhurried-job-search) | Saved searches, job boards, and the company watchlist |
| [unhurried-resume](https://github.com/Unhurried-Careers/unhurried-resume) | Resume records and tailoring requests (Google Docs and AI not wired yet) |
| [unhurried-applications](https://github.com/Unhurried-Careers/unhurried-applications) | Shortlist, outreach kit, applications, Gmail imports, extension API |
| [unhurried-notifications](https://github.com/Unhurried-Careers/unhurried-notifications) | Email alerts for new jobs that match saved search criteria |
| [unhurried-inbox](https://github.com/Unhurried-Careers/unhurried-inbox) | Gmail connection and import, interview slot proposals |
| [unhurried-web](https://github.com/Unhurried-Careers/unhurried-web) | TypeScript React frontend (static, on Firebase Hosting) |
| [unhurried-extension](https://github.com/Unhurried-Careers/unhurried-extension) | Chrome MV3 apply assistant |

Each folder is its **own git repository** with `main` (production) and `staging` branches.

## Three tiers

1. **Frontend** — `unhurried-web` is a static single-page app on Firebase Hosting (global CDN): a public homepage at `/` and the signed-in app at `/app`. It and `unhurried-extension` call the HTTPS API Gateways.
2. **Backend** — five Go Cloud Run services, each fronted by its own API Gateway.
3. **Data** — Cloud Firestore (Native mode) plus Gmail as a read-only source system.

## Sign in

Users sign in with Google (Firebase Authentication / Identity Platform). API Gateway requires a valid Firebase ID token and the web app's API key (with per-minute quotas). Each Go service then re-verifies the token, requires a Firebase App Check token, and admits only the Google accounts in `allowed_emails`. Details are in `unhurried-infra/README.md` (API security) and `unhurried-web/README.md`.

## Local run (no GCP required)

Each Go service supports `STORE=memory` and listens on a dedicated port. `AUTH_DEV_BYPASS=true` replaces Google sign-in with `user:<id>` dev tokens (pair it with `VITE_AUTH_MODE=dev` in the web app). To use real Google sign-in locally, set `FIREBASE_PROJECT_ID` instead. From PowerShell:

```powershell
$env:AUTH_DEV_BYPASS = "true"
$env:STORE = "memory"
$env:PORT  = "8081"; go -C unhurried-job-search run ./cmd/server
$env:PORT  = "8082"; go -C unhurried-resume run ./cmd/server
$env:PORT  = "8083"; go -C unhurried-applications run ./cmd/server
$env:PORT  = "8084"; go -C unhurried-notifications run ./cmd/server
$env:PORT  = "8085"; go -C unhurried-inbox run ./cmd/server
cd unhurried-web; npm install; npm run dev
```

Copy `unhurried-web/.env.example` to `.env.local` and set `VITE_AUTH_MODE=dev` for this offline setup.

## Deploy

See `unhurried-infra/README.md`. `main` deploys to production (https://unhurried-careers.com) and `staging` to staging, from each repo's GitHub Actions pipeline: service images go to Artifact Registry and roll out to Cloud Run, the frontend is published to Firebase Hosting, and Terraform applies the infrastructure. Promote by merging `staging` into `main`.
