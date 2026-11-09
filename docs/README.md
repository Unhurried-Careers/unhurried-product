# Unhurried documentation

Unhurried runs a job search as a deliberate process: the user decides which companies they want to work for and what kind of role they want, each with a written reason; researches them; discovers matching postings; and takes each opportunity through stages (consider, research, decide, tailor the resume, apply, interview), each of which needs the user's reason before it can move on. Applying uses an assistant that never submits for them.

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
| Staging | https://staging.unhurried-careers.com (`staging` branch), Google Cloud project `unhurried-staging` |
| Frontend | React + TypeScript single-page app on Firebase Hosting |
| Backend | Five Go services on Cloud Run, each behind its own API Gateway |
| Data | Cloud Firestore (Native mode), Cloud KMS for Google Calendar and Google Drive tokens |
| Identity | Google sign-in through Firebase Authentication (Identity Platform), App Check with reCAPTCHA Enterprise |
| Infrastructure | Terraform, applied by Google Cloud Build |
| Source | 10 private repositories in the [Unhurried-Careers](https://github.com/Unhurried-Careers) GitHub organization |

## Glossary

| Term | Meaning |
| --- | --- |
| Direction | What the user decided before looking at postings: target companies and roles, each with a written reason, and requirements |
| Requirement | A must-have every role needs, or a dealbreaker that rules one out; checked with evidence before deciding to apply |
| Research | The user's own notes and links on a target, kept apart from a labeled AI summary with sources |
| Posting | A job discovery found for one of the user's targets, with why it surfaced |
| Opportunity | One posting the user is working through the process, with its stage, the reason for every stage, checks, notes, resume, apply details, outcome, and timeline |
| Stage / gate | Considering, researching, decided, tailored, applied (or dropped). Each move is a gate the server checks; at most five opportunities are decided or tailored at once |
| Outreach kit | LinkedIn search links, a connection note, follow-up text, and questions for one opportunity |
| ATS | Applicant tracking system: Greenhouse, Lever, Ashby, Workday, SmartRecruiters, iCIMS, Jobvite, Workable |
| Internal route | An endpoint under `/internal/*` that only Google-signed service identities can call; never published on API Gateway |
| Cloud Deploy | Google Cloud's managed continuous delivery service; rolls out verified SHA images to Cloud Run and supports approval gates and one-click rollbacks |
