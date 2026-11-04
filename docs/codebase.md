# Codebase guide

The system is split into 10 repositories in the [Unhurried-Careers](https://github.com/Unhurried-Careers) organization. Locally they sit side by side in one `Unhurried/` folder, because the Go services import `unhurried-common` through a relative `replace github.com/unhurried/common => ../unhurried-common` in `go.mod`.

| Repository | Language | Purpose |
| --- | --- | --- |
| [unhurried-common](#unhurried-common) | Go | Shared library: auth, HTTP hardening, validation, models, IDs |
| [unhurried-job-search](#unhurried-job-search) | Go | Saved searches, job boards, company watchlist |
| [unhurried-resume](#unhurried-resume) | Go | Resumes as Google Docs in the user's Drive: master resume, tailored copies, edits |
| [unhurried-applications](#unhurried-applications) | Go | Shortlist, outreach kit, conversations, application tracker, interview rounds, extension API |
| [unhurried-notifications](#unhurried-notifications) | Go | Email alerts for new jobs that match the user's search criteria |
| [unhurried-inbox](#unhurried-inbox) | Go | Google Calendar interview discovery, interview slot proposals |
| [unhurried-web](#unhurried-web) | TypeScript | React single-page app |
| [unhurried-extension](#unhurried-extension) | JavaScript | Chrome apply assistant |
| [unhurried-infra](#unhurried-infra) | Terraform | All cloud resources, gateway specs, CI/CD identities |
| unhurried-product | Markdown | Product README, motivation, and this documentation |

## Conventions shared by the Go services

Every service has the same shape:

```
cmd/server/main.go        wiring: store selection, config, httpx.Serve
internal/api/             routes and handlers (one Server struct)
internal/store/           persistence (memory and, where implemented, Firestore)
internal/<domain>/        domain logic (boards, outreach, classify, mailsync, ...)
openapi.yaml              Swagger 2.0 spec for the service's API Gateway
Dockerfile                multi-stage build; context is the parent folder
.github/workflows/ci.yml  GitHub Actions CI (PRs, pushes, daily 06:00 UTC; zero GCP access)
cloudbuild.yaml           GCP CD: SLSA VERIFIED image push + Google Cloud Deploy release
```

- **Routing** uses Go 1.22+ `http.ServeMux` method patterns (`"POST /v1/pursuits/{id}/apply"`).
- **Middleware** is applied in `Routes()`: `httpx.CORS(httpx.Recover(httpx.Harden(httpx.AccessLog(auth.Middleware(mux)))))`.
- **Handlers** decode with `httpx.DecodeOrReject` (400 on bad JSON, 413 over 1 MiB), validate with `validate.Errors`, read the caller with `auth.FromContext`, and answer with `httpx.JSON`, `httpx.Error`, or `httpx.ServerError` (logs the cause, returns a generic message).
- **Ownership**: every user-facing lookup takes the caller's user ID; another user's record answers 404, not 403, so IDs cannot be probed.
- **Health**: `GET /health` (used by CI smoke tests and gateways) and `GET /healthz` (kept for local runs; Cloud Run reserves `/healthz`). Both skip auth.
- **Ports** locally: job-search 8081, resume 8082, applications 8083, notifications 8084, inbox 8085. Containers listen on `PORT=8080`.

### Common environment variables

Read by `unhurried-common/auth` and `httpx` in every service:

| Variable | Meaning |
| --- | --- |
| `AUTH_DEV_BYPASS=true` | Local only: accept `user:<id>` tokens, skip App Check and internal-caller checks |
| `FIREBASE_PROJECT_ID` / `PROJECT_ID` | Project whose Firebase ID tokens are accepted |
| `ALLOWED_EMAILS` | Comma-separated Google accounts allowed in; required, the service refuses to start without it |
| `APPCHECK_REQUIRED=true` + `FIREBASE_PROJECT_NUMBER` | Require a valid App Check token |
| `INTERNAL_AUDIENCE` | Audience expected on `/internal/*` OIDC tokens (`unhurried-internal`) |
| `INTERNAL_CALLERS` | Service accounts allowed on `/internal/*`; empty rejects all internal calls |
| `CORS_ALLOWED_ORIGINS` | Browser origins allowed; defaults to the local Vite server |
| `STORE=firestore` | Use Firestore where the service supports it (applications, inbox, resume) |
| `PORT` | Listen port |

Terraform sets all of these on Cloud Run (`envs/<env>/main.tf`, `local.commons`).

## unhurried-common

```
auth/auth.go        Guard, Middleware, FromEnv, Principal, request token extraction
auth/firebase.go    Firebase ID token verification
auth/appcheck.go    App Check token verification
auth/internal.go    Google OIDC verification for /internal/* callers
auth/allowlist.go   Wraps a verifier and admits only listed, verified emails
auth/jwt.go         RS256 verification, Google key fetching and caching
httpx/httpx.go      JSON helpers, CORS, Harden, Recover, AccessLog, Serve with timeouts
validate/           Field validation (Required, MaxLen, MinLen, OneOf, HTTPSURL, URLHost, Email, Range, List, Pattern)
models/models.go    Shared types: User, JobCriteria, Job, WatchedCompany, Pursuit, Contact, ResumeDoc, Application, ApplicationEvent, MailFinding, Interview, NotifyMessage, JobDigest
ids/ids.go          Random UUIDs
topics/topics.go    Pub/Sub topic names
```

**How auth decides** (`auth.Wrap`):

1. `/health`, `/healthz`, and `OPTIONS` pass through.
2. `/internal/*`: the `Authorization` bearer token must be a Google-signed OIDC token with issuer `accounts.google.com`, audience `INTERNAL_AUDIENCE`, a verified email in `INTERNAL_CALLERS`, and valid times.
3. Everything else: App Check (when required), then the Firebase ID token from `X-Forwarded-Authorization` (set by API Gateway) or `Authorization` (direct calls), then the allowlist. The principal (user ID, email, name) goes into the request context.

**Token verification** (`jwt.go`) implements RS256 by hand on the standard library: it accepts only `alg: RS256` with a key ID, fetches Google's public keys (x509 for Firebase, JWKS for App Check and OIDC), caches them for the `Cache-Control: max-age` Google returns, and checks `exp`/`iat` with one minute of clock skew. Firebase tokens additionally must have audience = project ID, issuer `https://securetoken.google.com/<project>`, a 1 to 128 character subject, and `auth_time` not in the future.

## unhurried-job-search

```
internal/api/       criteria, jobs, scans, watchlist handlers
internal/boards/    board clients: Adzuna, USAJobs, Greenhouse, Lever, Ashby
internal/store/     in-memory store
```

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /v1/criteria` | List or save search criteria (titles, locations, keywords, remote, minimum salary, boards) |
| `GET /v1/jobs` | Jobs found for the user, newest first |
| `POST /v1/scan` | Run the user's saved searches now |
| `GET/POST /v1/watchlist`, `DELETE /v1/watchlist/{id}` | Followed companies: name, written reason, ATS (`greenhouse`, `lever`, `ashby`), board token, title keywords; at most 50 per user |
| `POST /v1/scan/watchlist` | Check every watched company's public board now |
| `POST /internal/scan` | Scheduler entry point (daily at 07:00 Central); afterwards sends each user's new criteria matches to notifications to email |

Board clients only call fixed hosts (`boards-api.greenhouse.io`, `api.lever.co`, `api.ashbyhq.com`, Adzuna, USAJobs) with a 15-second timeout and a 10 MiB response cap. Board tokens must match `^[A-Za-z0-9._-]{1,100}$`, so user input cannot redirect requests elsewhere.

Configuration: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `USAJOBS_API_KEY`, `USAJOBS_EMAIL` (each board is skipped when unset), `GREENHOUSE_BOARD`, `LEVER_COMPANY` (single-company searches), `NOTIFICATIONS_INTERNAL_URL` (notifications Cloud Run URL; unset sends no alert emails).

## unhurried-resume

```
internal/api/        resume and Google Drive handlers; template.go is the from-scratch resume
internal/workspace/  OAuth (PKCE), sealed tokens, resume folder, master resume, copy, edit, trash
internal/gdocs/      minimal Drive v3 and Docs v1 REST client
internal/seal/       Cloud KMS sealer and a local AES-GCM sealer for development
internal/store/      Store interface; Memory and Firestore implementations
```

Resumes are Google Docs in an **"Unhurried resumes" folder in the user's own Google Drive**. The service uses the `drive.file` scope, so it can only see files it creates and the master resume the user chooses in Google Picker, never the rest of the Drive.

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/docs/status` | Connected account, folder link, master resume, whether a reconnect is needed |
| `POST /v1/docs/connect` | Start OAuth; returns Google's consent URL |
| `POST /v1/docs/callback` | Finish OAuth with `code` and `state`; creates the folder |
| `POST /v1/docs/disconnect` | Forget the connection; resumes stay in Drive |
| `POST /v1/docs/picker-token` | Short-lived `drive.file` access token and app ID for Google Picker |
| `PUT /v1/docs/master` | Record the Doc picked as the master resume (must be a Google Doc, not trashed) |
| `GET /v1/resumes` | The user's resumes, most recently updated first |
| `POST /v1/resumes/from-scratch` | Create a Doc from the template (name and email filled in); `asMaster` makes it the master |
| `POST /v1/resumes/from-master` | Copy the master for a role; named "Resume – Company – Role" |
| `POST /v1/resumes/{id}/edit` | Apply up to 20 find-and-replace edits to the Doc, keeping its formatting; returns how many places changed |
| `DELETE /v1/resumes/{id}` | Move the Doc to the user's Drive trash (recoverable for 30 days) and forget it |

**Folder**: created on connect, reused on reconnect with the same Google account, and recreated automatically if the user deletes or trashes it. **Errors**: a deleted document answers 410, a missing master 409, revoked access 409 with `needsReconnect`; other Google errors answer a generic 502.

Configuration: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (the same OAuth client and Secret Manager secret unhurried-google-oauth-client-secret as Google sign-in and Calendar), `DOCS_REDIRECT_URL` (`/app/docs/callback`), `KMS_KEY_NAME` (required with Firestore), `FIREBASE_PROJECT_NUMBER` (Picker app ID). Without a client ID the Docs routes answer 503.

AI rewriting is not built yet; it would produce the same find-and-replace edits the `edit` endpoint applies.
## unhurried-applications

```
internal/api/api.go              applications, rounds, tracking, extension endpoints
internal/api/conversations.go    conversations and booking link settings
internal/api/outreach.go         outreach kit and contacts
internal/api/rounds.go           interview rounds and interviews
internal/api/tracking.go         extension fill and tracking
internal/conversations/          conversation logic and validation
internal/outreach/               outreach kit text and LinkedIn search links
internal/rounds/                 round management, interviews, skills, and prep
internal/store/                  Store interface; Memory and Firestore implementations
```

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /v1/pursuits` | List (with active count and limit) or add a shortlisted role |
| `GET/PATCH /v1/pursuits/{id}` | Read with contacts, or edit reasons and status |
| `GET /v1/pursuits/{id}/outreach?name=` | Outreach kit |
| `POST /v1/pursuits/{id}/contacts`, `PATCH .../contacts/{contactId}` | Track people contacted (at most 20 per role; LinkedIn URLs must be on linkedin.com) |
| `POST /v1/pursuits/{id}/apply` | Create the application; the only way a user creates one |
| `GET/POST /v1/conversations` | Conversations, newest first / add one |
| `PATCH/DELETE /v1/conversations/{id}` | Update status, message, meeting time, learnings, or reach-out date / delete |
| `GET/PUT /v1/conversation-settings` | Booking page link and availability |
| `GET /v1/applications`, `GET /v1/applications/{id}` | Tracker list (most recent first) and detail with timeline and rounds |
| `PATCH /v1/applications/{id}` | Set the status, with an optional note |
| `GET /v1/applications/{id}/fill-payload` | Data the extension fills into a form |
| `POST /v1/applications/{id}/submit` | Record a submit; requires `confirmed: true` and an https page URL |
| `POST /v1/applications/{id}/tracking` | Save the employer portal URL, username, notes |
| `GET /v1/rounds` | All of the user's rounds |
| `POST /v1/applications/{id}/rounds` | Add a round |
| `PATCH/DELETE /v1/applications/{id}/rounds/{roundId}` | Update status, skills, learnings, notes, or prep / delete |
| `POST /v1/applications/{id}/rounds/{roundId}/interviews` | Add an interview, by hand or from Google Calendar |
| `DELETE /v1/applications/{id}/rounds/{roundId}/interviews/{interviewId}` | Remove an interview |

Rules the service enforces:

- **Shortlist**: at most `MAX_ACTIVE_PURSUITS` (default 5) active roles; `whyRole` and `whyCompany` at least 30 characters; one pursuit per job; applied roles cannot be edited.
- **Tracker**: status changes create an `ApplicationEvent` with source `you`. Rounds hold interview meetings, pre-round skills to show, post-round skills shown, company learnings, notes, and a prep checklist.

## unhurried-notifications

| Endpoint | Purpose |
| --- | --- |
```
internal/api/    preferences and delivery handlers
internal/mail/   SMTP sender (STARTTLS or implicit TLS) and the job digest email (text and HTML)
```

| Endpoint | Purpose |
| --- | --- |
| `GET/PUT /v1/preferences` | Alert email address and the email alerts switch (address required when on) |
| `POST /internal/job-digest` | Email one user the new jobs their criteria matched (job-search only; 1 to 100 jobs, up to 25 listed) |
| `POST /internal/notify` | Plain-text email to one user |

Emails go only to users who turned alerts on; responses report `sent`, `skipped`, or `logged`. Job fields are escaped in the HTML email and only https links are accepted. Configuration: `SMTP_HOST` (unset logs emails instead of sending), `SMTP_PORT` (default 587), `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM`, `APP_URL` (links in emails).

## unhurried-inbox

```
internal/api/api.go         interview slot proposals and server setup
internal/api/calendar.go    read-only Google Calendar endpoints
internal/cal/               interview slot proposal generation
internal/calsync/           OAuth (PKCE), sealing, and calendar sync service
internal/gcal/              Google Calendar REST client (events)
internal/seal/              Cloud KMS sealer and dev AES-GCM sealer
internal/store/             calendar connections and OAuth state: Memory and Firestore
```

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/calendar/status` | Read-only Google Calendar connection status and email |
| `POST /v1/calendar/connect` | Start OAuth; returns Google's consent URL |
| `POST /v1/calendar/callback` | Finish OAuth with `code` and `state` from the web callback page |
| `POST /v1/calendar/disconnect` | Revoke Google access and delete the connection |
| `GET /v1/calendar/events?from=&to=` | Timed events on primary calendar (default past and next 60 days), each flagged `likelyInterview` |
| `GET /v1/interviews`, `POST /v1/interviews/propose`, `POST /v1/interviews/{id}/confirm` | Propose five one-hour slots avoiding busy periods; confirming records a placeholder ID |

Configuration: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (from Secret Manager `unhurried-google-oauth-client-secret`), `CALENDAR_REDIRECT_URL` (`https://<site>/app/calendar/callback`), `KMS_KEY_NAME` (required with Firestore). Without a client ID the calendar routes answer 503.

## unhurried-web

```
src/main.tsx              mounts the app, installs the extension bridge
src/Root.tsx              routes: / (Home) and /app/* (App)
src/App.tsx               signed-in shell: navigation and pages
src/auth.tsx              auth context (Firebase or dev mode)
src/firebase.ts           Firebase app, Google provider, App Check, token helpers
src/api.ts                typed API clients; adds ID token, App Check token, API key
src/extensionBridge.ts    answers the extension's relayed requests
src/paths.ts              route constants
src/lib/boards.ts         detects ATS and board token from a careers URL
src/lib/picker.ts         loads Google Picker and lets the user choose the master resume
src/pages/                Home, SignIn, Jobs, Watchlist, Shortlist (with outreach), Criteria,
                          ResumeStudio, DocsCallback, Tracker, CalendarCallback, Interviews, Settings
firebase.json             Hosting: SPA rewrite, caching, security headers
.firebaserc               staging/production aliases and Hosting targets
```

| Route | Page |
| --- | --- |
| `/` | Public homepage; no API calls; Sign in / Open app at top right |
| `/app` | Opportunities (jobs found) |
| `/app/watchlist`, `/app/shortlist`, `/app/criteria`, `/app/resume` | Watchlist, shortlist and outreach, search criteria, resume studio |
| `/app/applications` | Tracker: calendar integration, interview rounds, notes, in-progress and closed applications |
| `/app/calendar/callback`, `/app/docs/callback` | Google returns here after Google Calendar or Drive consent; posts the code once (`OAuthCallback`), then returns to the tracker or resume studio |
| `/app/interviews`, `/app/alerts` | Interview slots, email alert settings |

Signed-out visitors to `/app/*` see the sign-in screen (popup with `prompt=select_account`). Build-time configuration is `VITE_*` variables (`.env.example`); deployed builds read them from the `unhurried-web-build-config` secret. `VITE_AUTH_MODE=dev` with `VITE_TOKEN=user:<id>` works against services running with `AUTH_DEV_BYPASS=true`.

## unhurried-extension

```
manifest.json   MV3: storage, activeTab, scripting; host access to the Unhurried web app only
content.js      form filler for Greenhouse, Lever, Workday, Ashby
bridge.js       content script on the Unhurried web app; relays requests to extensionBridge.ts
background.js   service worker: finds or opens an Unhurried tab, relays five operations
popup.html/js   choose the application, fill the page, record the submit, save portal details, settings
build.mjs       copies the files into dist/
```

The extension holds no tokens: requests go popup → background → `bridge.js` in a signed-in Unhurried tab → `window.postMessage` → `extensionBridge.ts`, which calls the API with the page's own credentials. The filler skips files, passwords, hidden fields, checkboxes, free-text questions, and fields the user already filled, and never submits.

## unhurried-infra

```
modules/service    Cloud Run service, its service account, API Gateway API/config/gateway, gateway invoker binding
modules/data       Firestore, Pub/Sub topics, Scheduler jobs, placeholder secrets, Artifact Registry
modules/auth       Firebase project, Identity Platform config, Google provider, web app, App Check
modules/hosting    Hosting site, custom domain and redirects, web deployer service account
modules/google_oauth Calendar API, key ring, calendar token key, OAuth client secret, inbox access
modules/docs       Drive, Docs, and Picker APIs, Drive token key, resume access to the OAuth secret
modules/cicd       Cloud Build 2nd-gen GitHub connection & CD triggers, Cloud Deploy pipelines, CD service accounts, web build config secret
envs/prod          Production root module (main), settings.auto.tfvars
envs/staging       Staging root module (staging), settings.auto.tfvars with placeholders
gateway-specs/     Copies of each service's openapi.yaml used by API Gateway
tools/             check-specs.mjs: gateway spec linter (see CI/CD)
```

Both environment folders contain identical `main.tf`, `variables.tf`, and `versions.tf`; only `settings.auto.tfvars` and the backend prefix differ. Sensitive inputs (`google_oauth_client_secret` and optional `smtp_password`) come from a gitignored `terraform.tfvars` locally or directly from Secret Manager inside Cloud Build.

## Local development

```powershell
$env:AUTH_DEV_BYPASS = "true"; $env:STORE = "memory"
$env:PORT = "8081"; go -C unhurried-job-search run ./cmd/server
$env:PORT = "8082"; go -C unhurried-resume run ./cmd/server
$env:PORT = "8083"; go -C unhurried-applications run ./cmd/server
$env:PORT = "8084"; go -C unhurried-notifications run ./cmd/server
$env:PORT = "8085"; go -C unhurried-inbox run ./cmd/server
cd unhurried-web; npm ci; npm run dev   # .env.local with VITE_AUTH_MODE=dev
```

Google Calendar works locally when `GOOGLE_OAUTH_CLIENT_ID`/`SECRET` and `CALENDAR_REDIRECT_URL=http://localhost:5173/app/calendar/callback` are set; connections then live in memory and tokens are sealed with a per-process key.

## Tests

| Repo | Command | What is covered |
| --- | --- | --- |
| Go services, common | `go test ./...` (CI adds `-race` and coverage) | Handlers through `httptest`, ownership scoping, validation, auth verifiers with test keys, board clients against local servers, Google Calendar OAuth and event sync against a fake Google, store contract (memory; Firestore when `FIRESTORE_EMULATOR_HOST` is set) |
| unhurried-web | `npm test`, `npm run test:coverage` | Pages, API client headers and paths, auth, Firebase config, Hosting config, extension bridge; thresholds 85% lines, 75% branches |
| unhurried-extension | `npm test`, `npm run test:coverage` | Filler, bridge, popup, background relay, manifest permissions; 90% line threshold |
| unhurried-infra | `terraform -chdir=<dir> test` | Every module and both environments with mocked providers: IAM bindings, deploy restrictions, key restrictions, internal audiences, custom domain wiring, Calendar wiring |
