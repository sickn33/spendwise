# Changelog

All notable changes to SpendWise are documented here.

## 1.0.0 — 2026-07-10

First formal public release.

### Added

- Versioned, validated JSON backup restore with atomic IndexedDB replacement.
- URL-addressable navigation with reload and browser-history support.
- Playwright coverage for desktop, mobile, accessibility, CSP, restore, and PWA offline behavior.
- Shared accessible native dialog system and bounded 200-row ledger pagination.
- Gmail pagination, retry, expiry, partial-failure, and duplicate-safety handling.

### Improved

- Financial validation, import/update atomicity, analytics correctness, and async error states.
- Responsive navigation, keyboard focus, chart alternatives, contrast, and touch targets.
- Production CSP, GitHub Pages CI gates, PWA assets, and dependency verification.

### Privacy

- Uses synthetic `example.com` identities and `EXAMPLE_*` transaction fixtures.
- Keeps optional Gmail access tokens in session storage and exposes no analytics or telemetry.
