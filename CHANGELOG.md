# Changelog

## [1.1.0] - 2026-04-10

### New Features

- **runtime:** Upgrade action runtime from Node 22 to Node 24 and bump TypeScript compilation target to ES2022.

### Bug Fixes & Improvements

- **ci:** Add CI workflow (test, lint, format check on every push and PR), a dist-freshness check workflow, and Dependabot for automated weekly dependency updates.
- **tooling:** Add ESLint 9 (flat config), Prettier, and Husky + lint-staged pre-commit hooks for consistent code quality across contributions.
- **tooling:** Add changelog fragment system and release script that compiles fragments, bumps the version, rebuilds dist/, commits, and tags automatically.
