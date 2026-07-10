# SpendWise

SpendWise is an offline-first personal finance web app. It stores the core ledger in the browser with IndexedDB and provides transaction, category, budget, savings-goal, reporting, comparison, import/export, quick-add, and optional Gmail-assisted card-transaction workflows.

## What it does

- Records income and expenses with categories, dates, notes, tags, and account metadata.
- Shows monthly totals, category distribution, trends, daily averages, reports, and month-to-month comparisons.
- Manages category budgets, savings goals, and reusable quick-add presets.
- Imports supported card-statement Excel files with preview, duplicate detection, and opt-in updates of modified rows.
- Exports transactions to CSV or Excel and reports to PDF.
- Creates and restores a versioned JSON backup of transactions, categories, budgets, presets, goals, and settings. Restore validates the complete payload before an atomic IndexedDB replacement; supported browsers can also write backups to a user-selected local file.
- Optionally reads matching messages through Google OAuth and the read-only Gmail scope to import card transactions.
- Runs as an installable PWA under the `/spendwise/` GitHub Pages base path.

Categorization is deterministic and history-assisted: it uses category keywords and learned merchant mappings. It is not a machine-learning model. The recurring flag is stored on transactions; SpendWise does not currently generate future recurring transactions automatically.

## Privacy and data boundaries

The ledger is stored locally in IndexedDB. SpendWise has no analytics or telemetry integration. Optional Gmail sync is an explicit exception to purely local operation: after the user supplies a Google client ID and authorizes the app, it requests Gmail data using `gmail.readonly`. The short-lived access token is kept in `sessionStorage`; Gmail settings remain in local storage. Disconnecting clears the token.

Browser storage can be cleared by the browser, private-mode lifecycle, or the user. Keep an external JSON/Excel backup for important data. SpendWise has no server-side account, cloud backup, or multi-device sync.

## Requirements and local development

- Node.js 20.19 or newer
- npm 11 (the expected version is declared in `package.json`)

```bash
npm ci
npm run dev
```

`npm ci` enables the repository's privacy commit hooks unless a custom `core.hooksPath`
already exists, in which case it prints integration instructions without replacing it. The
hooks reject real e-mail addresses in staged filenames, text and visible binary strings, and
commit messages or Git ref names. They require the effective Git author, committer, and annotated-tag identity
to use GitHub `noreply`, including environment and `--author` overrides. The pre-push hook and
CI inspect every new commit tree plus its message and metadata before publication or deploy.

The development URL is normally `http://localhost:5173/spendwise/`.

## Quality gates

```bash
npm run test:run       # unit and integration tests
npm run test:coverage  # enforced 70% global thresholds
npm run check:privacy  # rejects real e-mails in tracked publishable files
npm run test:privacy   # verifies identity, history, filename, log, and tag defenses
npm run lint
npm run build
npm run verify:build   # verifies HTML and manifest assets exist
npm run check          # complete local/CI gate
npm run typecheck:e2e  # type-check Playwright tests
npm run test:e2e       # build + Chromium E2E/axe/PWA/CSP suite
npm run check:all      # unit, build, and browser gates
npm audit
```

The production output is written to `dist/`. `npm run preview` serves that build locally. GitHub Pages deployment runs the complete `npm run check` gate before publishing.

## Architecture

- `src/App.tsx`: application shell, query-string navigation, theme, keyboard shortcuts, lazy page loading, and automatic local-file backup trigger.
- `src/components/`: dashboard and all interactive pages/forms.
- `src/components/Dialog.tsx`: shared native modal primitive with focus, Escape, backdrop, busy-state, and scroll-lock handling.
- `src/db/database.ts`: Dexie schema, seed data, persistence CRUD, and financial invariants.
- `src/services/analytics.ts`: totals, breakdowns, trends, and report data.
- `src/services/comparison.ts`: month comparison and generated insights.
- `src/services/classifier.ts`: keyword/history categorization.
- `src/services/importer.ts`: Excel preview/import and CSV/Excel export.
- `src/services/gmailSync.ts` and `cardEmailParser.ts`: optional Gmail boundary and card-email parsing.
- `src/services/backup.ts`: versioned backup creation, migration, strict validation, and atomic restore.
- `src/hooks/useLocalBackup.ts`: File System Access API integration.
- `src/hooks/usePageRoute.ts`: GitHub Pages-compatible deep links and browser history.
- `src/index.css`: design system plus Tailwind utilities (Tailwind Preflight is intentionally not loaded).

Navigation uses base-path-safe query routes such as `/spendwise/?page=reports`; reload, direct links, and browser back/forward preserve the selected page without requiring a GitHub Pages rewrite rule.

## Current product limits

- No server account, cloud sync, multi-currency conversion, or automatic recurring scheduler.
- Excel import expects the supported card-statement layout; it is not a generic CSV importer.
- Gmail parsing depends on matching supported notification formats and should always be reviewed after import.
- The ledger renders at most 200 transactions per page; filtering and totals still operate across the full local dataset.
- Restore accepts supported JSON backup versions up to 10 MB and 100,000 records per table.

Production builds inject a restrictive CSP compatible with the optional Google Identity/Gmail endpoints. The browser suite tests routing/history, persistence and restore, mobile layout, WCAG A/AA checks through axe, PWA assets/service worker, and CSP enforcement with mocked OAuth endpoints.

See `AUDIT.md` for the 2026-07-10 end-to-end audit and implemented remediations. Release history is in `CHANGELOG.md`.
