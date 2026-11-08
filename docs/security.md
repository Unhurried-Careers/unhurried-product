# Security

This document lists every security control in Unhurried, where it is implemented, and what it protects against. Known weaknesses are collected at the end so they are not mistaken for controls.

## What is being protected

| Asset | Why it matters |
| --- | --- |
| The user's job search data | Their direction and reasons, research notes, opportunities, conversations, and resume content are personal and career-sensitive |
| Google Calendar access | A refresh token with `calendar.events.readonly` can read every event on the user's calendars |
| Google Drive access | A refresh token with `drive.file` can read and change the resumes Unhurried created |
| The Google Cloud projects | Owner-level access means control of all data and billing |
| Deployment credentials | Whoever can deploy can change what runs in production |
| OAuth client secret | Lets its holder impersonate the app in Google's OAuth flows |

## Threat model

| Threat | Main controls |
| --- | --- |
| A stranger uses the app or its APIs | Google sign-in, email allowlist, signup switch, API key, App Check |
| Scripted or abusive traffic | API key with per-minute quotas, App Check, body and header limits, server timeouts |
| One user reads another's data | Every query scoped to the token's user ID; foreign IDs answer 404 |
| Calls that skip API Gateway | Cloud Run IAM: only the gateway's service account (and listed internal callers) may invoke |
| Forged internal calls | `/internal/*` not on the gateway; Google OIDC tokens with a fixed audience and an explicit caller list |
| Stolen database contents | Calendar and Drive tokens sealed with Cloud KMS and bound to the user; calendar events not stored |
| Compromised CI or repository | GitHub Actions runs pure CI (`contents: read`, zero GCP credentials); all CD runs natively in Google Cloud Build + Cloud Deploy under least-privilege service accounts |
| Vulnerable dependencies or base images | govulncheck (source and binary), npm audit, distroless non-root images |
| Malicious job sites or pages | Extension never submits, relays only five operations from its own popup, holds no tokens |
| Clickjacking and content sniffing | Hosting security headers, API `nosniff` and `no-store` |

## Identity and sign-in

- **Google is the only sign-in method.** Identity Platform has email/password and phone sign-in disabled, and multi-tenancy off (`modules/auth`).
- **Allowlist.** Every service admits only the verified Google accounts in `ALLOWED_EMAILS` (from `allowed_emails` in Terraform); others get 403 even with a valid token. Services refuse to start if the list is empty.
- **Signup switch.** `allow_new_signups = false` makes Identity Platform refuse to create any new user; user deletion through the client API is disabled. Production has signups closed; staging leaves them open until its owner signs in once.
- **Authorized domains.** Sign-in only works from `localhost`, the Hosting domains, and the custom domain.
- **Account picker.** The Google provider uses `prompt=select_account`, so a shared browser does not silently reuse another account.

## API protection, layer by layer

### 1. API Gateway (one per service)

Each service's `openapi.yaml` (linted in CI by `tools/check-specs.mjs`) requires, on every operation except `OPTIONS` preflights and `/health`:

- **A Firebase ID token** for this project: the gateway checks its signature against Google's keys, issuer `https://securetoken.google.com/<project>`, and audience `<project>`.
- **The browser API key** in `x-api-key`. The key (`google_apikeys_key.web`) only works from the site's own domains (HTTP referrer restriction) and only against the five Unhurried gateways (API target restriction).
- **A quota**: 300 requests per minute per service, charged to the API key.

`/internal/*` paths are never published on a gateway, so they return 404 there.

### 2. Cloud Run

- **Invocation is IAM-only.** Each service's only `roles/run.invoker` grants are its gateway's service account and, for internal routes, the specific Scheduler or job-search accounts. Unauthenticated direct calls get 403 from Google before reaching the code.
- **Each service runs as its own service account** with only what it needs (Firestore user; the inbox additionally gets the KMS key and the OAuth secret).

### 3. Service middleware (`unhurried-common`)

| Control | Implementation |
| --- | --- |
| CORS | Only origins in `CORS_ALLOWED_ORIGINS` (the site's domains) get CORS headers; other preflights get 403 |
| App Check | When `APPCHECK_REQUIRED=true`: the `X-Firebase-AppCheck` token must be RS256-signed by Firebase App Check, issuer `https://firebaseappcheck.googleapis.com/<project number>`, audience `projects/<project number>`, unexpired. The web app obtains tokens from reCAPTCHA Enterprise |
| ID token re-verification | The service verifies the Firebase token itself (from `X-Forwarded-Authorization`, where the gateway moves it): RS256 only, known key ID, signature, audience, issuer, subject length, `auth_time`, `exp`/`iat` with one minute of skew. The gateway check is not trusted alone |
| Allowlist | Verified email must be in `ALLOWED_EMAILS` |
| Body limit | 1 MiB (`http.MaxBytesReader`); larger bodies get 413 |
| Server limits | Read-header 10 s, read 30 s, write 60 s, idle 120 s, headers 64 KiB |
| Response headers | `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` |
| Errors | `ServerError` logs the real cause and returns a generic message, so upstream URLs and responses are not leaked; panics are recovered into a 500 |

### 4. Handlers

- **Ownership.** Every read and write is scoped to the caller's user ID; another user's record answers 404. Interview rounds are reached only through their own opportunity, and a Google Calendar event can be linked to only one round per user. Tests cover cross-user access for each service.
- **Validation.** Every field has a length limit, enumerations are checked with `OneOf`, URLs must be https (`HTTPSURL`) or on an expected host (LinkedIn links on conversations must be on linkedin.com), email addresses are validated, list sizes are capped.
- **Fetching users' links (SSRF).** `POST /v1/jobs/read` fetches a job link the user pastes, so job-search's fetcher (`internal/jobs/fetch.go`) only allows `https` on port 443 with no credentials in the URL, refuses `localhost`, `.internal`, and `.local` names, and checks the address of every connection after DNS resolution and after each of at most 4 redirects. Loopback, private, link-local (including `169.254.169.254`, the metadata server), shared (`100.64.0.0/10`), and reserved ranges are refused when connecting, so a name that resolves to an internal address, or DNS rebinding, can't reach the server's network. No proxy is used, keep-alives are off, and responses are capped at 3 MiB and 10 seconds and must be HTML. Job search (`POST /v1/jobs/search`) reads only the fixed Greenhouse, Lever, and Ashby API hosts through the board clients, with board names checked against `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`, so links Gemini suggests can't point it elsewhere.
- **Outbound requests (SSRF).** Job board clients call only fixed hosts (Greenhouse, Lever, Ashby, Adzuna); the board token a user supplies must match `^[A-Za-z0-9._-]{1,100}$`, so it cannot change the host or path. Responses are capped at 10 MiB with a 15-second timeout.
- **No automated submission.** Recording a submit requires `confirmed: true`, sent only after the user confirms in the extension.

## Service-to-service trust

`/internal/*` requests must carry a Google-signed OIDC token (issuer `accounts.google.com`) with audience `unhurried-internal`, a verified email, and that email listed in the service's `INTERNAL_CALLERS`:

| Service | Allowed internal caller |
| --- | --- |
| job-search | `unhurried-scheduler` |
| notifications | `unhurried-job-search-run` |
| resume, applications, inbox | none (all internal calls rejected) |

Cloud Run's IAM binding enforces the same caller list a second time. Cloud Run is configured with `unhurried-internal` as a custom audience so it accepts these tokens.

## Data protection

- **Firestore** has delete protection enabled. The web app never talks to Firestore; all access goes through the services' service accounts, which bypass security rules. Terraform (`modules/auth`) deploys rules that deny every read and write from client SDKs, so even someone holding the public Firebase config cannot reach the database directly.
- **Google Calendar refresh tokens** are encrypted with Cloud KMS before storage, with the user ID as additional authenticated data, so a sealed token copied onto another user's record fails to decrypt. The key (`calendar-refresh-tokens`) rotates every 90 days (old versions stay enabled to decrypt existing tokens), is protected from Terraform destroy, and only the inbox service account can encrypt or decrypt with it. Without a KMS key name the inbox refuses to start in Firestore mode, so tokens are never stored unsealed.
- **Minimal calendar data.** Events are read live when the Interviews page opens and never stored. Only each event's ID, title, link, times, and guest addresses are requested (never descriptions or attachments), and guests leave the inbox only as email domains. What is stored is what the user chooses to add to a round: the interview's title, times, and calendar event ID.
- **Extension data.** The user's contact details for form filling stay in `chrome.storage.local` in their browser. Portal passwords are never collected.
- **Terraform state** is in a versioned Cloud Storage bucket in the same project.

## Google Calendar connection

| Control | Detail |
| --- | --- |
| Least scope | `https://www.googleapis.com/auth/calendar.events.readonly` (view events, no changes) and `userinfo.email` (to show which account is connected). Google classifies the calendar scope as sensitive, not restricted |
| Authorization code flow with PKCE | S256 code challenge; the verifier never leaves the server |
| State | 32 random bytes; only its SHA-256 hash is stored; bound to the user who started the flow; expires after 10 minutes; deleted on first use (Firestore transaction), so a replayed or stolen callback fails |
| Scope check | If the user unticked the calendar on Google's consent screen, nothing is stored. The partial grant is not revoked, because that would also end Drive access granted to the same OAuth client |
| Server-side exchange | The browser only relays the code; tokens are never sent to or stored in the browser |
| Expired or revoked access | Detected (`invalid_grant`, 401/403) and shown as "Reconnect Google Calendar"; Google is not called again until the user reconnects |
| User confirms every link | Events that look like interviews are only suggestions; nothing is added to a round until the user picks the opportunity and round |
| Disconnect | Deletes the connection and its sealed token, without revoking at Google for the same reason as Drive; myaccount.google.com/permissions removes all access |
| Client secret | In Secret Manager, readable only by the inbox and resume service accounts, injected by reference |

While the OAuth consent screen is in Testing mode, Google limits access to listed test users and expires refresh tokens after 7 days.

## Google Drive (resumes)

| Control | Detail |
| --- | --- |
| Least scope | `https://www.googleapis.com/auth/drive.file` only: the service can reach files it created and files the user picked in Google Picker, never the rest of the Drive. Google classifies it as non-sensitive |
| Resumes stay with the user | Documents live in an "Unhurried resumes" folder in the user's own Drive; Firestore keeps only the title, role, document ID, and link |
| Same OAuth protections as Google Calendar | PKCE (S256), single-use hashed state bound to the user with a 10-minute expiry, scope check, server-side code exchange |
| Sealed refresh token | Cloud KMS key `docs-refresh-tokens`, separate from the Calendar key, with the user ID as additional authenticated data; only the resume service account can use it; required in Firestore mode |
| Picker token | Google Picker runs in the browser and needs an access token, so `POST /v1/docs/picker-token` returns a short-lived (about one hour) `drive.file` token. It carries no more access than the service already has and is never stored by the web app |
| Input checks | The picked file ID must match `^[A-Za-z0-9_-]{10,200}$` and be a Google Doc that is not in the trash; edits are capped at 20 per request, 500 characters to find, 2,000 to replace |
| Deleting | "Move to trash" uses Drive's trash, so the user can restore a resume for 30 days |
| Disconnect | Deletes the stored token without revoking it at Google, because revocation would also end Google Calendar access granted to the same OAuth client; myaccount.google.com/permissions removes all access |

## Browser and frontend

- **Hosting headers** (`firebase.json`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. HTTPS is enforced by Firebase Hosting, with automatic certificates for the custom domain.
- **Content-Security-Policy**: scripts only from the site itself, `apis.google.com` (Google sign-in and Picker), and `www.google.com` / `www.gstatic.com` (reCAPTCHA Enterprise), with no inline or `eval` script; network calls only to the site, `*.googleapis.com`, the API gateways (`*.gateway.dev`), and reCAPTCHA; frames only from the Firebase sign-in domain (`*.firebaseapp.com`), reCAPTCHA, Google Picker (`docs.google.com`, `drive.google.com`), and `accounts.google.com`; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`. Styles allow `'unsafe-inline'` because reCAPTCHA and Picker inject inline styles. `src/hosting.test.ts` checks every directive.
- **One address**: production builds set `VITE_CANONICAL_ORIGIN=https://unhurried-careers.com`, and the app moves any other host (Firebase's built-in `unhurried-careers.web.app` and `.firebaseapp.com` addresses) to the same path on the custom domain before it starts. Sign-in uses the custom domain as its auth domain, so Google's consent screen names unhurried-careers.com; Firebase Hosting serves the sign-in handler at `/__/auth/handler` on that domain.
- **Caching**: `index.html` and routes are `no-cache` so security fixes reach users on the next load; hashed assets are immutable.
- **Public configuration only**: the Firebase web config, browser API key, and reCAPTCHA site key are in the bundle by design. Their protection is restriction (domains, APIs, App Check), not secrecy. The deploy pipeline verifies the bundle contains no `localhost` URLs.
- **Extension bridge** (`src/extensionBridge.ts`): answers only messages from the same window and origin, on its own channel, for five named operations; anything else is rejected. It requires the user to be signed in.

## Chrome extension

- **Manifest V3** with `storage`, `activeTab`, and `scripting` only; host access only to the Unhurried web app. No `<all_urls>` or wildcard hosts (tests enforce this).
- **Form filler** runs only on `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `*.myworkdayjobs.com`, `jobs.ashbyhq.com`, over https.
- **No credentials.** API calls are relayed through a signed-in Unhurried tab, so the extension never holds ID tokens, App Check tokens, or the API key.
- **Relay limits.** The background worker accepts messages only from the extension's own pages (not from content scripts on job sites, `sender.tab` must be absent) and only five operations.
- **Never submits.** It fills fields and skips files, passwords, hidden fields, checkboxes, free-text questions, and anything already typed; the user presses the site's Submit button.

## Secrets

| Secret | Where it lives | Who can read it |
| --- | --- | --- |
| Google OAuth client secret | Secret Manager `unhurried-google-oauth-client-secret`; Identity Platform config; Terraform state; local gitignored `envs/prod/terraform.tfvars` | Inbox and resume service accounts; project owners; the `unhurried-terraform` Cloud Build account |
| Web build configuration (includes the browser API key) | Secret Manager `unhurried-web-build-config` | `unhurried-web-deployer` service account |
| Google Calendar refresh tokens (per user) | Firestore, sealed with Cloud KMS | Inbox service account (decrypt) |
| Google Drive refresh tokens (per user) | Firestore, sealed with a separate Cloud KMS key | Resume service account (decrypt) |
| Cross-repo GitHub clone tokens (CD) | Ephemeral tokens minted on demand via Cloud Build v2 `repositories:accessReadToken` (never stored) | `unhurried-builder` and `unhurried-terraform` service accounts |
| Cross-repo GitHub App credentials (CI) | GitHub Actions repository secrets `CI_APP_CLIENT_ID` and `CI_APP_PRIVATE_KEY` for internal `Unhurried-Careers CI Reader` App (`Contents: Read-only` only; mints downscoped, auto-revoked tokens via `actions/create-github-app-token@v3`) | `.github/workflows/ci.yml` in the 5 Go services (downscoped to `unhurried-common`) and `unhurried-infra` (downscoped per matrix service repo) |
| SMTP relay password (alert emails) | Secret Manager `unhurried-smtp-password` (only once `smtp_password` is set); Terraform state | Notifications service account; project owners; the `unhurried-terraform` Cloud Build account |
| Adzuna API credentials | Secret Manager `unhurried-adzuna-app-id` and `unhurried-adzuna-app-key`, injected by reference | Job-search service account |

Everything else needs no stored secret: services reach Google APIs as their service accounts through the metadata server, internal calls use Google-signed identity tokens, user tokens are verified with Google's public keys, and CD runs natively inside Google Cloud Build and Google Cloud Deploy under dedicated GCP service accounts. Zero Google Cloud credentials, Workload Identity bindings, or deployment secrets exist in GitHub.

`.gitignore` rules keep `*.tfvars` (except the non-secret `settings.auto.tfvars`), Terraform state, `.terraform/`, and `.env.local` out of git.

## Supply chain and build

- **Go**: `govulncheck` on the source in every CI run and daily, and on the compiled binary from the image (catches standard library issues in the shipped Go version); `go vet`; race detector in tests.
- **Images**: multi-stage builds; the runtime image is `distroless/static-debian13:nonroot` (no shell or package manager), the binary is static (`CGO_ENABLED=0`, `-trimpath`), and CI verifies the image runs as `nonroot:nonroot` and refuses to start without auth configuration.
- **Images are immutable per commit and provenance-attested**: tagged with the full commit SHA and built with Cloud Build `requestedVerifyOption: VERIFIED` (SLSA build provenance in Artifact Registry / Container Analysis).
- **npm**: lockfiles with `npm ci`; `npm audit --omit=dev --audit-level=high` fails the web build on high-severity runtime vulnerabilities.
- **Infrastructure**: Terraform tests assert security properties (who can invoke what, key restrictions, internal audiences, deploy identity scoping, signup and App Check switches); Checkov scans Terraform (informational).

## CI/CD security

- **Strict CI/CD plane separation.** GitHub Actions (`.github/workflows/ci.yml`) runs pure CI with `permissions: contents: read` and holds zero GCP credentials or deployment secrets (not even OIDC `id-token: write`). Continuous Delivery runs exclusively inside Google Cloud Build (`cloudbuild.yaml`) and Google Cloud Deploy via Google's 2nd-generation GitHub App integration.
- **Least-privilege CD identities.** Service builds run as `unhurried-builder` (pushes images and creates Cloud Deploy releases, cannot touch Cloud Run directly); Cloud Deploy rollouts run as `unhurried-deployer` (updates only the container image on the five services); web Hosting publishes run as `unhurried-web-deployer`; infrastructure applies run as `unhurried-terraform`.
- **Org-owned read-only GitHub App for CI (zero user PATs).** Cross-repo checkouts in GitHub Actions mint short-lived, auto-revoked tokens from an internal `Unhurried-Careers` GitHub App (`Contents: Read-only` only) downscoped per step to the single required repository; `unhurried-common`, `unhurried-web`, `unhurried-extension`, and `unhurried-product` hold zero secrets.
- **Verified rollouts and approval gates.** Google Cloud Deploy verifies both Cloud Run revision readiness and API Gateway `/health` after every rollout, and supports manual production approval gates via `require_deploy_approval = true`.
- **Production is separate from staging** by GCP project and exact branch regex (`^main$` vs `^staging$`); staging credentials cannot touch production and vice versa.

## Known risks and recommended next steps

| Risk | Recommendation |
| --- | --- |
| Free GitHub plan: no GitHub branch protection on private repos, so anyone with write access to `main` triggers production builds | Set `require_deploy_approval = true` in `envs/prod/settings.auto.tfvars` to require manual approval in Google Cloud Deploy before Cloud Run rollouts, or upgrade GitHub to require PR reviews on `main` |
| `unhurried-terraform` has project owner | Replace with a custom role or a list of admin roles once the resource set is stable |
| The OAuth client secret is also in Terraform state | Treat state-bucket access as secret access; consider creating the secret version out of band and reading it with a data source |
| Consent screen in Testing mode | Keep it while usage is personal (limits access to test users); publishing requires Google's verification for the sensitive Calendar scope |
