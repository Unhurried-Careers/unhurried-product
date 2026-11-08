# Codebase guide

The system is split into 10 repositories in the [Unhurried-Careers](https://github.com/Unhurried-Careers) organization. Locally they sit side by side in one `Unhurried/` folder, because the Go services import `unhurried-common` through a relative `replace github.com/unhurried/common => ../unhurried-common` in `go.mod`.

| Repository | Language | Purpose |
| --- | --- | --- |
| [unhurried-common](#unhurried-common) | Go | Shared library: auth, HTTP hardening, validation, models, IDs |
| [unhurried-job-search](#unhurried-job-search) | Go | Direction (target companies, roles, requirements), research notes and AI summaries, discovery of postings |
| [unhurried-resume](#unhurried-resume) | Go | Resumes as Google Docs in the user's Drive: master resume, tailored copies per opportunity, edits |
| [unhurried-applications](#unhurried-applications) | Go | The opportunity pipeline and its gates, outreach kit, conversations, interview rounds, extension API |
| [unhurried-notifications](#unhurried-notifications) | Go | Email digests of new postings for the user's targets |
| [unhurried-inbox](#unhurried-inbox) | Go | Google Calendar interview discovery and the user's booking page |
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
internal/<domain>/        domain logic (boards, research, pipeline, outreach, rounds, ...)
openapi.yaml              Swagger 2.0 spec for the service's API Gateway
Dockerfile                multi-stage build; context is the parent folder
.github/workflows/ci.yml  GitHub Actions CI (PRs, pushes, daily 06:00 UTC; zero GCP access)
cloudbuild.yaml           GCP CD: SLSA VERIFIED image push + Google Cloud Deploy release
```

- **Routing** uses Go 1.22+ `http.ServeMux` method patterns (`"POST /v1/opportunities/{id}/advance"`).
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
| `STORE=firestore` | Use Firestore (supported across all five services: applications, inbox, resume, job-search, notifications) |
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
models/models.go    Shared types: Direction, TargetCompany, TargetRole, Requirement, Research, Source, Posting,
                    Opportunity (with its stages, outcomes, RequirementCheck, StageEvent), ResumeDoc,
                    JobDigest; MinReason (30 characters)
ids/ids.go          Random UUIDs
```

**How auth decides** (`auth.Wrap`):

1. `/health`, `/healthz`, and `OPTIONS` pass through.
2. `/internal/*`: the `Authorization` bearer token must be a Google-signed OIDC token with issuer `accounts.google.com`, audience `INTERNAL_AUDIENCE`, a verified email in `INTERNAL_CALLERS`, and valid times.
3. Everything else: App Check (when required), then the Firebase ID token from `X-Forwarded-Authorization` (set by API Gateway) or `Authorization` (direct calls), then the allowlist. The principal (user ID, email, name) goes into the request context.

**Token verification** (`jwt.go`) implements RS256 by hand on the standard library: it accepts only `alg: RS256` with a key ID, fetches Google's public keys (x509 for Firebase, JWKS for App Check and OIDC), caches them for the `Cache-Control: max-age` Google returns, and checks `exp`/`iat` with one minute of clock skew. Firebase tokens additionally must have audience = project ID, issuer `https://securetoken.google.com/<project>`, a 1 to 128 character subject, and `auth_time` not in the future.

## unhurried-job-search

```
internal/api/       direction, research, discovery and postings handlers, the scheduled scan
internal/boards/    board clients: Greenhouse, Lever, Ashby (per company) and Adzuna (per role)
internal/research/  plain-text summaries of a company, role, or posting, with sources
internal/companies/ company search (Clearbit autocomplete + Wikidata) and company lookup (board probes + AI profile)
internal/roles/     job title search (built-in list + ESCO + Wikidata) and role lookup (AI profile)
internal/jobs/      starting from a job: an SSRF-safe fetcher, reading a posting from its link, and searching company boards for open postings
internal/vertex/    Gemini on Vertex AI with Google Search grounding
internal/store/     Store interface; Memory and Firestore implementations (directions, research, postings)
```

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/jobs/search` | `{query, location}`: open postings for a role, every one read from a company's Greenhouse, Lever, or Ashby board: the user's target companies first, then companies Gemini with Google Search finds hiring for the role (trusted only to name companies), plus Adzuna when configured. Title words and location must match; at most 3 per company, 20 in all |
| `POST /v1/jobs/read` | `{url}`: a posting's title, company, location, and description, from the Greenhouse API, the page's schema.org `JobPosting` data, its title and site name, or Gemini for pages that only render in a browser. 400 for links that can't be fetched safely, 422 when no posting is found |
| `GET/PUT /v1/direction` | The user's target companies (name, why, careers URL, detected ATS and board token), target roles (title, why, keywords, locations, remote), and requirements (must-haves and dealbreakers). Every why needs at least 30 characters; at most 30 companies, 20 roles, 30 requirements. Items keep their IDs when sent back; new items get IDs here |
| `GET /v1/companies/search?q=` | Company suggestions as the user types (2 to 80 characters): Clearbit's free autocomplete and Wikidata entity search filtered to employers, asked at once with a 4-second limit, merged, cached 10 minutes; either directory may fail. Only the typed text is sent to them |
| `POST /v1/companies/profile` | `{name, domain}`: probes likely Greenhouse, Lever and Ashby board names, and asks Gemini with Google Search grounding for the website, careers page, industry, headquarters, size, a summary, and neutral angles to look into (never the user's reason). Answers `{website, careersUrl, ats, boardToken, openRoles, profile, aiError}`; the web app saves the profile on the company |
| `GET /v1/roles/search?q=` | Job title suggestions: a built-in list of common titles first, then ESCO occupations and Wikidata professions; every typed word must start a word of the title |
| `POST /v1/roles/profile` | `{title}`: Gemini with Google Search grounding describes the role (summary, up to 8 commonly requested skills, up to 5 related titles, neutral angles, sources). 503 without AI, 502 when the lookup fails |
| `GET /v1/research` | The user's research notes on their targets |
| `PUT /v1/research/{kind}/{id}` | Save the user's own notes and source links on a target company (`kind=company`) or role (`kind=role`); the target must be in the user's direction |
| `POST /v1/research/{kind}/{id}/summary` | Draft and store an AI summary of the target, with sources |
| `POST /v1/research/posting-summary` | Draft an AI summary of one posting for an opportunity's research stage (not stored here; the web app saves it on the opportunity) |
| `POST /v1/discover` | Look for postings now: each target company's own board (filtered to the target role titles), and each target role on the job boards. Answers how many were new, which boards failed, and any warning |
| `GET /v1/postings` | Postings found for the user, newest first; each says which target it matched and why (`matchedBecause`) |
| `POST /internal/scan` | Scheduler entry point (daily at 07:00 Central): discovery for every user with targets, then each user's new postings to notifications to email |

Postings are deduplicated per user by source and external ID. **AI summaries** describe and never recommend: the system prompt forbids writing the user's reasons, the answer is plain text, sources come from Google Search grounding (at most 10 unique https links), and a blocked or truncated answer is an error rather than a partial summary. Summaries time out after 50 seconds (the gateway allows 60) and answer 502 "AI summaries are unavailable; try again shortly". Without Vertex AI configured, the summary routes answer 503.

Board clients only call fixed hosts (`boards-api.greenhouse.io`, `api.lever.co`, `api.ashbyhq.com`, `api.adzuna.com`) with a 15-second timeout and a 10 MiB response cap. Board tokens must match `^[A-Za-z0-9._-]{1,100}$`, so user input cannot redirect requests elsewhere.

Configuration: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (Adzuna is skipped when unset), `ADZUNA_COUNTRY` (optional; otherwise Canada for Canadian locations and the US for the rest), `NOTIFICATIONS_INTERNAL_URL` (notifications Cloud Run URL; unset sends no alert emails), `VERTEX_PROJECT`, `VERTEX_LOCATION` (`global`), `VERTEX_MODEL` (`gemini-3.5-flash`), `VERTEX_ENABLED=false` (turns AI summaries off). Google Search grounding is billed per request after a free daily allowance.

## unhurried-resume

```
internal/api/        resume, Google Drive, and AI tailoring handlers; template.go is the from-scratch resume
internal/workspace/  OAuth (PKCE), sealed tokens, resume folder, master resume, copy, edit, trash
internal/gdocs/      minimal Drive v3 and Docs v1 REST client
internal/vertex/     Vertex AI Gemini 3.5 Flash client for resume tailoring
internal/seal/       Cloud KMS sealer and a local AES-GCM sealer for development
internal/store/      Store interface; Memory and Firestore implementations (resumes, docs_connections, docs_oauth_states)
```

Resumes are Google Docs in an **"Unhurried resumes" folder in the user's own Google Drive**. The service uses the `drive.file` scope, so it can only see files it creates and the master resume the user chooses in Google Picker, never the rest of the Drive.

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/docs/status` | Connected account, folder link, master resume, whether a reconnect is needed |
| `POST /v1/docs/connect` | Start OAuth; returns Google's consent URL |
| `POST /v1/docs/callback` | Finish OAuth with `code` and `state`; creates the folder |
| `POST /v1/docs/disconnect` | Forget the connection; resumes stay in Drive |
| `POST /v1/docs/picker-token` | Short-lived `drive.file` access token and app ID for Google Picker |
| `PUT /v1/docs/master` | Make the Doc picked in Google Picker the master resume (must be a Google Doc, not trashed): it is copied into the "Unhurried resumes" folder as "Master resume", leaving the original as it was; a Doc already in the folder is used as is, and a previous master copy is renamed "Master resume (replaced <date>)" |
| `GET /v1/resumes` | The user's resumes, most recently updated first |
| `POST /v1/resumes/from-scratch` | Create a Doc from the template (name and email filled in); `asMaster` makes it the master |
| `POST /v1/resumes/from-master` | Copy the master for a role; named "Resume – Company – Role"; `opportunityId` links the copy to an opportunity |
| `POST /v1/resumes/{id}/tailor` | Tailor a resume copy for a job description using Vertex AI (Gemini 3.5 Flash); optional `reasons` (the user's own why and requirement evidence, up to 4,000 characters) steer what it emphasizes; analyzes gaps, enforces honesty rules, and proposes find-and-replace edits |
| `POST /v1/resumes/{id}/edit` | Apply up to 20 find-and-replace edits to the Doc, keeping its formatting; returns how many places changed |
| `DELETE /v1/resumes/{id}` | Move the Doc to the user's Drive trash (recoverable for 30 days) and forget it |

**Folder**: created on connect, reused on reconnect with the same Google account, and recreated automatically if the user deletes or trashes it. **Errors**: a deleted document answers 410, a missing master 409, revoked access 409 with `needsReconnect`; other Google errors answer a generic 502.

Configuration: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (the same OAuth client and Secret Manager secret unhurried-google-oauth-client-secret as Google sign-in and Calendar), `DOCS_REDIRECT_URL` (`/app/docs/callback`), `KMS_KEY_NAME` (required with Firestore), `FIREBASE_PROJECT_NUMBER` (Picker app ID), `VERTEX_PROJECT`, `VERTEX_LOCATION` (`global`), `VERTEX_MODEL` (`gemini-3.5-flash`). Without a client ID the Docs routes answer 503.

AI resume tailoring uses Google Cloud Vertex AI (Gemini 3.5 Flash) via `POST /v1/resumes/{id}/tailor`. It compares the existing Google Doc resume with the target job description under strict honesty rules (never inventing facts, skills, or employment history). The user's reasons are passed in their own delimited block as data, used only to choose what to bring forward; every fact must still come from the resume. It returns a match score, gaps analysis, and exact find-and-replace text diffs that the user reviews and applies directly to their Google Doc via `POST /v1/resumes/{id}/edit`.
## unhurried-applications

```
internal/api/opportunities.go    the opportunity pipeline, drop, outreach kit, extension fill/submit/tracking
internal/api/conversations.go    conversations and booking link settings
internal/api/rounds.go           interview rounds and interviews (only after applying)
internal/pipeline/               the stage gates, as pure functions
internal/conversations/          conversation logic and validation
internal/outreach/               outreach kit text and LinkedIn search links
internal/rounds/                 round management, interviews, skills, and prep
internal/store/                  Store interface; Memory and Firestore implementations
                                 (opportunities, conversations, conversation_settings, opportunity_rounds)
```

An **opportunity** is one posting the user is working through the process. It keeps a snapshot of the posting, its stage, the reason written at every stage, requirement checks with evidence, research notes, a labeled AI summary, the linked resume, apply details, the outcome, and a timeline (at most 100 entries).

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/opportunities` | All of them, most recently updated first, each with `nextStage` and what it still needs (`nextNeeds`); plus `committed` and `maxCommitted` |
| `POST /v1/opportunities` | Start considering a posting: needs `whyThisPosting` and a target company or role; one open opportunity per posting |
| `GET/PATCH /v1/opportunities/{id}` | Read, or save notes and reasons; reasons lock once applied or dropped; `outcome` only after applying |
| `POST /v1/opportunities/{id}/advance` | `{to, confirmed, ...stage fields}`: saves the fields, then moves one stage forward if the gate is met. A refused move still keeps the fields and answers 422 with `{error, missing[]}` |
| `POST /v1/opportunities/{id}/drop` | `{reason}` (at least 30 characters); not after applying |
| `GET /v1/opportunities/{id}/outreach?name=` | Outreach kit: LinkedIn searches, a note asking to learn, a follow-up, questions |
| `GET /v1/opportunities/{id}/fill-payload` | Data the extension fills into a form; only once the resume is ready (stage `tailored`) |
| `POST /v1/opportunities/{id}/submit` | Record a submit from the extension; requires `confirmed: true` and an https page URL; moves it to applied |
| `POST /v1/opportunities/{id}/tracking` | Save the employer portal URL, username, notes |
| `GET/POST /v1/conversations` | Conversations, newest first / add one, optionally linked to an opportunity (`opportunityId`) |
| `PATCH/DELETE /v1/conversations/{id}` | Update status, message, meeting time, learnings, or reach-out date / delete |
| `GET/PUT /v1/conversation-settings` | Booking page link and availability |
| `GET /v1/rounds` | All of the user's rounds |
| `POST /v1/opportunities/{id}/rounds` | Add a round; the opportunity must be applied |
| `PATCH/DELETE /v1/opportunities/{id}/rounds/{roundId}` | Update status, skills, learnings, notes, or prep / delete |
| `POST /v1/opportunities/{id}/rounds/{roundId}/interviews` | Add an interview, by hand or from Google Calendar |
| `DELETE /v1/opportunities/{id}/rounds/{roundId}/interviews/{interviewId}` | Remove an interview |

**Gates** (`internal/pipeline`), each checked by the server when moving to the stage:

| Moving to | Needs |
| --- | --- |
| `considering` (on create) | `whyThisPosting` (at least 30 characters) and a target company or role |
| `researching` | `whyThisPosting` |
| `decided` | Company notes and role notes (at least 30 characters each); a check for the user's requirements, every must-have met and every dealbreaker absent, each with evidence (at least 10 characters); `whyRole` and `whyCompany` (at least 30 characters each); fewer than `MAX_ACTIVE_OPPORTUNITIES` (default 5) already decided or tailored |
| `tailored` | A linked resume and `resumeEmphasis`: what it emphasizes for this role and why (at least 30 characters) |
| `applied` | A submit recorded by the extension, or `confirmed: true` for a manual apply (the web app asks twice) |

Moves go one stage forward at a time; moving back is allowed until applied. Dropping keeps the reason and the stage it was dropped from; to restart, the user considers the posting again.

## unhurried-notifications

```
internal/api/    preferences and delivery handlers
internal/mail/   SMTP sender (STARTTLS or implicit TLS) and the job digest email (text and HTML)
internal/store/  Store interface; Memory and Firestore implementations (notification_preferences)
```

| Endpoint | Purpose |
| --- | --- |
| `GET/PUT /v1/preferences` | Alert email address and the email alerts switch (address required when on) |
| `POST /internal/job-digest` | Email one user the new postings for their target companies and roles, each with why it surfaced (job-search only; 1 to 100 postings, up to 25 listed) |

Emails go only to users who turned alerts on; responses report `sent`, `skipped`, or `logged`. Job fields are escaped in the HTML email and only https links are accepted. Configuration: `SMTP_HOST` (default `smtp.resend.com`; unset logs emails instead of sending), `SMTP_PORT` (default 587), `SMTP_USERNAME` (`resend`), `SMTP_PASSWORD` (from Secret Manager `unhurried-smtp-password`), `MAIL_FROM` (`Unhurried <alerts@unhurried-careers.com>`), `APP_URL` (links in emails).

## unhurried-inbox

```
internal/api/api.go         routes and server setup
internal/api/calendar.go    read-only Google Calendar endpoints
internal/calsync/           OAuth (PKCE), sealing, and calendar sync service
internal/gcal/              Google Calendar REST client (events)
internal/seal/              Cloud KMS sealer and dev AES-GCM sealer
internal/store/             Store interface; Memory and Firestore implementations (calendar_connections, calendar_oauth_states)
```

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/calendar/status` | Read-only Google Calendar connection status and email |
| `POST /v1/calendar/connect` | Start OAuth; returns Google's consent URL |
| `POST /v1/calendar/callback` | Finish OAuth with `code` and `state` from the web callback page |
| `POST /v1/calendar/disconnect` | Delete the connection and its sealed token (Google access is not revoked, so Drive keeps working) |
| `GET /v1/calendar/events?from=&to=` | Timed events on primary calendar (default past and next 60 days), each flagged `likelyInterview` |
| `POST /v1/calendar/retrieve-appointment` | Look again for the user's appointment booking page, used in outreach messages |

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
src/lib/pipeline.ts       stage labels, which steps are open and done, requirement checks, tailoring reasons
src/lib/interviews.ts     calendar interview suggestions and round progress
src/lib/picker.ts         loads Google Picker and lets the user choose the master resume
src/pages/                Home, SignIn, Pipeline, Direction, Research, Discover, Opportunity (the stepper),
                          Conversations, ResumeStudio, Interviews, Rounds, Settings, OAuth callbacks;
                          parts.tsx holds the reason field, AI summary panel, and "still needed" list
firebase.json             Hosting: SPA rewrite, caching, security headers
.firebaserc               staging/production aliases and Hosting targets
```

| Route | Page |
| --- | --- |
| `/` | Public homepage; no API calls; Sign in / Open app at top right |
| `/app` | Start from a job (search for open postings, or paste a link to one), then the pipeline: opportunities grouped by stage, each with what it needs next |
| `/app/start` | From a found job: match its company and role to the direction or add them with the user's reasons, say why this posting, and open the opportunity |
| `/app/direction` | Target companies and roles (each found with a search box and filled in by a lookup) and requirements, each company and role with the user's own reason |
| `/app/research` | The user's notes and links per target, next to a labeled AI summary with sources |
| `/app/discover` | Look for postings; each says why it surfaced; considering one needs a reason |
| `/app/opportunities/:id` | The stepper: Consider, Research, Decide, Resume, Apply, Interviews (`?step=` opens one); drop with a reason; timeline |
| `/app/conversations`, `/app/resume` | Conversations (`?opportunity=` links a new one), resume studio (master resume and all copies) |
| `/app/interviews` | Calendar integration, interviews on the calendar to file into rounds, progress per applied opportunity |
| `/app/calendar/callback`, `/app/docs/callback` | Google returns here after Google Calendar or Drive consent; posts the code once (`OAuthCallback`), then returns to Interviews or the resume studio |
| `/app/settings` | Google Drive, Google Calendar, booking link, email alerts |

Signed-out visitors to `/app/*` see the sign-in screen (popup with `prompt=select_account`). Build-time configuration is `VITE_*` variables (`.env.example`); deployed builds read them from the `unhurried-web-build-config` secret. `VITE_AUTH_MODE=dev` with `VITE_TOKEN=user:<id>` works against services running with `AUTH_DEV_BYPASS=true`.

## unhurried-extension

```
manifest.json   MV3: storage, activeTab, scripting; host access to the Unhurried web app only
content.js      form filler for Greenhouse, Lever, Workday, Ashby
bridge.js       content script on the Unhurried web app; relays requests to extensionBridge.ts
background.js   service worker: finds or opens an Unhurried tab, relays five operations
                (status, listReady, fillPayload, recordSubmit, saveTracking)
popup.html/js   choose an opportunity that is ready to apply, open its tailored resume, fill the page,
                record the submit, save portal details, settings
build.mjs       copies the files into dist/
```

The extension holds no tokens: requests go popup → background → `bridge.js` in a signed-in Unhurried tab → `window.postMessage` → `extensionBridge.ts`, which calls the API with the page's own credentials. The filler skips files, passwords, hidden fields, checkboxes, free-text questions, and fields the user already filled, and never submits.

## unhurried-infra

```
modules/service    Cloud Run service, its service account, API Gateway API/config/gateway, gateway invoker binding
modules/data       Firestore, the discovery Scheduler job, Adzuna secrets, Artifact Registry
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
| Go services, common | `go test ./...` (CI adds `-race` and coverage) | Handlers through `httptest`, ownership scoping, validation, every pipeline gate as table tests, the decided-opportunity limit, discovery and AI summaries with fake boards and a fake Gemini, auth verifiers with test keys, board clients against local servers, Google Calendar OAuth and event sync against a fake Google, store contract (memory; Firestore when `FIRESTORE_EMULATOR_HOST` is set) |
| unhurried-web | `npm test`, `npm run test:coverage` | Each stage form, the gate messages and the stepper, pages, API client headers and paths, auth, Firebase config, Hosting config, extension bridge; thresholds 85% lines, 75% branches |
| unhurried-extension | `npm test`, `npm run test:coverage` | Filler, bridge, popup, background relay, manifest permissions; 90% line threshold |
| unhurried-infra | `terraform -chdir=<dir> test` | Every module and both environments with mocked providers: IAM bindings, deploy restrictions, key restrictions, internal audiences, custom domain wiring, Calendar wiring, Vertex AI grants for resume and job-search |
