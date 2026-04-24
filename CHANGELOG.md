# Changelog

## [1.3.0] - 2026-04-24

### New Features

- **policies:** Automatically refresh `data/policies.json` from the upstream prisma-cloud-docs repo on every release, ensuring policy metadata stays current without manual updates. Also fixed the policy extractor to capture 60 previously missed policies that used the `Checkov Check ID` field label variant (primarily secrets and Alibaba policies).

### Bug Fixes & Improvements

- **action:** Fix markdown escaping in PR comment tables to handle `*`, `_`, `` ` ``, `[`, and `]` in addition to `|`, preventing rendering corruption when check names or resource identifiers contain these characters.
- **parser:** Preserve the original `SyntaxError` message when Checkov JSON parsing fails, so the error reported to the user includes the specific parse failure reason rather than a generic message.
- **tests:** Add test coverage for `github.ts` (comment upsert, pagination, PR number detection), `index.ts` (severity filtering, soft-fail logic, outputs, error handling), and `severity.ts` (policy lookup). Also expand `format.test.ts` with escapeMarkdown and comment truncation tests.

## [1.2.4] - 2026-04-23

### Bug Fixes & Improvements

- **ci:** Fix release workflow failing on `gh release create` by replacing the unsupported `--make-latest true` with `--latest`.

## [1.2.3] - 2026-04-21

### Bug Fixes & Improvements

- **ci:** Create an immutable GitHub Release for each exact version tag.

## [1.2.2] - 2026-04-17

### Bug Fixes & Improvements

- **ci:** Split release into two stages: `release.yml` opens a PR instead of pushing directly to main; `tag-release.yml` pushes version and floating major tags on merge.
- **docs:** Update README workflow examples to use `actions/checkout@v6` and add a "scan only PR-changed files" example.

## [1.2.1] - 2026-04-14

### Bug Fixes & Improvements

- **ci:** Fix release workflow failing to push the floating major tag by splitting into separate push commands — `--force-with-lease` for the branch and `--force` for tags.

## [1.2.0] - 2026-04-10

### New Features

- **action:** Expose per-severity failed check counts (`critical`, `high`, `medium`, `low`, `info`), `total-failed`, `total-passed`, and `comment-url` as step outputs for use in downstream gate logic.
- **comment:** Automatically truncate lower-priority severity sections when the comment would exceed GitHub's 65,536 character limit, adding a notice when truncation occurs.
- **action:** Add `severities`, `hide-passed`, `hide-skipped`, `soft-fail`, and `issue-number` inputs for filtering output, controlling workflow failure behaviour, and supporting non-PR triggers such as `workflow_dispatch`.
- **action:** Add `unique-id-for-comment` input to post multiple independent comments in the same PR, for example one per workspace or region in a matrix build.
- **parser:** Support multi-runner Checkov output (JSON array or concatenated objects) and fall back to writing results to the GitHub Actions Job Summary when no PR context is available.
- **action:** Post Checkov IaC scan results as a PR comment with a severity summary table and collapsible per-severity sections showing check ID, description, affected resource, and file location.
- **parser:** Look up severity from bundled Checkov policy data for checks that do not include an explicit severity field in their JSON output.
- **action:** Update the existing PR comment on re-runs instead of creating duplicates, using a watermark embedded in the comment body.

### Bug Fixes & Improvements

- **tooling:** Redesign changelog fragment format: files now live at changelogs/{slug}.md with YAML frontmatter for type and scope instead of encoding the type in the filename.

## [1.1.0] - 2026-04-10

### New Features

- **runtime:** Upgrade action runtime from Node 22 to Node 24 and bump TypeScript compilation target to ES2022.

### Bug Fixes & Improvements

- **ci:** Add CI workflow (test, lint, format check on every push and PR), a dist-freshness check workflow, and Dependabot for automated weekly dependency updates.
- **tooling:** Add ESLint 9 (flat config), Prettier, and Husky + lint-staged pre-commit hooks for consistent code quality across contributions.
- **tooling:** Add changelog fragment system and release script that compiles fragments, bumps the version, rebuilds dist/, commits, and tags automatically.
