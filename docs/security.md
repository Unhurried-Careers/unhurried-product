# Security

This document lists every security control in Unhurried, where it is implemented, and what it protects against. Known weaknesses are collected at the end so they are not mistaken for controls.

## What is being protected

| Asset | Why it matters |
| --- | --- |
| The user's job search data | Shortlist reasons, contacts, applications, and resume content are personal and career-sensitive |
| Gmail access | A refresh token with `gmail.readonly` can read the user's entire mailbox |
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
| Stolen database contents | Gmail tokens sealed with Cloud KMS and bound to the user; no email bodies stored |
| Compromised CI or repository | Keyless deploys, branch- and repository-bound identities, least-privilege deployers |
| Vulnerable dependencies or base images | govulncheck (source and binary), npm audit, distroless non-root images |
| Malicious job sites or pages | Extension never submits, relays only five operations from its own popup, holds no tokens |
| Clickjacking and content sniffing | Hosting security headers, API `nosniff` and `no-store` |

## Identity and sign-in

- **Google is the only sign-in method.** Identity Platform has email/password and phone sign-in disabled, and multi-tenancy off (`modules/auth`).
- **Allowlist.** Every service admits only the verified Google accounts in `ALLOWED_EMAILS` (from `allowed_emails` in Terraform); others get 403 even with a valid token. Services refuse to start if the list is empty.
- **Signup switch.** `allow_new_signups = false` makes Identity Platform refuse to create any new user; user deletion through the client API is disabled.
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

- **Invocation is IAM-only.** Each service's only `roles/run.invoker` grants are its gateway's service account and, for internal routes, the specific Scheduler or inbox accounts. Unauthenticated direct calls get 403 from Google before reaching the code.
- **Each service runs as its own service account** with only what it needs (Firestore user, Pub/Sub publisher; the inbox additionally gets the KMS key and the OAuth secret).

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

- **Ownership.** Every read and write is scoped to the caller's user ID; another user's record answers 404. `/internal/events` takes the user from the stored application, not from the request; `/internal/imports` takes it from the finding, which only the inbox service account can send and which the inbox fills from its own connection record. Tests cover cross-user access for each service.
- **Validation.** Every field has a length limit, enumerations are checked with `OneOf`, URLs must be https (`HTTPSURL`) or on an expected host (LinkedIn contacts must be on linkedin.com), emails and phone numbers are validated, list sizes are capped.
- **Outbound requests (SSRF).** Job board clients call only fixed hosts; the board token a user supplies must match `^[A-Za-z0-9._-]{1,100}$`, so it cannot change the host or path. Responses are capped at 10 MiB with a 15-second timeout.
- **No automated submission.** Recording a submit requires `confirmed: true`, sent only after the user confirms in the extension.

## Service-to-service trust

`/internal/*` requests must carry a Google-signed OIDC token (issuer `accounts.google.com`) with audience `unhurried-internal`, a verified email, and that email listed in the service's `INTERNAL_CALLERS`:

| Service | Allowed internal caller |
| --- | --- |
| job-search | `unhurried-scheduler` |
| inbox | `unhurried-scheduler` |
| applications | `unhurried-inbox-run` |
| resume, notifications | none (all internal calls rejected) |

Cloud Run's IAM binding enforces the same caller list a second time. Cloud Run is configured with `unhurried-internal` as a custom audience so it accepts these tokens.

## Data protection

- **Firestore** has delete protection enabled. The web app never talks to Firestore; all access goes through the services' service accounts, which bypass security rules (no rules are deployed by Terraform; see the risks below).
- **Gmail refresh tokens** are encrypted with Cloud KMS before storage, with the user ID as additional authenticated data, so a sealed token copied onto another user's record fails to decrypt. The key rotates every 90 days (old versions stay enabled to decrypt existing tokens), is protected from Terraform destroy, and only the inbox service account can encrypt or decrypt with it. Without a KMS key name the inbox refuses to start in Firestore mode, so tokens are never stored unsealed.
- **Minimal email data.** Only the company, role, status, date, Gmail message and thread IDs, and the subject line are stored. Email bodies are never fetched (only `format=metadata` plus Gmail's snippet), and the snippet is used for parsing only, not stored.
- **Extension data.** The user's contact details for form filling stay in `chrome.storage.local` in their browser. Portal passwords are never collected.
- **Terraform state** is in a versioned Cloud Storage bucket in the same project.

## Gmail connection

| Control | Detail |
| --- | --- |
| Least scope | `https://www.googleapis.com/auth/gmail.readonly` only |
| Authorization code flow with PKCE | S256 code challenge; the verifier never leaves the server |
| State | 32 random bytes; only its SHA-256 hash is stored; bound to the user who started the flow; expires after 10 minutes; deleted on first use (Firestore transaction), so a replayed or stolen callback fails |
| Scope check | If the user unticked Gmail on Google's consent screen, the partial grant is revoked and nothing is stored |
| Server-side exchange | The browser only relays the code; tokens are never sent to or stored in the browser |
| Expired or revoked access | Detected (`invalid_grant`, 401/403) and shown as "Reconnect Gmail"; the scheduled poll skips such connections |
| Disconnect | Revokes the refresh token at Google and deletes the connection |
| Client secret | In Secret Manager, readable only by the inbox service account, injected by reference |

While the OAuth consent screen is in Testing mode, Google limits access to listed test users and expires Gmail refresh tokens after 7 days.

## Browser and frontend

- **Hosting headers** (`firebase.json`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. HTTPS is enforced by Firebase Hosting, with automatic certificates for the custom domain.
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
| Google OAuth client secret | Secret Manager `unhurried-gmail-oauth-client-secret`; Identity Platform config; Terraform state; GitHub `PRODUCTION_GOOGLE_OAUTH_CLIENT_SECRET`; local gitignored `envs/prod/terraform.tfvars` | Inbox service account; project owners; the Terraform pipeline |
| Web build configuration (includes the browser API key) | Secret Manager `unhurried-web-build-config` | Web deployer service account |
| Gmail refresh tokens (per user) | Firestore, sealed with Cloud KMS | Inbox service account (decrypt) |
| Cross-repo checkout token | GitHub `UNHURRIED_REPOS_TOKEN` | CI jobs |
| Third-party keys (Adzuna, USAJobs, Twilio) | Placeholder secrets with no value; not wired | — |

Everything else needs no stored secret: services reach Google APIs as their service accounts through the metadata server, internal calls use Google-signed identity tokens, user tokens are verified with Google's public keys, and pipelines use Workload Identity Federation. There are no service account keys.

`.gitignore` rules keep `*.tfvars` (except the non-secret `settings.auto.tfvars`), Terraform state, `.terraform/`, and `.env.local` out of git.

## Supply chain and build

- **Go**: `govulncheck` on the source in every CI run and daily, and on the compiled binary from the image (catches standard library issues in the shipped Go version); `go vet`; race detector in tests.
- **Images**: multi-stage builds; the runtime image is `distroless/static-debian13:nonroot` (no shell or package manager), the binary is static (`CGO_ENABLED=0`, `-trimpath`), and CI verifies the image runs as `nonroot:nonroot` and refuses to start without auth configuration.
- **Images are immutable per commit**: tagged with the full commit SHA.
- **npm**: lockfiles with `npm ci`; `npm audit --omit=dev --audit-level=high` fails the web build on high-severity runtime vulnerabilities.
- **Infrastructure**: Terraform tests assert security properties (who can invoke what, key restrictions, internal audiences, deploy identity scoping, signup and App Check switches); Checkov scans Terraform (informational).

## CI/CD security

- **No long-lived credentials.** Workload Identity Federation with tokens bound to the organization's numeric ID and the environment's branch; each repository can impersonate only its own deploy account.
- **Least privilege.** The service deployer can only push images and update the five services; the web deployer can only publish Hosting and read its build config.
- **Workflow permissions** default to `contents: read`; only deploy jobs get `id-token: write`.
- **Deploys only after checks pass** (`needs:`), and are never cancelled mid-run.
- **Production is separate from staging** by project; staging credentials cannot touch production and vice versa.

## Known risks and recommended next steps

| Risk | Recommendation |
| --- | --- |
| Free GitHub plan: no branch protection or required reviewers, so anyone with write access to `main` deploys to production | Upgrade the organization to GitHub Team and require pull requests and reviews on `main`; add a `production` environment with required reviewers to the deploy jobs |
| `unhurried-terraform` has project owner | Replace with a custom role or a list of admin roles once the resource set is stable; consider a read-only identity for plans |
| The OAuth client secret is also in Terraform state and GitHub | Treat state-bucket access as secret access; consider creating the secret version out of band and reading it with a data source |
| `allow_new_signups` is still `true` in production | Set it to `false` and apply now that the owner has signed in |
| No Firestore security rules are deployed, so the database's default rules apply to any client SDK access | Deploy explicit deny-all rules (`google_firebaserules_ruleset` and release); the services are unaffected because service accounts bypass rules |
| No Content-Security-Policy header | Add a CSP to `firebase.json` that allows only self, Google sign-in, reCAPTCHA, and the gateway hosts |
| `unhurried-careers.web.app` still serves production | Redirect it to `unhurried-careers.com` in the app, or drop it from CORS and API key referrers once the custom domain is the only entry point |
| `UNHURRIED_REPOS_TOKEN` is a long-lived token | Replace it with a GitHub App installation token or a fine-grained token limited to read access on these repositories, with an expiry |
| Consent screen in Testing mode | Keep it while usage is personal (limits access to test users); publishing requires Google's verification for the restricted Gmail scope |
| Unused placeholder secrets and Pub/Sub topics | Remove them, or wire them with the features that need them |
