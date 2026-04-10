# Checkov Coverage Comment

A GitHub Action that parses [Checkov](https://www.checkov.io/) IaC scan results and posts them as a formatted pull request comment, grouped by severity.

---

## What is Checkov?

[Checkov](https://www.checkov.io/) is an open-source static analysis tool for Infrastructure-as-Code (IaC). It scans Terraform, CloudFormation, Kubernetes, Dockerfiles, ARM templates, and more for security misconfigurations before they reach production.

Checkov checks against hundreds of built-in policies covering:

- **Cloud security** — S3 bucket exposure, unrestricted security groups, unencrypted storage, public IAM policies
- **Compliance** — CIS Benchmarks, SOC 2, PCI-DSS, HIPAA, NIST controls
- **Secrets detection** — hardcoded credentials and API keys
- **Supply chain** — pinned versions, signed images, integrity checks

---

## Why use this Action?

Running Checkov in CI is valuable, but reading raw JSON output is painful. This Action bridges that gap:

- **Visibility** — findings appear directly in the PR where engineers are already reviewing code, not buried in a log file
- **Severity grouping** — results are organized by CRITICAL → HIGH → MEDIUM → LOW → INFO so the most important issues surface first
- **Noise control** — filter which severity levels appear in the comment; hide passed/skipped counts
- **Smart updates** — re-running the workflow updates the existing comment rather than flooding the PR with new ones
- **Actionable outputs** — exposes per-severity counts and a `total-failed` count for downstream gate logic
- **Soft-fail mode** — decouple reporting from CI failure so you can observe before enforcing
- **Matrix build support** — post multiple separate comments (e.g. one per cloud region or Terraform workspace) using `unique-id-for-comment`

---

## Quick Start

### 1. Run Checkov with JSON output

Use the official [checkov-action](https://github.com/bridgecrewio/checkov-action) (or run Checkov directly) and write results to a JSON file:

```yaml
- name: Run Checkov
  uses: bridgecrewio/checkov-action@master
  with:
    directory: .
    output_format: json
    output_file_path: results_json.json
  continue-on-error: true   # prevent scan failures from blocking the comment step
```

### 2. Post the comment

```yaml
- name: Post Checkov comment
  uses: bavakesavan/checkov-coverage-comment@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

> The action auto-detects the PR number from the workflow context. On non-PR triggers (e.g. `workflow_dispatch`) it falls back to writing results to the [Job Summary](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/adding-a-job-summary).

---

## Full Workflow Example

```yaml
name: IaC Security Scan

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write   # required to post comments

jobs:
  checkov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Checkov
        uses: bridgecrewio/checkov-action@master
        with:
          directory: .
          output_format: json
          output_file_path: results_json.json
        continue-on-error: true

      - name: Post Checkov comment
        id: checkov_comment
        uses: bavakesavan/checkov-coverage-comment@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          severities: 'CRITICAL,HIGH,MEDIUM'
          soft-fail: false

      - name: Fail on critical findings
        if: steps.checkov_comment.outputs.critical > 0
        run: |
          echo "::error::${{ steps.checkov_comment.outputs.critical }} CRITICAL finding(s) found."
          exit 1
```

---

## Configuration

### Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `github-token` | Yes | — | GitHub token used to post or update the PR comment. Use `${{ secrets.GITHUB_TOKEN }}`. |
| `checkov-output-path` | No | `results_json.json` | Path to the Checkov JSON output file. Can be relative to `GITHUB_WORKSPACE` or absolute. |
| `title` | No | `Checkov Security Scan` | Heading text for the PR comment. |
| `severities` | No | `CRITICAL,HIGH,MEDIUM,LOW,INFO` | Comma-separated list of severity levels to include in the detailed findings sections. Severities not in this list are still shown in the summary table but have no drill-down section. |
| `hide-passed` | No | `false` | Hide the `✅ Passed` count from the comment footer. |
| `hide-skipped` | No | `false` | Hide the `⏭ Skipped` count from the comment footer. |
| `soft-fail` | No | `false` | Exit with code `0` even when failed checks are present. Useful when you want to report findings without blocking the PR. |
| `create-new-comment` | No | `false` | Always create a new comment instead of updating the previous one from this action. |
| `issue-number` | No | *(auto-detected)* | Override the PR/issue number to comment on. Useful for `workflow_dispatch` or cross-PR workflows. |
| `unique-id-for-comment` | No | `default` | Watermark identifier embedded in the comment. Change this to post multiple independent comments in the same PR, for example in a matrix build scanning different directories. |

### Outputs

Use these in subsequent steps with `steps.<step-id>.outputs.<name>`:

| Output | Description |
|---|---|
| `critical` | Number of CRITICAL severity failed checks |
| `high` | Number of HIGH severity failed checks |
| `medium` | Number of MEDIUM severity failed checks |
| `low` | Number of LOW severity failed checks |
| `info` | Number of INFO severity failed checks |
| `total-failed` | Total number of failed checks across all severities |
| `total-passed` | Total number of passed checks |
| `comment-url` | URL of the posted or updated PR comment |

---

## Comment Format

The posted comment includes:

- A **summary table** showing failed check counts per severity level
- A footer with passed, skipped, and parsing error counts
- **Collapsible sections** per severity, each containing a table of:
  - Check ID (e.g. `CKV_AWS_18`)
  - Check name / description
  - Affected resource
  - File path and line range

If the total comment length would exceed GitHub's 65,536-character limit, lower-priority severity sections are dropped and a truncation notice is added.

---

## Matrix Build Example

To scan multiple Terraform workspaces in parallel and post a separate comment for each:

```yaml
strategy:
  matrix:
    workspace: [prod, staging, dev]

steps:
  - name: Run Checkov for ${{ matrix.workspace }}
    uses: bridgecrewio/checkov-action@master
    with:
      directory: environments/${{ matrix.workspace }}
      output_format: json
      output_file_path: results_${{ matrix.workspace }}.json
    continue-on-error: true

  - name: Post comment for ${{ matrix.workspace }}
    uses: bavakesavan/checkov-coverage-comment@main
    with:
      github-token: ${{ secrets.GITHUB_TOKEN }}
      checkov-output-path: results_${{ matrix.workspace }}.json
      title: 'Checkov — ${{ matrix.workspace }}'
      unique-id-for-comment: ${{ matrix.workspace }}
```

---

## Permissions

The workflow job needs write access to pull requests:

```yaml
permissions:
  contents: read
  pull-requests: write
```

---

## License

MIT
