# Versioning policy

Unhurried uses [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`) across the web application, browser extension, backend microservices, shared libraries, and status operations.

## Core rule: Update on each commit

> **Every commit modifying an app, browser extension, service, or API MUST update its version according to the SemVer policy before committing.**

| Level | When to bump | Examples |
| :--- | :--- | :--- |
| **PATCH** (`0.1.X`) | Backward-compatible bug fixes, performance improvements, UI styling adjustments, docs, internal refactoring, dependency updates | Fixing a race condition in secret access; updating button styles; correcting typos |
| **MINOR** (`0.X.0`) | Backward-compatible new features, new endpoints, new pages, new interactive capabilities | Adding LinkedIn profile import; introducing interview round tracking; adding a new REST endpoint |
| **MAJOR** (`X.0.0`) | Breaking changes, incompatible API contract shifts, deprecated route removals, breaking data schema migrations | Transitioning from `/v1` to `/v2`; replacing an existing payload structure incompatibly; major redesign |

---

## Component version locations

### 1. Web application (`unhurried-web`)
- **Source of truth**: `unhurried-web/package.json` (`version`) and `unhurried-web/src/version.ts` (`APP_VERSION`).
- **Headers**: Every outgoing request through `src/api.ts` transmits `X-Client-Version: <APP_VERSION>`.
- **UI Exposure**: Displayed in the signed-in application footer / Settings screen (`Unhurried Web v0.1.0 · API v1`) and the public homepage footer.

### 2. Chrome extension (`unhurried-extension`)
- **Source of truth**: `unhurried-extension/package.json` (`version`) and `unhurried-extension/manifest.json` (`version`, `version_name`).
- **UI Exposure**: Displayed dynamically in the popup header from `chrome.runtime.getManifest().version`.

### 3. Backend APIs & microservices
- **Shared baseline**: Defined in `unhurried-common/version/version.go` (`version.Version` and `version.APIVersion`).
- **Endpoints**:
  - `GET /health` returns `{"status":"ok", "service":"<service>", "version":"0.1.0", "api_version":"v1"}`.
  - `GET /version` returns `{"service":"<service>", "version":"0.1.0", "api_version":"v1"}`.
- **Headers**: Every API response passed through `httpx.Harden` attaches:
  - `X-API-Version: v1`
  - `X-App-Version: 0.1.0`
- **CORS**: `Access-Control-Expose-Headers` includes `X-API-Version, X-App-Version`.

### 4. Status dashboard (`unhurried-ops`)
- **Source of truth**: `unhurried-ops/web/package.json` (`version`).

---

## Commit checklist

When making a commit to any repository:
1. Identify whether changes affect an app, extension, or API service.
2. Determine the bump level (PATCH for fixes/optimizations, MINOR for features/endpoints, MAJOR for breaking changes).
3. Update the corresponding version file(s).
4. Run tests and typechecks to verify consistency.
5. Include the version update in the commit.
