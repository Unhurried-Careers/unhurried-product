import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function generateDashboardMarkdown(statusData) {
  const sum = statusData.summary || {};
  const repos = statusData.repositories || [];
  const genDate = new Date(statusData.generatedAt || Date.now());

  let md = `## 🚀 Unhurried CI/CD Pipeline Status Dashboard\n\n`;
  md += `> **Global Status:** ${sum.overallStatus === "healthy" ? "🟢 **All Pipelines Operational (100% Green)**" : sum.overallStatus === "running" ? "🟡 **Workflows In Progress**" : "🔴 **Degraded Pipelines**"}  \n`;
  md += `> **Last Synchronized:** \`${genDate.toUTCString()}\`  \n`;
  md += `> **Security Boundary:** Pure Continuous Integration (GitHub Actions) with \`permissions: contents: read\` · Zero Google Cloud secrets in GitHub\n\n`;

  // Summary Metrics Table
  md += `### 📊 Health & Reliability Summary\n\n`;
  md += `| Total Repositories | Tracked CI Pipelines | Passing on \`main\` | Success Rate | Average Runtime | Security Model |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| **${sum.totalRepositories || 10}** | **${sum.trackedPipelines || 9}** | **${sum.successful || 9} / ${sum.trackedPipelines || 9}** | **${sum.successRate ?? 100}%** | **${Math.floor((sum.avgDurationSeconds || 0)/60)}m ${(sum.avgDurationSeconds || 0)%60}s** | **Zero GCP Keys** |\n\n`;

  // Repositories Matrix Table
  md += `### 🛠 Pipeline Matrix\n\n`;
  md += `| Status | Service | Role | Target | Branch | Commit | Duration | Workflow Run |\n`;
  md += `| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: |\n`;

  for (const r of repos) {
    const run = r.latestRun;
    const icon = !run ? "⚪" : run.conclusion === "success" ? "🟢" : run.conclusion === "failure" ? "🔴" : "🟡";
    const statusText = !run ? "Docs" : run.conclusion === "success" ? "Passing" : run.conclusion === "failure" ? "Failed" : "Running";
    const branch = run ? `\`${run.branch}\`` : "`-`";
    const shaLink = run ? `[\`${run.commitSha}\`](${r.repoUrl}/commit/${run.fullSha})` : "`-`";
    const dur = run ? `${Math.floor(run.durationSeconds / 60)}m ${run.durationSeconds % 60}s` : "`-`";
    const runLink = run ? `[Run #${run.id} ↗](${run.url})` : `[View Repo ↗](${r.repoUrl})`;

    md += `| ${icon} **${statusText}** | [**${r.displayName}**](${r.repoUrl})<br/>\`${r.name}\` | ${r.role} | \`${r.target}\` | ${branch} | ${shaLink} | ${dur} | ${runLink} |\n`;
  }

  // Deep Step Inspection Details
  md += `\n### 🔍 Deep Step-by-Step CI Verifications\n\n`;
  for (const r of repos) {
    if (!r.latestRun || !r.runDetails || !r.runDetails.jobs) continue;
    md += `<details>\n<summary><b>${r.displayName} (${r.name})</b> — Latest Run #${r.latestRun.id} (<code>${r.latestRun.commitSha}</code>) — <i>${r.latestRun.commitTitle}</i></summary>\n\n`;
    for (const job of r.runDetails.jobs) {
      md += `**Job:** \`${job.name}\` (${job.conclusion})\n\n`;
      md += `| Step | Status |\n| :--- | :---: |\n`;
      for (const step of (job.steps || [])) {
        const stepIcon = step.conclusion === "success" ? "✓" : step.conclusion === "failure" ? "✕" : "•";
        md += `| ${step.name} | ${stepIcon} \`${step.conclusion || step.status}\` |\n`;
      }
      md += `\n`;
    }
    md += `</details>\n\n`;
  }

  return md;
}

// Standalone execution
if (process.argv[1] && process.argv[1].endsWith("generate-markdown-dashboard.mjs")) {
  const jsonPath = path.join(__dirname, "data", "ci-status.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("No ci-status.json found at:", jsonPath);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const md = generateDashboardMarkdown(data);

  // If GITHUB_STEP_SUMMARY is set in GitHub Actions, write to it
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md, "utf8");
    console.log("Appended dashboard to GITHUB_STEP_SUMMARY");
  }

  // Update README.md in unhurried-product
  const readmePath = path.join(__dirname, "..", "README.md");
  if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, "utf8");
    const startTag = "<!-- CI_STATUS_START -->";
    const endTag = "<!-- CI_STATUS_END -->";
    if (readme.includes(startTag) && readme.includes(endTag)) {
      const before = readme.substring(0, readme.indexOf(startTag) + startTag.length);
      const after = readme.substring(readme.indexOf(endTag));
      readme = `${before}\n\n${md}\n${after}`;
      fs.writeFileSync(readmePath, readme, "utf8");
      console.log("Updated README.md CI status section");
    }
  }

  // Output to stdout if --print
  if (process.argv.includes("--print")) {
    console.log(md);
  }
}
