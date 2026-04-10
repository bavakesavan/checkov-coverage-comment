# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-08

### Added
- Initial release
- Post Checkov IaC scan results as a PR comment, grouped by severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- Severity summary table with failed check counts
- Collapsible per-file details sections with check tables sorted by severity
- Smart comment upsert — updates existing comment on re-runs instead of creating duplicates
- `unique-id-for-comment` input for separate comments in matrix builds
- `severities` input to filter which severity levels appear in the comment
- `hide-passed` and `hide-skipped` inputs to suppress footer counts
- `soft-fail` input to prevent the action from failing the workflow
- `issue-number` input to support `workflow_dispatch` and other non-PR triggers
- Fallback to GitHub Actions Job Summary when no PR context is found
- Automatic comment truncation at GitHub's 65,536 character limit
- Supports multi-runner Checkov output (multiple JSON objects or a JSON array)
- Severity lookup from bundled policy data for checks missing a severity field
- Outputs: `critical`, `high`, `medium`, `low`, `info`, `total-failed`, `total-passed`, `comment-url`
