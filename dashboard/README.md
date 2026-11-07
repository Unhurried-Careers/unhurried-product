# Unhurried CI/CD Status Dashboard

A real-time observability dashboard for monitoring Continuous Integration (GitHub Actions) and Continuous Delivery (Google Cloud Build & Cloud Deploy) across all 10 repositories in the Unhurried project.

## Features

- **Global Health Overview**: Live health percentage, active pipeline tally, average pipeline runtime, and failure alerts.
- **Per-Service Pipeline Matrix**:
  - **Status badges** (`Passing`, `Failed`, `Running`)
  - **Commit information** (commit message, short SHA, branch, duration, relative timestamp)
  - **Deployment targets** (Cloud Run, Firebase Hosting, Terraform, Cloud Storage)
- **Deep Step Inspection**: Inspect individual job steps (`gofmt`, `go vet`, `go test -race`, `govulncheck`, `Docker smoke check`, `typecheck`, `spec-sync`) and execution statuses.
- **Historical Runs**: Review recent run history per repository with links to GitHub Actions.
- **Filter & Search**: Instant filter by service tier (*Backend Services*, *Frontend*, *Infrastructure*, *Shared Library*) or search by commit message, SHA, and service name.
- **Zero-Dependency Architecture**: Runs in any modern browser directly from disk or via a lightweight built-in Node.js server.

## Quick Start

### 1. View Directly in Your Browser (No Server Required)
Open `index.html` in your web browser:
```bash
# Windows
start unhurried-product/dashboard/index.html

# macOS
open unhurried-product/dashboard/index.html

# Linux
xdg-open unhurried-product/dashboard/index.html
```

### 2. Run Local Live Dashboard Server
To enable live `/api/status` and `/api/refresh` endpoints:
```bash
cd unhurried-product/dashboard
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Update the Status Snapshot
To re-fetch the latest pipeline runs across all repositories using the GitHub CLI:
```bash
npm run fetch
```

### 4. Run Test Suite
```bash
npm test
```

## Tracked Repositories

| Repository | Role | Tier | Target |
| :--- | :--- | :--- | :--- |
| `unhurried-job-search` | Direction, research & discovery | Backend | Cloud Run · Go 1.23 |
| `unhurried-resume` | Resume studio, Google Drive & Vertex AI | Backend | Cloud Run · Go 1.23 |
| `unhurried-applications` | Opportunity pipeline, outreach, conversations & rounds | Backend | Cloud Run · Go 1.23 |
| `unhurried-notifications` | Email posting digests via SMTP relay | Backend | Cloud Run · Go 1.23 |
| `unhurried-inbox` | Calendar interview detection & slot proposals | Backend | Cloud Run · Go 1.23 |
| `unhurried-common` | Shared Go library: auth, hardening, models | Library | Go Module · v0.1 |
| `unhurried-web` | TypeScript React frontend SPA | Frontend | Firebase Hosting · CDN |
| `unhurried-extension` | Chrome MV3 job application assistant | Frontend | Cloud Storage · Artifacts |
| `unhurried-infra` | Terraform GCP infrastructure & API specs | Infra | Terraform · GCP |
| `unhurried-product` | Architecture docs & CI/CD status dashboard | Product | Documentation |
