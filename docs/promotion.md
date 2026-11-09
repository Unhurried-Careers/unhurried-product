# Promotion criteria

What has to be true before a change moves from `dev` to `staging`, and from `staging` to `main` (production). [CI/CD](ci-cd.md) explains how the pipelines run; this document decides when a change is ready to go through them.

## Environments

| Environment | Branch | Address | Google Cloud project | Purpose |
| --- | --- | --- | --- | --- |
| Dev | `dev` | https://dev.unhurried-careers.com | `unhurried-dev` | Every change lands here first and is checked in a deployed environment |
| Staging | `staging` | https://staging.unhurried-careers.com | `unhurried-staging` | A release candidate is tested as a whole and left to run before production |
| Production | `main` | https://unhurried-careers.com | `project-191091d4-b2e5-4294-9e7` | Real users and real data |

A push to an environment's branch deploys it: Cloud Build triggers in each project fire only on that project's branch.

## Principles

1. **One codebase, three sets of values.** `envs/dev`, `envs/staging`, and `envs/prod` in `unhurried-infra` have identical `main.tf`, `variables.tf`, and `versions.tf`; only `settings.auto.tfvars` and the gitignored `terraform.tfvars` differ. Code that behaves differently per environment gets a variable with a value in every environment, never a branch-specific edit.
2. **Promote by merging only.** Merge `dev` into `staging`, then `staging` into `main`. No commits go directly to `staging` or `main`, hotfixes included.
3. **Production runs what staging verified.** Merge `staging` into `main` without adding commits, so production deploys the same commits staging ran. If anything lands on `staging` after testing, the staging gate starts over.
4. **Promote every changed repository, in dependency order:** `unhurried-common` → the Go services → `unhurried-infra` → `unhurried-web` → `unhurried-extension`. `unhurried-infra`'s spec-sync check reads each service's `openapi.yaml` from the same branch, so services go first.
5. **Google credentials stay separate; shared vendor accounts are copied.** Each environment has its own Google OAuth client, OAuth client secret, and reCAPTCHA key. Resend (`unhurried-smtp-password`) and Adzuna (`unhurried-adzuna-app-id`, `unhurried-adzuna-app-key`) use the same values in every environment.
6. **The release owner signs off each gate.** Until there is a team, that is Mohammad. Sign-off is recorded by ticking the checklist in the promotion pull request.

## Gate 1: dev to staging

The change is complete and works when deployed, not just locally.

### Required

| Area | Criterion | How to check |
| --- | --- | --- |
| CI | GitHub Actions is green on the latest `dev` commit of every repository being promoted. This covers formatting, vet, race tests, coverage thresholds (web 85% lines and 75% branches, extension 90% lines), `govulncheck`, `npm audit`, Terraform tests, and spec sync | Repository Actions tab, or the [CI/CD dashboard](../dashboard/) |
| Deploy | Every dev Cloud Build trigger for those commits succeeded, every Cloud Deploy rollout `SUCCEEDED`, and every Cloud Run service is Ready | [Verification commands](#verification-commands) |
| Infrastructure | The dev `unhurried-infra-apply` build succeeded, and the next apply reports `No changes` (nothing drifted or half-applied) | Cloud Build log for `unhurried-infra-apply` |
| Function | The change works end to end on https://dev.unhurried-careers.com, and the [smoke test](#smoke-test) passes | Manual |
| Structure | `envs/*/main.tf`, `variables.tf`, and `versions.tf` are still identical across the three environments | `diff envs/dev/main.tf envs/staging/main.tf && diff envs/staging/main.tf envs/prod/main.tf` (same for the other two files) |
| New settings | Every new Terraform variable has a value, or a deliberate default, in all three `settings.auto.tfvars` | Review the `unhurried-infra` diff |
| New secrets | Every new secret has an enabled version in **staging** Secret Manager before the merge, and the service account that reads it has `roles/secretmanager.secretAccessor`. Cloud Run refuses a revision whose secret it cannot read | `gcloud secrets versions list <secret> --project=unhurried-staging` |
| API contracts | A changed `openapi.yaml` is copied into `unhurried-infra/gateway-specs/`, and the web app handles both the old and new API during the rollout | `unhurried-infra` spec-sync CI |
| Data | Firestore changes are backward compatible: new code reads documents written by old code, and nothing deletes or rewrites existing data without a written migration | Code review |
| Google sign-in | If the change uses a new OAuth scope or redirect, staging's OAuth client and consent screen are updated, and test users are listed while the consent screen is in Testing mode | Google Auth Platform in the `unhurried-staging` project |
| Docs | [Status](status.md), [codebase](codebase.md), or [CI/CD](ci-cd.md) is updated when behavior, configuration, or a runbook changed | Review |

### Allowed to carry forward

Minor known issues that do not affect sign-in, data, or security may move to staging if each has a written entry under [Known gaps](status.md#known-gaps).

## Gate 2: staging to production

Confidence that the release is safe for real users and real data.

### Required

Everything in Gate 1, re-checked on staging, plus:

| Area | Criterion | How to check |
| --- | --- | --- |
| Same commits | Staging runs exactly the commits that will merge into `main`, and nothing landed on `staging` after testing began | `git log origin/main..origin/staging` in each repository matches the tested commits |
| Soak | At least 24 hours on staging, including one 07:00 Central job-search scan and its digest email | Cloud Scheduler run history and the digest in the inbox |
| Regression | The full [smoke test](#smoke-test) passes on https://staging.unhurried-careers.com, not only the parts the change touched | Manual |
| Errors | No new `ERROR` entries in staging Cloud Logging since the rollout | [Verification commands](#verification-commands) |
| Production plan | The production Terraform plan was run and read before the merge. Any change to `envs/prod` behavior, and any destroy or replace of Firestore, KMS keys, secrets, Identity Platform, or API Gateway, needs an explicit written OK. `unhurried-infra-apply` plans and applies in one step, so there is no review after merging | [Production plan](#production-plan) |
| Production secrets | Every new secret has an enabled version in production Secret Manager, with access granted to the service account that reads it | `gcloud secrets versions list <secret> --project=project-191091d4-b2e5-4294-9e7` |
| Rollback | The rollback for each promoted repository is known ([CI/CD → Roll back](ci-cd.md#roll-back)). A change that a revert cannot undo, such as deleting data or destroying a KMS key, has a written recovery plan | Note in the pull request |
| Extension | If `manifest.json` permissions changed, a Chrome Web Store review is expected before users get the update | Review the `unhurried-extension` diff |
| Timing | Someone can watch production for an hour after the merge | — |

### Blocking at this gate

Unlike Gate 1, nothing affecting sign-in, data integrity, security, or email moves to production as a known issue.

## After a production release

1. Every production Cloud Build trigger succeeded and every Cloud Deploy rollout `SUCCEEDED`, including its `VERIFY` phase.
2. The [smoke test](#smoke-test) passes on https://unhurried-careers.com.
3. Production Cloud Logging shows no new `ERROR` entries for an hour.
4. If something is wrong, roll back first ([CI/CD → Roll back](ci-cd.md#roll-back)) and fix on `dev`; fix forward only when the fix is a one-line change that is obvious.

## Hotfixes

A production fix still goes `dev` → `staging` → `main`, with the gates shortened rather than skipped:

- Gate 1: CI green, dev deploy green, and the fix confirmed on dev.
- Gate 2: the fix confirmed on staging after at least one hour on staging, the production plan read, and sign-off.

## Smoke test

Run on the environment being promoted to, signed in with an allowlisted account:

- [ ] The homepage loads, and Google sign-in completes on that environment's own address
- [ ] A non-allowlisted account is refused
- [ ] Start from a job: search by role and location returns postings, including Adzuna results
- [ ] Start from a job: pasting a posting link fills in the company, role, and description
- [ ] Direction: add a target company and role with a reason
- [ ] Research: the AI summary appears with sources
- [ ] Opportunity: move one stage forward with a reason
- [ ] Resume studio: open the master resume and make a copy for an opportunity
- [ ] AI resume rewriting: preview edits for a job description
- [ ] Google Calendar: the connection succeeds, or still shows as connected, and interviews are listed
- [ ] Settings: change the email digest preference and save
- [ ] Extension: with **Settings → Unhurried address** set to that environment, the popup lists opportunities whose resume is ready

## Verification commands

Set `PROJECT` to `unhurried-dev`, `unhurried-staging`, or `project-191091d4-b2e5-4294-9e7`.

```bash
# Latest builds and their status
gcloud builds list --project=$PROJECT --region=us-central1 --limit=15 \
  --format="table(createTime.date(),substitutions.TRIGGER_NAME,substitutions.SHORT_SHA,status)"

# Latest release of each service
for s in unhurried-applications unhurried-inbox unhurried-job-search unhurried-notifications unhurried-resume; do
  gcloud deploy releases list --delivery-pipeline=$s --project=$PROJECT --region=us-central1 --limit=1 \
    --format="value(name.basename(),renderState)"
done

# Cloud Run services that are not Ready
gcloud run services list --project=$PROJECT --region=us-central1 \
  --format="table(metadata.name,status.conditions[0].status,status.latestReadyRevisionName)"

# Errors in the last 24 hours
gcloud logging read 'severity>=ERROR' --project=$PROJECT --freshness=24h --limit=50 \
  --format="table(timestamp,resource.labels.service_name,textPayload)"
```

## Production plan

Run from `unhurried-infra` on the `staging` branch, which is what `main` will become, with `envs/prod/terraform.tfvars` in place:

```bash
export PROJECT=project-191091d4-b2e5-4294-9e7
export TF_VAR_smtp_password="$(gcloud secrets versions access latest --secret=unhurried-smtp-password --project=$PROJECT)"
terraform -chdir=envs/prod init -reconfigure -backend-config="bucket=$PROJECT-tfstate" -backend-config="prefix=prod"
terraform -chdir=envs/prod plan -lock=false
unset TF_VAR_smtp_password
```

Without `TF_VAR_smtp_password`, the plan shows the SMTP password being removed from `unhurried-notifications`; that is the local run missing the secret, not a real change. Do not run `apply` locally: production applies only through `unhurried-infra-apply` after the merge.

## Promotion pull request checklist

Open the promotion as a pull request in each repository, and paste the matching checklist into its description.

**`dev` into `staging`**

```markdown
- [ ] CI green on the latest dev commit
- [ ] Dev builds and rollouts succeeded; services Ready; infra apply clean
- [ ] Change verified on dev.unhurried-careers.com; smoke test passed
- [ ] Environment structure still identical; new settings in all three settings files
- [ ] New secrets exist in staging with access granted
- [ ] API and data changes backward compatible; gateway specs synced
- [ ] Docs updated
```

**`staging` into `main`**

```markdown
- [ ] Staging runs exactly the commits being merged
- [ ] 24 hours on staging, including a 07:00 scan and digest
- [ ] Full smoke test passed on staging.unhurried-careers.com
- [ ] No new errors in staging logs
- [ ] Production Terraform plan read; destructive changes approved in writing
- [ ] New secrets exist in production with access granted
- [ ] Rollback known; recovery plan for anything a revert cannot undo
- [ ] Extension permission changes accounted for
- [ ] Someone can watch production for an hour
```
