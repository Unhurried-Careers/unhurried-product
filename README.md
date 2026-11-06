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

## CI/CD Status Dashboard

<!-- CI_STATUS_START -->

## 🚀 Unhurried CI/CD Pipeline Status Dashboard

> **Global Status:** 🟡 **Workflows In Progress**  
> **Last Synchronized:** `Fri, 06 Nov 2026 23:57:34 GMT`  
> **Security Boundary:** Pure Continuous Integration (GitHub Actions) with `permissions: contents: read` · Zero Google Cloud secrets in GitHub

### 📊 Health & Reliability Summary

| Total Repositories | Tracked CI Pipelines | Passing on `main` | Success Rate | Average Runtime | Security Model |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **10** | **10** | **9 / 10** | **90%** | **1m 45s** | **Zero GCP Keys** |

### 🛠 Pipeline Matrix

| Status | Service | Role | Target | Branch | Commit | Duration | Workflow Run |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| 🟢 **Passing** | [**Job Search & Watchlist**](https://github.com/Unhurried-Careers/unhurried-job-search)<br/>`unhurried-job-search` | Saved searches, job boards, and company research & watchlist | `Cloud Run · Go 1.23` | `main` | [`190cfc6`](https://github.com/Unhurried-Careers/unhurried-job-search/commit/190cfc6268b63d9924696ef903b7adcadf1536ed) | 2m 36s | [Run #42238803220 ↗](https://github.com/Unhurried-Careers/unhurried-job-search/actions/runs/42238803220) |
| 🟢 **Passing** | [**Resume Studio**](https://github.com/Unhurried-Careers/unhurried-resume)<br/>`unhurried-resume` | Google Docs/Drive resume copies and Vertex AI tailoring | `Cloud Run · Go 1.23` | `main` | [`7b595ea`](https://github.com/Unhurried-Careers/unhurried-resume/commit/7b595eacd9367c865ddec34c78b5268b8705c1cc) | 3m 2s | [Run #42233936504 ↗](https://github.com/Unhurried-Careers/unhurried-resume/actions/runs/42233936504) |
| 🟢 **Passing** | [**Applications & Tracker**](https://github.com/Unhurried-Careers/unhurried-applications)<br/>`unhurried-applications` | Shortlist, outreach kit, conversations, application tracker & interview rounds | `Cloud Run · Go 1.23` | `main` | [`cedb85d`](https://github.com/Unhurried-Careers/unhurried-applications/commit/cedb85dd6b806a34d234efb2d756e2a38d11a13b) | 2m 37s | [Run #42233581262 ↗](https://github.com/Unhurried-Careers/unhurried-applications/actions/runs/42233581262) |
| 🟢 **Passing** | [**Notifications & Alerts**](https://github.com/Unhurried-Careers/unhurried-notifications)<br/>`unhurried-notifications` | Email job alerts for saved criteria matches via SMTP | `Cloud Run · Go 1.23` | `main` | [`87b9abe`](https://github.com/Unhurried-Careers/unhurried-notifications/commit/87b9abef7da73abfc761911f71939c17f97a1951) | 2m 50s | [Run #42233870118 ↗](https://github.com/Unhurried-Careers/unhurried-notifications/actions/runs/42233870118) |
| 🟢 **Passing** | [**Inbox & Calendar**](https://github.com/Unhurried-Careers/unhurried-inbox)<br/>`unhurried-inbox` | Google Calendar interview detection and slot proposals | `Cloud Run · Go 1.23` | `main` | [`5e71aa0`](https://github.com/Unhurried-Careers/unhurried-inbox/commit/5e71aa0819afd351ad62fc1692f587198fa47807) | 3m 10s | [Run #42233707878 ↗](https://github.com/Unhurried-Careers/unhurried-inbox/actions/runs/42233707878) |
| 🟢 **Passing** | [**Common Library**](https://github.com/Unhurried-Careers/unhurried-common)<br/>`unhurried-common` | Shared Go library: auth, HTTP hardening, validation, models | `Go Module · v0.1` | `main` | [`ea02c5e`](https://github.com/Unhurried-Careers/unhurried-common/commit/ea02c5e591fde10cc1f630ae2b91793986761c46) | 0m 31s | [Run #42148236340 ↗](https://github.com/Unhurried-Careers/unhurried-common/actions/runs/42148236340) |
| 🟢 **Passing** | [**Web App (SPA)**](https://github.com/Unhurried-Careers/unhurried-web)<br/>`unhurried-web` | TypeScript React frontend deployed to Firebase Hosting CDN | `Firebase Hosting · Global CDN` | `main` | [`c247aa7`](https://github.com/Unhurried-Careers/unhurried-web/commit/c247aa7eba511224895bfb00ab56a31493815e31) | 1m 11s | [Run #42239228746 ↗](https://github.com/Unhurried-Careers/unhurried-web/actions/runs/42239228746) |
| 🟢 **Passing** | [**Chrome Extension**](https://github.com/Unhurried-Careers/unhurried-extension)<br/>`unhurried-extension` | Chrome MV3 job application assistant | `Cloud Storage · Artifacts` | `main` | [`5da805b`](https://github.com/Unhurried-Careers/unhurried-extension/commit/5da805bb9cadb6b6b93707f0328f8ae43a4e610f) | 0m 21s | [Run #42233649823 ↗](https://github.com/Unhurried-Careers/unhurried-extension/actions/runs/42233649823) |
| 🟢 **Passing** | [**Infrastructure & Specs**](https://github.com/Unhurried-Careers/unhurried-infra)<br/>`unhurried-infra` | Terraform GCP infrastructure, API Gateway specs, and security rules | `Terraform · GCP Prod & Staging` | `main` | [`06ec0fc`](https://github.com/Unhurried-Careers/unhurried-infra/commit/06ec0fc21aa2997e0353969fe23d2fb97a0ad7df) | 1m 13s | [Run #42238491233 ↗](https://github.com/Unhurried-Careers/unhurried-infra/actions/runs/42238491233) |
| 🟡 **Running** | [**Product & Architecture**](https://github.com/Unhurried-Careers/unhurried-product)<br/>`unhurried-product` | System specifications, architecture guides, and CI/CD dashboard | `Documentation & Meta` | `main` | [`c0bf4c3`](https://github.com/Unhurried-Careers/unhurried-product/commit/c0bf4c31d7f2f4808a2755d081878a268ce69669) | 0m 3s | [Run #42315200792 ↗](https://github.com/Unhurried-Careers/unhurried-product/actions/runs/42315200792) |

### 🔍 Deep Step-by-Step CI Verifications

<details>
<summary><b>Job Search & Watchlist (unhurried-job-search)</b> — Latest Run #42238803220 (<code>190cfc6</code>) — <i>style: format research.go with gofmt</i></summary>

**Job:** `Lint and test` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Check out unhurried-job-search | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Check out unhurried-common | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| gofmt | ✓ `success` |
| go vet | ✓ `success` |
| go test | ✓ `success` |
| Coverage summary | ✓ `success` |
| Run actions/upload-artifact@v4 | ✓ `success` |
| govulncheck | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Check out unhurried-common | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Check out unhurried-job-search | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Build and smoke-test container image` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| docker build | ✓ `success` |
| Smoke test the image | ✓ `success` |
| Image refuses to start without auth config | ✓ `success` |
| govulncheck the shipped binary | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

</details>

<details>
<summary><b>Resume Studio (unhurried-resume)</b> — Latest Run #42233936504 (<code>7b595ea</code>) — <i>chore: update API version to v0.1</i></summary>

**Job:** `Lint and test` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Check out unhurried-resume | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Check out unhurried-common | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| gofmt | ✓ `success` |
| go vet | ✓ `success` |
| go test | ✓ `success` |
| Coverage summary | ✓ `success` |
| Run actions/upload-artifact@v4 | ✓ `success` |
| govulncheck | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Check out unhurried-common | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Check out unhurried-resume | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Build and smoke-test container image` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| docker build | ✓ `success` |
| Smoke test the image | ✓ `success` |
| Image refuses to start without auth config | ✓ `success` |
| govulncheck the shipped binary | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

</details>

<details>
<summary><b>Applications & Tracker (unhurried-applications)</b> — Latest Run #42233581262 (<code>cedb85d</code>) — <i>chore: remove legacy conversation normalization and update version to…</i></summary>

**Job:** `Lint and test` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Check out unhurried-applications | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Check out unhurried-common | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| gofmt | ✓ `success` |
| go vet | ✓ `success` |
| go test | ✓ `success` |
| Coverage summary | ✓ `success` |
| Run actions/upload-artifact@v4 | ✓ `success` |
| govulncheck | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Check out unhurried-common | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Check out unhurried-applications | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Build and smoke-test container image` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| docker build | ✓ `success` |
| Smoke test the image | ✓ `success` |
| Image refuses to start without auth config | ✓ `success` |
| govulncheck the shipped binary | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

</details>

<details>
<summary><b>Notifications & Alerts (unhurried-notifications)</b> — Latest Run #42233870118 (<code>87b9abe</code>) — <i>chore: update API version to v0.1</i></summary>

**Job:** `Lint and test` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Check out unhurried-notifications | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Check out unhurried-common | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| gofmt | ✓ `success` |
| go vet | ✓ `success` |
| go test | ✓ `success` |
| Coverage summary | ✓ `success` |
| Run actions/upload-artifact@v4 | ✓ `success` |
| govulncheck | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Check out unhurried-common | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Check out unhurried-notifications | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Build and smoke-test container image` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| docker build | ✓ `success` |
| Smoke test the image | ✓ `success` |
| Image refuses to start without auth config | ✓ `success` |
| govulncheck the shipped binary | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

</details>

<details>
<summary><b>Inbox & Calendar (unhurried-inbox)</b> — Latest Run #42233707878 (<code>5e71aa0</code>) — <i>chore: update API version to v0.1</i></summary>

**Job:** `Lint and test` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Check out unhurried-inbox | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Check out unhurried-common | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| gofmt | ✓ `success` |
| go vet | ✓ `success` |
| go test | ✓ `success` |
| Coverage summary | ✓ `success` |
| Run actions/upload-artifact@v4 | ✓ `success` |
| govulncheck | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Check out unhurried-common | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Check out unhurried-inbox | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Build and smoke-test container image` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-common | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| docker build | ✓ `success` |
| Smoke test the image | ✓ `success` |
| Image refuses to start without auth config | ✓ `success` |
| govulncheck the shipped binary | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-common | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

</details>

<details>
<summary><b>Common Library (unhurried-common)</b> — Latest Run #42148236340 (<code>ea02c5e</code>) — <i>Add UserEmail field to JobCriteria and JobDigest</i></summary>

**Job:** `Lint and test` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run actions/setup-go@v5 | ✓ `success` |
| gofmt | ✓ `success` |
| go vet | ✓ `success` |
| go test | ✓ `success` |
| Coverage summary | ✓ `success` |
| Run actions/upload-artifact@v4 | ✓ `success` |
| govulncheck | ✓ `success` |
| Post Run actions/setup-go@v5 | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

</details>

<details>
<summary><b>Web App (SPA) (unhurried-web)</b> — Latest Run #42239228746 (<code>c247aa7</code>) — <i>fix(web): typecheck alignment and status field in pursuit shortlist mock</i></summary>

**Job:** `Typecheck, test, build` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run actions/setup-node@v4 | ✓ `success` |
| Run npm ci | ✓ `success` |
| Typecheck | ✓ `success` |
| Unit tests with coverage thresholds | ✓ `success` |
| Coverage summary | ✓ `success` |
| Run actions/upload-artifact@v4 | ✓ `success` |
| Production build check | ✓ `success` |
| Audit runtime dependencies | ✓ `success` |
| Post Run actions/setup-node@v4 | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

</details>

<details>
<summary><b>Chrome Extension (unhurried-extension)</b> — Latest Run #42233649823 (<code>5da805b</code>) — <i>chore: update extension version to v0.1</i></summary>

**Job:** `Test and package` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run actions/setup-node@v4 | ✓ `success` |
| Run npm ci | ✓ `success` |
| Unit tests with coverage thresholds | ✓ `success` |
| Package extension | ✓ `success` |
| Run actions/upload-artifact@v4 | ✓ `success` |
| Post Run actions/setup-node@v4 | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

</details>

<details>
<summary><b>Infrastructure & Specs (unhurried-infra)</b> — Latest Run #42238491233 (<code>06ec0fc</code>) — <i>chore: sync gateway specs with company research endpoint</i></summary>

**Job:** `Checkov (informational)` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Pull ghcr.io/bridgecrewio/checkov:3.4.3 | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Checkov | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Lint gateway specs` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run actions/setup-node@v4 | ✓ `success` |
| Run npm ci | ✓ `success` |
| Run npm run check-specs | ✓ `success` |
| Post Run actions/setup-node@v4 | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Gateway specs match service repos (unhurried-job-search, job-search.yaml)` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-job-search | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Compare specs | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-job-search | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Terraform fmt, validate, test` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Run hashicorp/setup-terraform@v3 | ✓ `success` |
| Run mkdir -p "$TF_PLUGIN_CACHE_DIR" | ✓ `success` |
| terraform fmt | ✓ `success` |
| validate and test each module | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Gateway specs match service repos (unhurried-applications, applications.yaml)` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-applications | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Compare specs | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-applications | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Gateway specs match service repos (unhurried-notifications, notifications.yaml)` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-notifications | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Compare specs | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-notifications | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Gateway specs match service repos (unhurried-resume, resume.yaml)` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-resume | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Compare specs | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-resume | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

**Job:** `Gateway specs match service repos (unhurried-inbox, inbox.yaml)` (success)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Mint read-only token for unhurried-inbox | ✓ `success` |
| Run actions/checkout@v4 | ✓ `success` |
| Compare specs | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Post Mint read-only token for unhurried-inbox | ✓ `success` |
| Post Run actions/checkout@v4 | ✓ `success` |
| Complete job | ✓ `success` |

</details>

<details>
<summary><b>Product & Architecture (unhurried-product)</b> — Latest Run #42315200792 (<code>c0bf4c3</code>) — <i>CI/CD Pipeline Dashboard</i></summary>

**Job:** `Refresh Status & Generate Dashboard` (running)

| Step | Status |
| :--- | :---: |
| Set up job | ✓ `success` |
| Check out unhurried-product | ✓ `success` |
| Set up Node.js | ✓ `success` |
| Fetch pipeline statuses across all repositories | • `in_progress` |
| Validate dashboard test suite | • `pending` |
| Generate GitHub Step Summary & update README.md | • `pending` |
| Commit and push updated status matrix | • `pending` |
| Upload dashboard artifact | • `pending` |
| Setup Pages | • `pending` |
| Upload Pages artifact | • `pending` |
| Deploy to GitHub Pages | • `pending` |
| Post Set up Node.js | • `pending` |
| Post Check out unhurried-product | • `pending` |

</details>


<!-- CI_STATUS_END -->

Monitor real-time pipeline status, test runs, and deployment health across all 10 repositories via the [CI/CD Dashboard](dashboard/README.md):
- View directly on GitHub: Check the **[Actions Tab](https://github.com/Unhurried-Careers/unhurried-product/actions)** for live Step Summary dashboards.
- Open `dashboard/index.html` directly in your browser, or
- Start the live dashboard server: `cd dashboard && npm start` (runs on `http://localhost:3000`)
- Update the status snapshot anytime: `cd dashboard && npm run fetch`

## Repositories

| Repo | Role |
| --- | --- |
| [unhurried-infra](https://github.com/Unhurried-Careers/unhurried-infra) | Terraform for GCP (API Gateway, Cloud Run, Firestore, Pub/Sub, Scheduler, Firebase Auth + Hosting) |
| [unhurried-common](https://github.com/Unhurried-Careers/unhurried-common) | Shared Go library (auth, HTTP hardening, validation, models) |
| [unhurried-job-search](https://github.com/Unhurried-Careers/unhurried-job-search) | Saved searches, job boards, and the company watchlist |
| [unhurried-resume](https://github.com/Unhurried-Careers/unhurried-resume) | Resume records, Google Docs/Drive connection, and AI resume tailoring (Vertex AI) |
| [unhurried-applications](https://github.com/Unhurried-Careers/unhurried-applications) | Shortlist, outreach kit, conversations, application tracker, interview rounds, extension API |
| [unhurried-notifications](https://github.com/Unhurried-Careers/unhurried-notifications) | Email alerts for new jobs that match saved search criteria |
| [unhurried-inbox](https://github.com/Unhurried-Careers/unhurried-inbox) | Google Calendar interview discovery, interview slot proposals |
| [unhurried-web](https://github.com/Unhurried-Careers/unhurried-web) | TypeScript React frontend (static, on Firebase Hosting) |
| [unhurried-extension](https://github.com/Unhurried-Careers/unhurried-extension) | Chrome MV3 apply assistant |

Each folder is its **own git repository** with `main` (production) and `staging` branches.

## Three tiers

1. **Frontend** — `unhurried-web` is a static single-page app on Firebase Hosting (global CDN): a public homepage at `/` and the signed-in app at `/app`. It and `unhurried-extension` call the HTTPS API Gateways.
2. **Backend** — five Go Cloud Run services, each fronted by its own API Gateway.
3. **Data** — Cloud Firestore (Native mode), plus read-only Google Calendar (interviews) and Google Drive (resumes) connections.

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

See `unhurried-infra/README.md` and `docs/ci-cd.md`. GitHub Actions (`.github/workflows/ci.yml`) runs pure CI on every pull request and commit with zero Google Cloud credentials. Pushes to `main` (production, https://unhurried-careers.com) and `staging` run Continuous Delivery natively inside Google Cloud via **Cloud Build** and **Google Cloud Deploy**: service images go to Artifact Registry with verified SLSA provenance and roll out to Cloud Run with post-deploy health verification, the frontend is published to Firebase Hosting, and Terraform applies the infrastructure using Secret Manager. Promote by merging `staging` into `main`.
