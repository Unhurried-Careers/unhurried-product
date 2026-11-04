# Architecture

Unhurried is a deliberate, privacy-first job pursuit system built on Google Cloud managed services. Nothing runs on servers the project maintains: the frontend is a single-page application served from Firebase Hosting's global CDN, each backend microservice is a container on Cloud Run that scales to zero, and all persistent state lives in Cloud Firestore with envelope encryption via Cloud KMS.

---

## 1. System Topology

Unhurried consists of five Go microservices, a React 18 TypeScript web application, a Chrome Manifest V3 browser extension, and supporting Google Cloud managed services.

```mermaid
flowchart TD
  subgraph Clients["Client Tier"]
    WEB["Browser SPA<br/>(unhurried-web: React 18 / Vite)"]
    EXT["Chrome Extension MV3<br/>(unhurried-extension: Apply Assistant)"]
  end

  subgraph Edge["Edge & Ingress Tier"]
    FH["Firebase Hosting CDN<br/>unhurried-careers.com"]
    FA["Identity Platform / Firebase Auth<br/>(Google Sign-in, allowlist)"]
    AC["App Check<br/>(reCAPTCHA Enterprise)"]
    KEY["API Key Protection<br/>(Domain & Gateway restricted)"]
    subgraph Gateways["API Gateways (OpenAPI 2.0 specs)"]
      GW1["job-search-gw"]
      GW2["resume-gw"]
      GW3["applications-gw"]
      GW4["notifications-gw"]
      GW5["inbox-gw"]
    end
  end

  subgraph Compute["Compute Tier (Cloud Run Services, us-central1)"]
    S1["unhurried-job-search<br/>(Criteria, Board Scrapers, Watched Companies)"]
    S2["unhurried-resume<br/>(Google Docs Workspace, AI Tailoring)"]
    S3["unhurried-applications<br/>(Shortlist, Outreach, Conversations, Tracker)"]
    S4["unhurried-notifications<br/>(Alert Preferences, Resend SMTP Relay)"]
    S5["unhurried-inbox<br/>(Calendar Sync, Interview Heuristics, Free Slots)"]
  end

  subgraph Managed["GCP Managed Platform & Data Tier"]
    FS[("Cloud Firestore<br/>(Native mode, us-central1)")]
    KMS["Cloud KMS Key Ring: unhurried<br/>(calendar-refresh-tokens, docs-refresh-tokens)"]
    SM["Secret Manager<br/>(OAuth client secrets, SMTP password, build config)"]
    SCH["Cloud Scheduler<br/>(unhurried-job-search-scan: 07:00 Central)"]
    VERTEX["Vertex AI<br/>(Gemini 2.0 Flash)"]
  end

  subgraph External["External Integrations & Services"]
    BOARDS["Public ATS Boards<br/>(Greenhouse, Lever, Ashby, Adzuna, USAJobs)"]
    GDOCS["Google Drive & Docs API<br/>(drive.file scope)"]
    GCAL["Google Calendar API<br/>(calendar.events.readonly scope)"]
    RESEND["Resend SMTP Relay<br/>(smtp.resend.com:587)"]
    INBOX["User Email Inbox<br/>(Job Alert Digest)"]
  end

  WEB -->|"static assets"| FH
  WEB -->|"Google OAuth"| FA
  WEB -->|"attestation"| AC
  EXT -.->|"window.postMessage relay"| WEB
  WEB -->|"HTTPS + ID Token + App Check + x-api-key"| Gateways

  GW1 -->|"IAM invoke"| S1
  GW2 -->|"IAM invoke"| S2
  GW3 -->|"IAM invoke"| S3
  GW4 -->|"IAM invoke"| S4
  GW5 -->|"IAM invoke"| S5

  SCH -->|"POST /internal/scan (OIDC)"| S1
  S1 -->|"POST /internal/job-digest (OIDC)"| S4

  S1 -->|"read criteria, jobs, watchlist"| FS
  S1 -->|"scrape public job feeds"| BOARDS

  S2 -->|"read/write resumes"| FS
  S2 -->|"decrypt OAuth tokens"| KMS
  S2 -->|"read/write docs"| GDOCS
  S2 -->|"tailor resume copy"| VERTEX

  S3 -->|"read/write pursuits, applications, conversations, rounds"| FS

  S4 -->|"read preferences"| FS
  S4 -->|"read smtp password"| SM
  S4 -->|"send email digest"| RESEND
  RESEND -->|"deliver alerts"| INBOX

  S5 -->|"read/write connections, interviews"| FS
  S5 -->|"decrypt Calendar tokens"| KMS
  S5 -->|"live query events"| GCAL
```

| Tier | Components | Responsibilities |
| --- | --- | --- |
| **Frontend** | `unhurried-web` | React 18 single-page application built with TypeScript and Vite. Deployed to Firebase Hosting (`unhurried-careers.com`). Manages authenticated state, Google Picker, Resume Studio, Application Tracker, and Settings. |
| **Extension** | `unhurried-extension` | Chrome Manifest V3 apply assistant. Communicates exclusively through the active signed-in tab of `unhurried-web` via `window.postMessage`. Detects ATS platforms (Greenhouse, Lever, Ashby, Workday), pre-fills applicant data, and records submissions without storing user credentials or auto-submitting. |
| **API Gateways** | 5 managed Google API Gateways | Validates caller API keys, rate limits client traffic (300 req/min per service), validates Firebase ID tokens (signature, issuer, audience), and invokes Cloud Run backend services via dedicated gateway service accounts. |
| **Compute** | 5 Go Cloud Run services | Containerized Go 1.27 applications (`golang:1.27-alpine` build, `gcr.io/distroless/static-debian13:nonroot` runtime). Each enforces ownership scoping, App Check attestation, user email allowlisting, and specific domain rules. |
| **Data & Secrets** | Firestore, KMS, Secret Manager | Cloud Firestore (Native mode, `us-central1`) for document persistence. Cloud KMS key ring `unhurried` for envelope encryption of external OAuth tokens. Secret Manager for sensitive third-party credentials. |
| **AI & External APIs** | Vertex AI, Google Workspace, Resend | Vertex AI Gemini 2.0 Flash for structured resume tailoring. Google Drive & Docs APIs for document management. Google Calendar API for interview discovery. Resend SMTP for outbound alert delivery. |

---

## 2. Request Lifecycle and Security Defense-in-Depth

Every request from the browser to any backend API undergoes validation across multiple independent security boundaries. Each boundary fails closed:

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (unhurried-web)
  participant GW as Google API Gateway
  participant CR as Cloud Run (Go Service)
  participant MW as Common Middleware Chain
  participant HD as API Route Handler
  participant FS as Cloud Firestore

  B->>B: Acquire Firebase ID Token (Google OAuth)<br/>Acquire App Check Token (reCAPTCHA Enterprise)
  B->>GW: HTTPS Request<br/>Authorization: Bearer <Firebase ID Token><br/>X-Firebase-AppCheck: <Token><br/>x-api-key: <Browser Key>
  
  Note over GW: 1. Verify API Key & HTTP Referrer<br/>2. Apply Rate Limit Quota (300/min)<br/>3. Verify Firebase ID Token RS256 signature, exp, aud
  GW->>CR: Forward request with Gateway SA Identity Token<br/>Original caller token placed in X-Forwarded-Authorization
  
  Note over CR: Cloud Run IAM Invoker Check<br/>(Only Gateway SA or explicit internal SAs permitted)
  CR->>MW: Enter Service Middleware Pipeline
  Note over MW: CORS Allowlist -> Panic Recovery -> Harden Headers<br/>-> Access Logging -> Auth & App Check Verification<br/>-> Verify User Email in ALLOWED_EMAILS
  
  MW->>HD: Dispatch to Scoped Route Handler
  Note over HD: Decode JSON (max 1 MiB) -> Validate fields<br/>Scope query strictly to Authenticated User ID
  HD->>FS: Query or Mutate Firestore (doc ID / userId filter)
  FS-->>HD: Return User Scoped Document
  HD-->>B: Return 200 OK (no-store, nosniff, CORS headers)
```

### Middleware Pipeline Architecture

Each Go microservice constructs its HTTP pipeline using `unhurried-common`:

```
Request ──► httpx.CORS ──► httpx.Recover ──► httpx.Harden ──► httpx.AccessLog ──► auth.Middleware ──► Route Handler
```

1. **`httpx.CORS`**: Rejects unapproved origins with `403 Forbidden`. Only authorized origins (e.g. `https://unhurried-careers.com`) receive CORS response headers.
2. **`httpx.Recover`**: Intercepts unhandled panics, logs stack traces securely, and returns a safe `500 Internal Server Error`.
3. **`httpx.Harden`**: Attaches strict security headers: `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
4. **`httpx.AccessLog`**: Emits structured JSON access logs with request method, path, status, latency, and client IP.
5. **`auth.Middleware`**:
   - Skips authentication only for `GET /health`, `GET /healthz`, and `OPTIONS`.
   - On `/internal/*` endpoints: validates Google OIDC token (`accounts.google.com`, audience `INTERNAL_AUDIENCE`, email in `INTERNAL_CALLERS`).
   - On public `/v1/*` endpoints: validates App Check token, extracts Firebase ID token from `X-Forwarded-Authorization`, verifies RS256 signature against cached Google x509 certificates, and checks that the verified email matches `ALLOWED_EMAILS`.
6. **Route Handler**: Validates request parameters and payload structure (`validate.Errors`), reads the principal from context (`auth.FromContext`), and enforces strict ownership scoping.

---

## 3. Daily Outbound Job Alerts & Scanning Pipeline

Every morning, Cloud Scheduler triggers an automated scan for newly posted jobs across public ATS feeds and user-watched companies. New matching jobs are recorded and emailed in a digest via Resend SMTP.

```mermaid
sequenceDiagram
  autonumber
  participant SCH as Cloud Scheduler (07:00 Central)
  participant JS as unhurried-job-search
  participant BOARDS as ATS Job Feeds (Greenhouse, Lever, Ashby)
  participant FS as Cloud Firestore
  participant NOTIF as unhurried-notifications
  participant RESEND as Resend SMTP Relay
  participant USER as User Email Inbox

  SCH->>JS: POST /internal/scan (Google OIDC token, SA: unhurried-scheduler)
  Note over JS: Verify OIDC token: issuer, audience, and SA email

  JS->>FS: Query active saved criteria (job_criteria) & watched companies (watched_companies)
  FS-->>JS: Return criteria and company watchlists

  par Scan Public Boards
    JS->>BOARDS: Fetch Greenhouse, Lever, Ashby, Adzuna, USAJobs public listings
    BOARDS-->>JS: Return current open roles
  end

  JS->>JS: Deduplicate jobs via SHA-256 (userID, source, externalID)<br/>Match jobs against user keywords & title criteria
  JS->>FS: Upsert newly discovered jobs into 'jobs' collection

  loop For each user with net-new matching jobs
    JS->>NOTIF: POST /internal/job-digest (Google OIDC token, SA: unhurried-job-search-run)
    Note over NOTIF: Verify OIDC token: SA in INTERNAL_CALLERS

    NOTIF->>FS: Fetch notification preferences (notification_preferences)
    FS-->>NOTIF: Return alert status and destination email

    alt Alerts enabled and valid email configured
      NOTIF->>NOTIF: Render HTML & plaintext morning digest (mail.Digest)
      NOTIF->>RESEND: Relay email over TLS (smtp.resend.com:587, unhurried-smtp-password)
      RESEND->>USER: Deliver daily job digest email
      NOTIF-->>JS: 200 OK {status: "sent"}
    else Alerts disabled or no email
      NOTIF-->>JS: 200 OK {status: "skipped"}
    end
  end

  JS-->>SCH: 200 OK {status: "ok", scansRun: N, digestsSent: M}
```

---

## 4. AI Resume Tailoring Architecture

The Resume Studio allows users to maintain a master resume as a native Google Doc in their personal Google Drive. For each shortlisted pursuit, the user can create an AI-tailored copy optimized for the target job description using Google Cloud Vertex AI (Gemini 2.0 Flash) while strictly enforcing honesty rules.

```mermaid
sequenceDiagram
  autonumber
  participant U as User (Resume Studio)
  participant WEB as unhurried-web
  participant RES as unhurried-resume
  participant KMS as Cloud KMS
  participant GDOCS as Google Docs API
  participant VERTEX as Vertex AI (Gemini 2.0 Flash)
  participant FS as Cloud Firestore

  U->>WEB: Open Resume Studio, select resume copy, paste job description
  WEB->>RES: POST /v1/resumes/{id}/tailor {jobTitle, company, jobDescription}

  RES->>FS: Read resume metadata (resumes) & user connection (docs_connections)
  FS-->>RES: Return doc ID and KMS-sealed refresh token

  RES->>KMS: Decrypt refresh token (key: docs-refresh-tokens, AAD: userID)
  KMS-->>RES: Plaintext OAuth token

  RES->>GDOCS: GET /v1/documents/{docId} (fetch structural text)
  GDOCS-->>RES: Document structural elements & body text

  Note over RES: Assemble prompt with strict Honesty Rules:<br/>- Never fabricate employers, dates, degrees, or skills<br/>- Rephrase genuine experience using target role keywords<br/>- Output JSON: summary, matchScore, gaps, exact find/replace edits

  RES->>VERTEX: POST models/gemini-2.0-flash:generateContent (JSON Schema)
  VERTEX-->>RES: Candidate tailoring payload (analysis, score, gaps, edits)

  Note over RES: Sanitization & Verification:<br/>- Strip markdown backticks & extra whitespace<br/>- Verify every findText exists verbatim in the Doc<br/>- Limit to max 20 atomic find-and-replace edits

  RES-->>WEB: Return {overallAnalysis, matchScore, gaps, edits}
  WEB-->>U: Render interactive diff preview (match score, gaps, proposed edits)

  U->>WEB: Review proposed changes, uncheck unwanted edits, click "Apply to Doc"
  WEB->>RES: POST /v1/resumes/{id}/edit {edits: [{findText, replaceWith}, ...]}

  RES->>KMS: Decrypt refresh token
  RES->>GDOCS: POST /v1/documents/{docId}:batchUpdate (replaceAllText)
  Note over GDOCS: Atomic text replacement preserving fonts, sizes, and layout
  GDOCS-->>RES: batchUpdate response ({replacementsCount})

  RES-->>WEB: Return {updatedCount: N}
  WEB-->>U: Confirm changes applied directly to user's Google Doc
```

---

## 5. Applications, Shortlist, and Conversations Subsystem

Unhurried enforces a deliberate, low-volume job search workflow. Users select at most five active roles to pursue at any time, write substantive reasons for pursuing each, reach out to team members for informational conversations, and track interview rounds with preparation checklists.

```mermaid
stateDiagram-v2
  [*] --> Shortlist: Add pursuit (max 5 active, whyRole >= 30 chars, whyCompany >= 30 chars)
  
  state Shortlist {
    [*] --> Researching
    Researching --> ReachingOut: Review team & draft outreach kit
    ReachingOut --> ReadyToApply: Completed conversations & tailored resume
    ReadyToApply --> Applied: Promote to tracked application
    Researching --> Dropped: Not aligned
    ReachingOut --> Dropped: Not aligned
  }

  state ConversationsTracker {
    [*] --> ToAsk: Identify contact
    ToAsk --> Asked: Send outreach ask message
    Asked --> Agreed: Contact agrees to meet
    Agreed --> Scheduled: Send Google Calendar booking link
    Scheduled --> Met: Conduct coffee chat
    Met --> FollowUp: Record learnings & next reach-out date
    Asked --> Declined
    Asked --> NoResponse
  }

  state ApplicationTracker {
    [*] --> Draft: Created from shortlist
    Draft --> Submitted: Applied via extension or direct
    Submitted --> Viewed: Employer reviewed application
    Viewed --> Interview: Recruiter screening scheduled
    Interview --> Offer: All rounds passed
    Interview --> Rejected
    Submitted --> NoResponse
  }

  Applied --> Draft: Creates application record & timeline event
```

```mermaid
flowchart LR
  subgraph ExtensionBridge["Chrome Extension Apply Flow"]
    PAGE["Target Job Board<br/>(Greenhouse, Lever, Ashby, Workday)"]
    EXT_POPUP["Extension Popup<br/>(Select Application)"]
    EXT_BG["Extension Background Worker"]
    BRIDGE["bridge.js<br/>(Content Script on web app)"]
    WEB_BRIDGE["extensionBridge.ts<br/>(Unhurried Web App)"]
    APP_API["unhurried-applications<br/>(GET /fill-payload, POST /submit)"]
  end

  PAGE -->|"activeTab"| EXT_POPUP
  EXT_POPUP -->|"relay command"| EXT_BG
  EXT_BG -->|"chrome.tabs.sendMessage"| BRIDGE
  BRIDGE -->|"window.postMessage"| WEB_BRIDGE
  WEB_BRIDGE -->|"authenticated API call"| APP_API
  APP_API -->>|"fill fields"| WEB_BRIDGE
  WEB_BRIDGE -->>|"DOM form input"| PAGE
  PAGE -.->|"user manually clicks submit"| PAGE
  EXT_POPUP -->|"POST /submit with confirmation"| APP_API
```

---

## 6. Google Calendar Interview Detection & Free Slot Proposal

Unhurried connects to Google Calendar with read-only permissions (`calendar.events.readonly`) to help candidates track interviews and generate free meeting slots for recruiters without ever storing raw calendar events.

```mermaid
flowchart TD
  subgraph OAuthConnect["OAuth Connection Lifecycle"]
    U1["User clicks 'Connect Calendar'"] --> CONNECT["POST /v1/calendar/connect"]
    CONNECT --> PKCE["Generate SHA-256 PKCE & state in calendar_oauth_states"]
    PKCE --> GOOG_CONSENT["Redirect to Google OAuth Consent<br/>(calendar.events.readonly)"]
    GOOG_CONSENT --> CALLBACK["POST /v1/calendar/callback {code, state}"]
    CALLBACK --> EXCHANGE["Exchange code for refresh token"]
    EXCHANGE --> SEAL["Cloud KMS Encrypt<br/>(Key: calendar-refresh-tokens, AAD: userId)"]
    SEAL --> SAVE_CONN["Store in calendar_connections<br/>(Sealed token, email, status)"]
  end

  subgraph EventDiscovery["Privacy-First Interview Detection"]
    U2["User views Tracker page"] --> GET_EVENTS["GET /v1/calendar/events?from=&to="]
    GET_EVENTS --> DECRYPT["Cloud KMS Decrypt Refresh Token"]
    DECRYPT --> GCAL_API["Google Calendar API: list events (past 60 to next 60 days)"]
    GCAL_API --> HEURISTICS["Heuristic Classification Engine<br/>- Match recruiter emails & domains<br/>- Video links (Meet, Zoom, Teams)<br/>- Keywords: Interview, Screen, Debrief, Chat"]
    HEURISTICS --> FLAGGED["Return timed events with likelyInterview: true/false<br/>(Events are NEVER stored in Firestore)"]
    FLAGGED --> CONFIRM["User confirms interview link to Application Round<br/>(POST /v1/applications/{id}/rounds/{roundId}/interviews)"]
  end

  subgraph SlotProposals["Free Slot Proposal Engine"]
    U3["User requests interview proposal"] --> PROPOSE["POST /v1/interviews/propose"]
    PROPOSE --> BUSY_TIMES["Compute busy periods from user calendar"]
    BUSY_TIMES --> GEN_SLOTS["Generate 5 one-hour non-overlapping candidate slots<br/>within business hours across upcoming days"]
    GEN_SLOTS --> SAVE_SLOTS["Persist proposed slots in 'interviews' collection"]
    SAVE_SLOTS --> SHARE["Copy formatted availability text with booking link"]
  end
```

---

## 7. CI/CD Architecture (GitHub Actions CI vs. Google Cloud CD)

Unhurried enforces a strict architectural boundary between Continuous Integration and Continuous Delivery:

```mermaid
flowchart TD
  subgraph GITHUB["GitHub (Unhurried-Careers) — Pure CI"]
    DEV["Developer / PR Author"] -->|"git push / open PR"| GH_REPO["GitHub Repository"]
    GH_REPO -->|"Trigger"| GHA["GitHub Actions (.github/workflows/ci.yml)<br/>- permissions: contents: read<br/>- ZERO Google Cloud credentials<br/>- gofmt, go vet, go test -race<br/>- govulncheck (code & binary)<br/>- Vitest (web: 85% coverage threshold)<br/>- check-specs.mjs (gateway spec linter)<br/>- terraform test (mocked providers)<br/>- Container smoke test"]
  end

  subgraph GCP["Google Cloud — Pure CD (Cloud Build + Cloud Deploy)"]
    MERGE["Merge PR to staging or main"] -->|"2nd-gen GitHub App webhook"| CB["Cloud Build (cloudbuild.yaml)"]
    
    subgraph BuildPipeline["Cloud Build Execution (unhurried-builder SA)"]
      CB --> DOCKER_BUILD["Multi-stage Docker Build<br/>(Go 1.27 static binary + Distroless non-root)"]
      DOCKER_BUILD --> ARTIFACTS["Artifact Registry<br/>(us-central1-docker.pkg.dev/.../unhurried:<SHA>)<br/>SLSA Provenance Verified"]
      CB --> CREATE_RELEASE["Create Release in Google Cloud Deploy"]
    end

    subgraph DeployPipeline["Cloud Deploy Progressive Rollout"]
      CREATE_RELEASE --> CD_PIPELINE["Cloud Deploy Delivery Pipeline<br/>(per service: job-search, resume, applications, notifications, inbox)"]
      CD_PIPELINE --> ROLLOUT["Rollout to Target: unhurried-prod (Cloud Run)"]
      ROLLOUT --> POST_VERIFY["Post-Deploy Verify Hook<br/>(Query gateway /health endpoint)"]
      ROLLOUT -.->|"One-Click Rollback"| PREV_SHA["Instant Rollback to Previous Revision"]
    end

    subgraph WebAndInfraCD["Web & Infrastructure Delivery"]
      CB -->|"unhurried-web-deployer"| VITE_BUILD["Build React SPA + inject build secrets"]
      VITE_BUILD --> FH_DEPLOY["Deploy to Firebase Hosting CDN"]
      CB -->|"unhurried-terraform"| TF_APPLY["Run check-specs.mjs + terraform apply"]
    end
  end

  GHA -.->|"Pass required checks"| MERGE
```

---

## 8. Data Model & Firestore Persistence

All five backend services utilize Cloud Firestore (Native mode in `us-central1`) for document persistence. Client direct access to Firestore is permanently disabled via security rules (`allow read, write: if false;`), ensuring all data access is mediated through the Go backend services.

| Service | Firestore Collection | Document ID Scheme | Scoped By | Purpose |
| --- | --- | --- | --- | --- |
| **`job-search`** | `job_criteria` | Random UUID (`ids.New()`) | `userId` | User saved job search criteria (titles, locations, keywords, salary) |
| **`job-search`** | `jobs` | SHA-256 of `(userId, source, externalId)` | `userId` | Deduplicated discovered job listings from scrapers |
| **`job-search`** | `watched_companies` | Random UUID (`ids.New()`) | `userId` | Followed companies with ATS platform and board token (max 50) |
| **`resume`** | `resumes` | Random UUID (`ids.New()`) | `userId` | Resumes metadata (title, role, Google Doc ID, match scores) |
| **`resume`** | `docs_connections` | User ID (`userID`) | `userId` | Sealed Google Drive refresh token, folder ID, and master resume ID |
| **`resume`** | `docs_oauth_states` | SHA-256 of state token | — | Pending Google Drive OAuth 2.0 PKCE state verifiers |
| **`applications`**| `pursuits` | Random UUID (`ids.New()`) | `userId` | Shortlisted roles (max 5 active), `whyRole`, `whyCompany`, status |
| **`applications`**| `contacts` | Random UUID (`ids.New()`) | `userId` | Outreach networking contacts per pursuit (max 20 per role) |
| **`applications`**| `conversations` | Random UUID (`ids.New()`) | `userId` | Coffee chats and informational interview records |
| **`applications`**| `conversation_settings` | User ID (`userID`) | `userId` | User Google Calendar booking page link and availability notes |
| **`applications`**| `applications` | Random UUID (`ids.New()`) | `userId` | Tracked job applications (draft, submitted, interview, offer) |
| **`applications`**| `application_events` | Random UUID (`ids.New()`) | `userId` | Audit event timeline for application status changes |
| **`applications`**| `interview_rounds` | Random UUID (`ids.New()`) | `userId` | Interview stages, skills to show/shown, learnings, prep checklist |
| **`notifications`**| `notification_preferences` | User ID (`userID`) | `userId` | Alert preferences, destination email, enabled toggle |
| **`inbox`** | `calendar_connections` | User ID (`userID`) | `userId` | Sealed Google Calendar refresh token, Google email, sync status |
| **`inbox`** | `calendar_oauth_states`| SHA-256 of state token | — | Pending Google Calendar OAuth 2.0 PKCE state verifiers |
| **`inbox`** | `interviews` | Random UUID (`ids.New()`) | `userId` | Proposed and confirmed interview slots |

> [!NOTE]
> Queries against Firestore use equality filters (`Where("userId", "==", userID)`) and sort in Go memory, eliminating the need for composite index maintenance. Every document contains a `userId` field, and foreign lookups return `404 Not Found` rather than `403 Forbidden` to prevent object identifier enumeration.

---

## 9. Technology Stack Summary

| Area | Technology & Tooling | Version / Configuration |
| --- | --- | --- |
| **Frontend** | React, TypeScript, Vite, React Router, Firebase JS SDK | React 18, TypeScript 5, Vite 5, React Router v7, Firebase SDK v13 |
| **Extension** | Vanilla JavaScript, Chrome Extensions Manifest V3 | Manifest V3, content scripts, background service worker |
| **Backend Services** | Go, Standard Library `net/http` | Go 1.23+ modules, Go 1.27 Alpine build, Distroless Debian 13 runtime |
| **AI Engine** | Google Cloud Vertex AI | Gemini 2.0 Flash (`gemini-2.0-flash`), region `us-central1` |
| **Database** | Google Cloud Firestore | Native Mode, delete protection enabled, `us-central1` |
| **Envelope Encryption** | Google Cloud KMS | Key ring `unhurried`, symmetric encryption (`GOOGLE_SYMMETRIC_ENCRYPTION`), 90-day automatic rotation |
| **Email Delivery** | Resend SMTP Relay | Host `smtp.resend.com:587`, STARTTLS, credentials in Secret Manager |
| **Infrastructure** | HashiCorp Terraform | Terraform 1.16, Google & Google-Beta providers ~> 6.0 |
| **CI Platform** | GitHub Actions | Pure CI, `permissions: contents: read`, zero GCP credentials |
| **CD Platform** | Google Cloud Build & Google Cloud Deploy | 2nd-gen GitHub connections, SLSA verified builds, progressive rollouts |
