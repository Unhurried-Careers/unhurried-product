# Unhurried documentation

Unhurried helps a job seeker pursue a small number of roles deliberately: watch the companies they care about, shortlist at most five roles with written reasons, reach out to people on the team, tailor a resume, apply with an assistant that never submits for them, and track every application in one place.

This folder is the reference for how the system is built, delivered, and secured. Start with the document that matches your question:

| Document | Read it to learn |
| --- | --- |
| [Architecture](architecture.md) | The three tiers, how a request travels from the browser to Firestore, the environments, and where each kind of data lives |
| [Codebase guide](codebase.md) | Every repository: layout, packages, API endpoints, configuration, local development, and tests |
| [CI/CD](ci-cd.md) | Branches and environments, GitHub Actions CI checks, Google Cloud Build & Cloud Deploy CD rollouts, least-privilege service accounts, secrets, and operational runbooks |
| [Security](security.md) | The threat model and every control, layer by layer: identity, API protection, service-to-service trust, data, secrets, Google Calendar and Drive, the extension, supply chain, and CI/CD |
| [Implementation status](status.md) | Which features are fully working, which are partial or stubbed, and the known gaps and risks |

The product reasoning behind the features is in [MOTIVATION.md](../MOTIVATION.md).

## At a glance

| | |
| --- | --- |
| Production | https://unhurried-careers.com (`main` branch), Google Cloud project `project-191091d4-b2e5-4294-9e7` |
| Staging | https://unhurried-careers-staging-web.web.app (`staging` branch), project not created yet |
| Frontend | React + TypeScript single-page app on Firebase Hosting |
| Backend | Five Go services on Cloud Run, each behind its own API Gateway |
| Data | Cloud Firestore (Native mode), Cloud KMS for Google Calendar and Google Drive tokens |
| Identity | Google sign-in through Firebase Authentication (Identity Platform), App Check with reCAPTCHA Enterprise |
| Infrastructure | Terraform, applied by Google Cloud Build |
| Source | 10 private repositories in the [Unhurried-Careers](https://github.com/Unhurried-Careers) GitHub organization |

## Glossary

| Term | Meaning |
| --- | --- |
| Watchlist | Companies the user follows, each with a written reason; their public job boards are checked for new roles |
| Shortlist / pursuit | A role the user decided to pursue, with "why this role" and "why this company"; at most five are active |
| Outreach kit | LinkedIn search links, a connection note, follow-up text, and questions for one shortlisted role |
| Application | A submitted (or about to be submitted) application, created from the shortlist or browser extension, with timeline events, interview rounds, and notes |
| ATS | Applicant tracking system: Greenhouse, Lever, Ashby, Workday, SmartRecruiters, iCIMS, Jobvite, Workable |
| Internal route | An endpoint under `/internal/*` that only Google-signed service identities can call; never published on API Gateway |
| Cloud Deploy | Google Cloud's managed continuous delivery service; rolls out verified SHA images to Cloud Run and supports approval gates and one-click rollbacks |
