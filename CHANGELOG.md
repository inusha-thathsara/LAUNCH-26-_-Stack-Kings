# Changelog

All notable changes to this project are documented here. Version numbers follow [SemVer](https://semver.org/).

## [Unreleased]

### Added (Tier 3 — quality depth)

- Playwright E2E smoke suite (`e2e/relic.spec.ts`) and API integration tests
- Vitest coverage reporting in CI (`npm run test:coverage`)
- Frontend polish: real version badge, favicon/OG metadata, keyboard a11y on map, responsive layout, API retry UX
- Repo hygiene: Prettier, husky + lint-staged, Dependabot, MIT LICENSE, CONTRIBUTING.md
- TypeScript `noUncheckedIndexedAccess` enabled

## [0.1.0] - 2026-07-05

### Added

- Relic Ring Protocol engine: routing, latency, codex encoding, resilience
- Interactive telemetry dashboard at `/relic`
- REST API: `/api/universe`, `/api/transmit`, `/api/health`
- CLI demo (`npm run relic`)
- GitHub Actions CI (lint, typecheck, test, build, Docker)
- Optional Sentry observability and structured API logging
- Vercel deployment configuration
- Tier 3 quality: Playwright E2E, API integration tests, coverage reporting, Prettier/husky, Dependabot

[0.1.0]: https://github.com/inusha-thathsara/LAUNCH-26-_-Stack-Kings/releases/tag/v0.1.0
