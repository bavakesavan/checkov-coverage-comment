# Changelog

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
