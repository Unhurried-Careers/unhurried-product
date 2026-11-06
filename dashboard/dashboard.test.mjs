import assert from "node:assert";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPOSITORIES, fetchCiCdStatus } from "./fetch-status.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Running CI/CD Dashboard Test Suite...\n");

// Test 1: Verify REPOSITORIES constant covers all 10 project components
assert.strictEqual(REPOSITORIES.length, 10, "Must define all 10 Unhurried repositories");
const repoNames = REPOSITORIES.map((r) => r.name);
const expectedRepos = [
  "unhurried-job-search",
  "unhurried-resume",
  "unhurried-applications",
  "unhurried-notifications",
  "unhurried-inbox",
  "unhurried-common",
  "unhurried-web",
  "unhurried-extension",
  "unhurried-infra",
  "unhurried-product",
];
for (const expected of expectedRepos) {
  assert(repoNames.includes(expected), `Missing repository definition: ${expected}`);
}
console.log("✓ Test 1: REPOSITORIES definitions contain all 10 repositories");

// Test 2: Check ci-status.json snapshot file exists and is well-formed
const snapshotPath = path.join(__dirname, "data", "ci-status.json");
assert(fs.existsSync(snapshotPath), `Snapshot file must exist at ${snapshotPath}`);
const raw = fs.readFileSync(snapshotPath, "utf8");
const data = JSON.parse(raw);

assert(data.summary, "Data must include summary object");
assert.strictEqual(data.summary.totalRepositories, 10, "Summary totalRepositories must be 10");
assert(data.summary.trackedPipelines >= 9, "Must track at least 9 active pipelines");
assert.strictEqual(typeof data.summary.successRate, "number", "successRate must be a number");
assert(data.summary.successRate >= 0 && data.summary.successRate <= 100, "successRate must be 0-100");
assert(["healthy", "degraded", "running"].includes(data.summary.overallStatus), "overallStatus must be valid");
console.log(`✓ Test 2: ci-status.json is valid with overall status '${data.summary.overallStatus}' (${data.summary.successRate}% passing)`);

// Test 3: Validate each repository entry in the snapshot
assert(Array.isArray(data.repositories), "repositories must be an array");
assert.strictEqual(data.repositories.length, 10, "Must contain entries for all 10 repositories");

for (const repo of data.repositories) {
  assert(repo.name, "Repo must have name");
  assert(repo.displayName, "Repo must have displayName");
  assert(repo.tier, "Repo must have tier");
  assert(repo.target, "Repo must have deployment target");

  if (repo.hasActiveRuns && repo.latestRun) {
    const run = repo.latestRun;
    assert(run.id, `${repo.name} run must have id`);
    assert(run.workflow, `${repo.name} run must have workflow`);
    assert(run.branch, `${repo.name} run must have branch`);
    assert(run.commitSha && run.commitSha.length >= 7, `${repo.name} run must have 7+ char commitSha`);
    assert(run.durationSeconds > 0, `${repo.name} durationSeconds must be positive`);
    assert(run.url.startsWith("https://"), `${repo.name} run url must be valid HTTPS`);

    // Verify step details if present
    if (repo.runDetails && repo.runDetails.jobs) {
      assert(Array.isArray(repo.runDetails.jobs), `${repo.name} jobs must be an array`);
      for (const job of repo.runDetails.jobs) {
        assert(job.name, `${repo.name} job must have name`);
        assert(Array.isArray(job.steps), `${repo.name} job must have steps`);
      }
    }
  }
}
console.log("✓ Test 3: All 10 repository entries verified with valid run metadata and steps");

// Test 4: Verify index.html exists and contains necessary UI hooks
const indexPath = path.join(__dirname, "index.html");
assert(fs.existsSync(indexPath), `index.html must exist at ${indexPath}`);
const indexHtml = fs.readFileSync(indexPath, "utf8");

assert(indexHtml.includes("Unhurried CI/CD Status"), "index.html must have correct title");
assert(indexHtml.includes("repos-container"), "index.html must include repos container");
assert(indexHtml.includes("metric-health"), "index.html must include health metric element");
assert(indexHtml.includes("loadInitialData"), "index.html must include data loader logic");
assert(indexHtml.includes("Zero-Credential CI Model"), "index.html must detail security principles");
console.log("✓ Test 4: index.html contains all necessary UI elements, styles, and scripts");

console.log("\nAll CI/CD Dashboard tests passed successfully! (4/4 tests)");
