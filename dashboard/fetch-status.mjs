import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPOSITORIES = [
  {
    name: "unhurried-job-search",
    displayName: "Job Search & Discovery",
    tier: "backend",
    role: "Direction, research with AI summaries, and discovery of postings",
    target: "Cloud Run · Go 1.23",
    deployPipeline: "job-search-delivery",
    ciWorkflow: "CI",
  },
  {
    name: "unhurried-resume",
    displayName: "Resume Studio",
    tier: "backend",
    role: "Google Docs/Drive resume copies and Vertex AI tailoring",
    target: "Cloud Run · Go 1.23",
    deployPipeline: "resume-delivery",
    ciWorkflow: "CI",
  },
  {
    name: "unhurried-applications",
    displayName: "Opportunity Pipeline",
    tier: "backend",
    role: "Opportunity stages and gates, outreach kit, conversations & interview rounds",
    target: "Cloud Run · Go 1.23",
    deployPipeline: "applications-delivery",
    ciWorkflow: "CI",
  },
  {
    name: "unhurried-notifications",
    displayName: "Notifications & Alerts",
    tier: "backend",
    role: "Email digests of new postings for your targets via SMTP",
    target: "Cloud Run · Go 1.23",
    deployPipeline: "notifications-delivery",
    ciWorkflow: "CI",
  },
  {
    name: "unhurried-inbox",
    displayName: "Inbox & Calendar",
    tier: "backend",
    role: "Google Calendar interview detection and slot proposals",
    target: "Cloud Run · Go 1.23",
    deployPipeline: "inbox-delivery",
    ciWorkflow: "CI",
  },
  {
    name: "unhurried-common",
    displayName: "Common Library",
    tier: "library",
    role: "Shared Go library: auth, HTTP hardening, validation, models",
    target: "Go Module · v0.1",
    deployPipeline: "library-sync",
    ciWorkflow: "CI",
  },
  {
    name: "unhurried-web",
    displayName: "Web App (SPA)",
    tier: "frontend",
    role: "TypeScript React frontend deployed to Firebase Hosting CDN",
    target: "Firebase Hosting · Global CDN",
    deployPipeline: "unhurried-web-deploy",
    ciWorkflow: "CI",
  },
  {
    name: "unhurried-extension",
    displayName: "Chrome Extension",
    tier: "frontend",
    role: "Chrome MV3 job application assistant",
    target: "Cloud Storage · Artifacts",
    deployPipeline: "unhurried-extension-package",
    ciWorkflow: "CI",
  },
  {
    name: "unhurried-infra",
    displayName: "Infrastructure & Specs",
    tier: "infra",
    role: "Terraform GCP infrastructure, API Gateway specs, and security rules",
    target: "Terraform · GCP Prod & Staging",
    deployPipeline: "unhurried-infra-apply",
    ciWorkflow: "CI",
  },
  {
    name: "unhurried-product",
    displayName: "Product & Architecture",
    tier: "product",
    role: "System specifications, architecture guides, and CI/CD dashboard",
    target: "Documentation & Meta",
    deployPipeline: "static",
    ciWorkflow: "CI",
  },
];

const ORG = "Unhurried-Careers";

/**
 * Executes a gh CLI command and returns parsed JSON.
 */
function runGhJson(command) {
  try {
    const raw = execSync(command, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Fetches workflow status for all repositories in Unhurried-Careers.
 */
export async function fetchCiCdStatus() {
  const generatedAt = new Date().toISOString();
  const repoStatuses = [];

  for (const repoMeta of REPOSITORIES) {
    const repoName = repoMeta.name;
    const runsCmd = `gh run list --repo ${ORG}/${repoName} -L 5 --json databaseId,name,status,conclusion,headBranch,headSha,createdAt,startedAt,updatedAt,url,displayTitle`;
    const runs = runGhJson(runsCmd) || [];

    let latestRun = null;
    let runDetails = null;

    if (runs.length > 0) {
      const top = runs[0];
      const start = new Date(top.startedAt || top.createdAt);
      const end = new Date(top.updatedAt || top.createdAt);
      const durationSeconds = Math.max(1, Math.round((end.getTime() - start.getTime()) / 1000));

      latestRun = {
        id: top.databaseId,
        workflow: top.name,
        status: top.status, // "completed", "in_progress", "queued"
        conclusion: top.conclusion || "running", // "success", "failure", "cancelled", "running"
        branch: top.headBranch,
        commitSha: top.headSha ? top.headSha.slice(0, 7) : "-",
        fullSha: top.headSha || "",
        commitTitle: top.displayTitle || "",
        createdAt: top.createdAt,
        updatedAt: top.updatedAt,
        durationSeconds,
        url: top.url,
      };

      // Fetch job & step details for the latest run
      const viewCmd = `gh run view ${top.databaseId} --repo ${ORG}/${repoName} --json jobs`;
      const viewResult = runGhJson(viewCmd);
      if (viewResult && Array.isArray(viewResult.jobs)) {
        runDetails = {
          jobs: viewResult.jobs.map((j) => ({
            name: j.name,
            conclusion: j.conclusion || "running",
            status: j.status || "in_progress",
            steps: (j.steps || []).map((s) => ({
              name: s.name,
              status: s.status,
              conclusion: s.conclusion,
            })),
          })),
        };
      }
    }

    // Historical runs (up to 5)
    const history = runs.map((r) => {
      const s = new Date(r.startedAt || r.createdAt);
      const e = new Date(r.updatedAt || r.createdAt);
      return {
        id: r.databaseId,
        branch: r.headBranch,
        commitSha: r.headSha ? r.headSha.slice(0, 7) : "-",
        commitTitle: r.displayTitle || "",
        status: r.status,
        conclusion: r.conclusion || "running",
        durationSeconds: Math.max(1, Math.round((e.getTime() - s.getTime()) / 1000)),
        createdAt: r.createdAt,
        url: r.url,
      };
    });

    repoStatuses.push({
      ...repoMeta,
      org: ORG,
      repoUrl: `https://github.com/${ORG}/${repoName}`,
      hasActiveRuns: runs.length > 0,
      latestRun,
      runDetails,
      history,
    });
  }

  // Summary statistics
  const activeWithRuns = repoStatuses.filter((r) => r.hasActiveRuns && r.latestRun);
  const totalWithRuns = activeWithRuns.length;
  const successfulRuns = activeWithRuns.filter((r) => r.latestRun.conclusion === "success").length;
  const failedRuns = activeWithRuns.filter((r) => r.latestRun.conclusion === "failure").length;
  const runningRuns = activeWithRuns.filter((r) => r.latestRun.status === "in_progress" || r.latestRun.conclusion === "running").length;

  const totalDuration = activeWithRuns.reduce((acc, r) => acc + (r.latestRun.durationSeconds || 0), 0);
  const avgDurationSeconds = totalWithRuns > 0 ? Math.round(totalDuration / totalWithRuns) : 0;
  const successRate = totalWithRuns > 0 ? Math.round((successfulRuns / totalWithRuns) * 100) : 100;

  return {
    generatedAt,
    org: ORG,
    summary: {
      totalRepositories: repoStatuses.length,
      trackedPipelines: totalWithRuns,
      successful: successfulRuns,
      failed: failedRuns,
      inProgress: runningRuns,
      successRate,
      avgDurationSeconds,
      overallStatus: failedRuns > 0 ? "degraded" : runningRuns > 0 ? "running" : "healthy",
    },
    repositories: repoStatuses,
  };
}

/**
 * Saves status JSON to disk.
 */
export async function saveStatusSnapshot(outputDir = path.join(__dirname, "data")) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const data = await fetchCiCdStatus();
  const filePath = path.join(outputDir, "ci-status.json");
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  return { filePath, data };
}

// Standalone execution: CLI or HTTP server
if (process.argv[1] && process.argv[1].endsWith("fetch-status.mjs")) {
  const args = process.argv.slice(2);
  const isServe = args.includes("--serve");
  const portIndex = args.indexOf("--port");
  const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : 3000;

  if (isServe) {
    console.log("Fetching initial CI/CD status snapshot...");
    await saveStatusSnapshot();

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      // CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (url.pathname === "/api/status") {
        const jsonPath = path.join(__dirname, "data", "ci-status.json");
        if (fs.existsSync(jsonPath)) {
          const content = fs.readFileSync(jsonPath, "utf8");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(content);
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No status snapshot found" }));
        }
        return;
      }

      if (url.pathname === "/api/refresh" && (req.method === "POST" || req.method === "GET")) {
        try {
          const { data } = await saveStatusSnapshot();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // Serve static dashboard files
      let filePath = path.join(__dirname, url.pathname === "/" ? "index.html" : url.pathname);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, "index.html");
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json; charset=utf-8",
          ".svg": "image/svg+xml",
        };
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    server.listen(port, () => {
      console.log(`\n======================================================`);
      console.log(` Unhurried CI/CD Dashboard running at:`);
      console.log(` http://localhost:${port}`);
      console.log(` API Endpoint: http://localhost:${port}/api/status`);
      console.log(` Refresh API:  http://localhost:${port}/api/refresh`);
      console.log(`======================================================\n`);
    });
  } else {
    console.log("Fetching Unhurried CI/CD pipeline status from GitHub...");
    const { filePath, data } = await saveStatusSnapshot();
    console.log(`Snapshot saved to: ${filePath}`);
    console.log(`Tracked: ${data.summary.trackedPipelines} pipelines`);
    console.log(`Healthy: ${data.summary.successful} / ${data.summary.trackedPipelines} (${data.summary.successRate}%)`);
    console.log(`Average duration: ${data.summary.avgDurationSeconds}s`);
  }
}
