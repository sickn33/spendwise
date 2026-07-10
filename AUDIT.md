# SpendWise end-to-end audit — 2026-07-10

## Executive assessment

SpendWise is a coherent browser-only personal-finance application, not a demo shell. Its main domain path is: user/import/Gmail input → validation and deduplication → Dexie/IndexedDB ledger → analytics/comparison → dashboard, reports, and exports. The initial audit found serious presentation and data-integrity gaps despite a green 79-test suite: most Tailwind-like classes had no implementation, mobile content was covered by the sidebar, invalid financial values could reach persistence, import updates were advertised but ignored, coverage failed its configured threshold, and deployment bypassed tests.

The patch set resolves those release-blocking findings and adds regression protection. The full disposition and residual product work follow.

## Audit method and inventory

The review covered every tracked source, configuration, workflow, documentation, and test file. Generated lock data was parsed as JSON and package integrity/dependency state was checked. The application was exercised through unit/integration tests, coverage, lint, TypeScript/Vite production build, post-build manifest/asset verification, dependency audit, and real-browser desktop/mobile flows.

Reviewed surfaces:

- App shell, every page/component, styles, types, hooks, database, and all six services.
- All tests, Vitest/TypeScript/ESLint/Vite/PWA configuration, package and lock files.
- GitHub Pages workflow, public assets, HTML metadata, and project documentation.
- IndexedDB boundaries, Gmail OAuth/token handling, parser/import dedupe, backup payload, analytics, export and PWA assumptions.

## Implemented findings

### Release blockers

1. **Missing CSS engine and broken responsive layout.** Added Tailwind 4's Vite integration without Preflight, mapped project tokens, completed missing variables/classes, and converted the mobile sidebar to a scrollable bottom navigation. All eight pages are now visible in navigation.
2. **Invalid financial data.** Added finite/positive validation to transaction, budget, preset, and savings inputs and corresponding database guards. Income/category compatibility is corrected when transaction type changes. Savings mutations are transactional.
3. **False import-update control.** The preview option now reaches the importer; modified records are updated only when opted in, with accurate counts and action copy. Local calendar-day hashes prevent timezone drift.
4. **Incomplete/disconnected backup.** App and Settings share one backup controller and write a versioned payload covering transactions, categories, budgets, presets, goals, and settings.
5. **Quality gate bypass.** CI deployment now runs lint, enforced coverage, TypeScript/build, and post-build asset verification. Empty test discovery fails.
6. **Broken PWA assets.** Added real 192px/512px icons, corrected base-aware HTML references, removed nonexistent assets, and added a manifest/HTML asset verifier.

### Correctness and resilience

- Expense breakdown/report categories exclude income; invalid analytics/comparison ranges fail explicitly.
- Impossible email dates are rejected instead of silently rolling into another month.
- Gmail dedupe uses local day keys, clamps requested result limits, avoids leaking response bodies, and keeps access tokens in session storage.
- Category deletion is blocked while referenced by transactions, budgets, or presets.
- Custom transaction end dates include the entire selected day.
- Dashboard, Reports, and Comparison ignore stale async results and show actionable load errors; database initialization failures no longer masquerade as an empty app.
- Quick Add blocks double submission and confirms preset deletion. Heuristic Gmail duplicate cleanup now requires confirmation. Destructive copy accurately states its scope.

### Accessibility and UX

- Browser zoom is allowed; document and manifest language are aligned to the English UI.
- Navigation exposes current-page state; dialog names/roles, labels, icon/color names, Escape handling, focus containment, and focus restoration were added across critical forms.
- Nested interactive controls were removed from Quick Add.
- Warning text contrast and undefined design tokens were corrected; remote render-blocking fonts were removed.

### Testing, dependencies, and documentation

- Added direct tests for classifier, comparison, month comparison UI, import preview, impossible dates, analytics edge cases, and deeper CRUD/action coverage for Settings, Budget, Savings, Category, Quick Add, and Transaction Form.
- Removed the stale Python pseudo-E2E suite and unused starter assets/dependency.
- Declared the actual Node/npm requirements and synchronized package/UI versioning.
- Split vendor chunks by domain and kept heavy PDF/spreadsheet paths lazy.
- Replaced inaccurate claims about ML, CSV import, cloud privacy, routing, recurring automation, restore, and licensing with a source-grounded README.

## Continuation completed

The initially deferred engineering roadmap was subsequently implemented and verified:

1. **Restore and portability:** backup schema 2.0, 1.0 migration, strict type/relationship/size checks, destructive confirmation, atomic all-table restore, rollback and browser round-trip/corruption tests.
2. **Repeatable browser E2E:** Playwright TypeScript runs against `vite preview` in Chromium and CI, with deterministic routing, restore, mobile, PWA, CSP, and accessibility scenarios.
3. **URL navigation:** base-path-safe query routes support direct links, reload, `pushState`, `popstate`, canonical invalid URLs, real anchor destinations, and focus transfer.
4. **Gmail hardening:** pagination, repeated-ID protection, bounded rate-limit/server retries, partial-message failure, expired/revoked authorization cleanup, nested/attachment MIME handling, and calendar-boundary fixtures.
5. **Large-ledger performance:** the DOM is bounded to 200 records per page; a 10,000-record regression test proves paging and full-result counts.
6. **Accessibility system:** every modal uses the shared native `Dialog`; axe scans all eight pages plus the transaction dialog against WCAG A/AA including 2.2 AA with no exclusions.
7. **PWA/security policy:** the production-only CSP is emitted before scripts, verified post-build, and exercised in Chromium with allowed mocked Google/Gmail flows plus a blocked untrusted script. PWA manifest, base paths, service-worker registration, and offline shell are browser-tested.

No blocker or P1 engineering defect remains from this audit. Live Gmail authorization was intentionally not attempted because it requires the user's Google OAuth client and account consent; the CI-safe mocked boundary verifies token/header/UI behavior without handling real account data. Recurring scheduling, currency conversion, accounts/cloud sync, and contribution history remain optional product-scope decisions rather than unfinished versions of existing features.

## Verification contract

Completion requires `npm run check`, `npm run typecheck:e2e`, the complete Playwright suite, `npm audit --audit-level=moderate`, and independent diff review to be green. The release gate also scans staged sources, fixtures, generated assets, and the deployed public surface for personal or provider-specific data.
