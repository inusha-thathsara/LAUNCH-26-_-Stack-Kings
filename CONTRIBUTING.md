# Contributing to Relic Ring Protocol

Thank you for contributing to Stack Kings' LAUNCH 26 project.

## Development setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000/relic](http://localhost:3000/relic) for the telemetry dashboard.

## Before opening a pull request

Run the full verification suite:

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

For UI changes, also run:

```bash
npx playwright install chromium
npm run test:e2e
```

## Branch workflow

1. Branch from `main` (or continue on `inusha-dev` for team work).
2. Keep commits focused and descriptive.
3. Push to `inusha-dev`, then open a PR into `main` — CI must pass before merge.
4. Production deploys from `main` via Vercel (`relic.inusha.me`).

## Environment variables

See [`.env.example`](.env.example) for optional settings (Sentry, site URL, universe config path).
Never commit `.env` — only `.env.example` is tracked.

## Code style

- Match existing TypeScript and React patterns in `src/`.
- Run `npm run format` before committing (enforced via husky + lint-staged).
- Prefer focused diffs — avoid unrelated refactors in the same PR.

## Tests

- **Unit tests:** `src/**/*.test.ts` (Vitest)
- **API integration:** `src/**/*.integration.test.ts`
- **E2E smoke:** `e2e/` (Playwright)

Add or update tests when changing engine logic, API contracts, or dashboard behavior.

## Reporting issues

Include steps to reproduce, expected vs actual behavior, and relevant logs or screenshots.
