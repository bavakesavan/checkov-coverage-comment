# Checkov Coverage Comment

A GitHub Action that parses [Checkov](https://www.checkov.io/) IaC scan results and posts them as a formatted pull request comment, grouped by severity.

---

## Table of Contents

- [What is Checkov?](#what-is-checkov)
- [Why use this Action?](#why-use-this-action)
- [Quick Start](#quick-start)
- [Full Workflow Example](#full-workflow-example)
- [Configuration](#configuration)
  - [Inputs](#inputs)
  - [Outputs](#outputs)
- [Comment Format](#comment-format)
- [Matrix Build Example](#matrix-build-example)
- [Permissions](#permissions)
- [Contributing](#contributing)
- [License](#license)

---

## What is Checkov?

[Checkov](https://www.checkov.io/) is an open-source static analysis tool for Infrastructure-as-Code (IaC). It scans Terraform, CloudFormation, Kubernetes, Dockerfiles, ARM templates, and more for security misconfigurations — checking against hundreds of policies covering cloud security, compliance frameworks (CIS, SOC 2, PCI-DSS), secrets detection, and supply chain integrity.

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
  uses: bridgecrewio/checkov-action@v3.2.521
  with:
    directory: .
    output_format: json
    output_file_path: results_json.json
  continue-on-error: true # prevent scan failures from blocking the comment step
```

### 2. Post the comment

```yaml
- name: Post Checkov comment
  uses: bavakesavan/checkov-coverage-comment@v1
```

> The action auto-detects the PR number from the workflow context. On non-PR triggers (e.g. `workflow_dispatch`) it falls back to writing results to the [Job Summary](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/adding-a-job-summary).

---

## Full Workflow Example

### Scan all files

```yaml
name: IaC Security Scan

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write # required to post comments

jobs:
  checkov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Run Checkov
        uses: bridgecrewio/checkov-action@v3.2.521
        with:
          directory: .
          output_format: json
          output_file_path: results_json.json
        continue-on-error: true

      - name: Post Checkov comment
        id: checkov_comment
        uses: bavakesavan/checkov-coverage-comment@v1
        with:
          severities: 'CRITICAL,HIGH,MEDIUM'
          soft-fail: false

      - name: Fail on critical findings
        if: steps.checkov_comment.outputs.critical > 0
        run: |
          echo "::error::${{ steps.checkov_comment.outputs.critical }} CRITICAL finding(s) found."
          exit 1
```

### Scan only files changed in the PR

Useful for large repositories where you want faster feedback and results scoped to what a PR actually touches.

```yaml
name: IaC Security Scan

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write # required to post comments

jobs:
  checkov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Get changed files
        id: changed
        run: |
          FILES=$(gh pr diff ${{ github.event.pull_request.number }} --name-only | tr '\n' ',')
          echo "files=$FILES" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Run Checkov on changed files
        uses: bridgecrewio/checkov-action@v3.2.521
        with:
          file: ${{ steps.changed.outputs.files }}
          output_format: json
          output_file_path: results_json.json
        continue-on-error: true

      - name: Post Checkov comment
        id: checkov_comment
        uses: bavakesavan/checkov-coverage-comment@v1
        with:
          severities: 'CRITICAL,HIGH,MEDIUM'
          soft-fail: false

      - name: Fail on critical findings
        if: steps.checkov_comment.outputs.critical > 0
        run: |
          echo "::error::${{ steps.checkov_comment.outputs.critical }} CRITICAL finding(s) found."
          exit 1
```

> **Note:** Checkov's `--file` flag accepts a comma-separated list of paths. The `gh pr diff --name-only` command lists every file touched by the PR, which is joined into that format here.

---

## Configuration

### Inputs

| Input                   | Required | Default                         | Description                                                                                                                                                                            |
| ----------------------- | -------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token`          | No       | `${{ github.token }}`           | GitHub token used to post or update the PR comment. The default uses the workflow's implicit token, which is sufficient in most cases.                                                  |
| `checkov-output-path`   | No       | `results_json.json`             | Path to the Checkov JSON output file. Can be relative to `GITHUB_WORKSPACE` or absolute.                                                                                               |
| `title`                 | No       | `Checkov Security Scan`         | Heading text for the PR comment.                                                                                                                                                       |
| `severities`            | No       | `CRITICAL,HIGH,MEDIUM,LOW,INFO` | Comma-separated list of severity levels to include in the detailed findings sections. Severities not in this list are still shown in the summary table but have no drill-down section. |
| `hide-passed`           | No       | `false`                         | Hide the `✅ Passed` count from the comment footer.                                                                                                                                    |
| `hide-skipped`          | No       | `false`                         | Hide the `⏭ Skipped` count from the comment footer.                                                                                                                                   |
| `soft-fail`             | No       | `false`                         | Exit with code `0` even when failed checks are present. Useful when you want to report findings without blocking the PR.                                                               |
| `create-new-comment`    | No       | `false`                         | Always create a new comment instead of updating the previous one from this action.                                                                                                     |
| `issue-number`          | No       | _(auto-detected)_               | Override the PR/issue number to comment on. Useful for `workflow_dispatch` or cross-PR workflows.                                                                                      |
| `unique-id-for-comment` | No       | `default`                       | Watermark identifier embedded in the comment. Change this to post multiple independent comments in the same PR, for example in a matrix build scanning different directories.          |

### Outputs

Use these in subsequent steps with `steps.<step-id>.outputs.<name>`:

| Output         | Description                                         |
| -------------- | --------------------------------------------------- |
| `critical`     | Number of CRITICAL severity failed checks           |
| `high`         | Number of HIGH severity failed checks               |
| `medium`       | Number of MEDIUM severity failed checks             |
| `low`          | Number of LOW severity failed checks                |
| `info`         | Number of INFO severity failed checks               |
| `total-failed` | Total number of failed checks across all severities |
| `total-passed` | Total number of passed checks                       |
| `comment-url`  | URL of the posted or updated PR comment. Not set on non-PR runs (job summary fallback). |

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

If the total comment length would exceed GitHub's 65,536-character limit, lower-priority severity sections are dropped from the detailed report (INFO first, then LOW, MEDIUM, and so on) and a truncation notice is added. The summary table is always preserved.

---

## Matrix Build Example

To scan multiple Terraform workspaces in parallel and post a separate comment for each:

```yaml
strategy:
  matrix:
    workspace: [prod, staging, dev]

steps:
  - name: Run Checkov for ${{ matrix.workspace }}
    uses: bridgecrewio/checkov-action@v3.2.521
    with:
      directory: environments/${{ matrix.workspace }}
      output_format: json
      output_file_path: results_${{ matrix.workspace }}.json
    continue-on-error: true

  - name: Post comment for ${{ matrix.workspace }}
    uses: bavakesavan/checkov-coverage-comment@v1
    with:
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

## Contributing

### Prerequisites

- Node.js 24+
- npm 10+

### Setup

```bash
git clone https://github.com/bavakesavan/checkov-coverage-comment.git
cd checkov-coverage-comment
npm install        # installs dependencies and sets up Git hooks via Husky
```

### Development workflow

| Command                | What it does                                                               |
| ---------------------- | -------------------------------------------------------------------------- |
| `npm run build`        | Compiles TypeScript → `lib/`, then bundles everything into `dist/` via NCC |
| `npm test`             | Runs the Vitest test suite                                                 |
| `npm run lint`         | Runs ESLint over `src/` and `__tests__/`                                   |
| `npm run lint:fix`     | Same as above but auto-fixes what it can                                   |
| `npm run format`       | Reformats all files with Prettier                                          |
| `npm run format:check` | Checks formatting without writing (used in CI)                             |

The pre-commit hook (Husky + lint-staged) runs ESLint and Prettier automatically on staged `.ts` files before each commit. To skip it in an emergency: `HUSKY=0 git commit`.

### Running tests

```bash
npm test
```

Tests live in [`__tests__/`](__tests__/) alongside their fixtures. The test runner is [Vitest](https://vitest.dev/). All tests must pass before a PR is merged.

### Linting and formatting

```bash
npm run lint          # check for lint errors
npm run lint:fix      # auto-fix lint errors
npm run format        # reformat all files
npm run format:check  # verify formatting (same as CI)
```

ESLint config: [`eslint.config.mjs`](eslint.config.mjs)  
Prettier config: [`.prettierrc`](.prettierrc)

### Keeping `dist/` up to date

The `dist/` bundle is committed to the repository — this is how GitHub Actions loads the code at runtime. **Always run `npm run build` and commit the result before opening a PR.** The [check-dist workflow](.github/workflows/check-dist.yml) will fail any PR where `dist/` is out of sync with `src/`.

```bash
npm run build
git add dist/
git commit -m "chore: rebuild dist"
```

### Changelog fragments

This project uses a fragment-based changelog. Instead of editing `CHANGELOG.md` directly, each PR adds a small file to [`changelogs/`](changelogs/).

**File location and name:**

```
changelogs/{short-description}.md
```

**File format** — YAML frontmatter followed by the description:

```markdown
---
type: minor
scope: action
---

Add support for SARIF output format alongside the existing JSON parser.
```

**`type`** (required):

| Value   | When to use                                               |
| ------- | --------------------------------------------------------- |
| `patch` | Bug fixes, dependency updates, documentation              |
| `minor` | New features, new inputs/outputs                          |
| `major` | Breaking changes to existing inputs, outputs, or behavior |

**`scope`** (optional): a short label for the area of the project (e.g. `runtime`, `ci`, `tooling`, `action`, `parser`). Shown in parentheses in the compiled changelog.

**Examples:**

```
changelogs/fix-null-severity-crash.md
changelogs/add-sarif-output-support.md
```

### Releasing

Releases are cut by a maintainer using the release script, which compiles all pending fragments, bumps the version, rebuilds `dist/`, and creates the git tags.

**Locally:**

```bash
node scripts/release.mjs
# Follow the printed instructions to push
```

**Via GitHub Actions** (preferred):

1. Go to **Actions → Release → Run workflow**
2. The workflow compiles fragments, bumps the version, rebuilds `dist/`, commits, and pushes `v1.x.x` + the floating `v1` tag automatically

The release type (patch / minor / major) is determined automatically from the highest fragment type present in `changelogs/fragments/`. The release fails if there are no fragments.

---

## License

MIT
