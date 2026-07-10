# SpendWise project map

This map is intentionally structural rather than a hand-maintained line-count inventory. See `AUDIT.md` for the verified behavior and roadmap.

```text
index.html
src/
  main.tsx                 React entry point
  App.tsx                  shell, URL page state, shortcuts, lazy loading, backup trigger
  index.css                design tokens, component CSS, Tailwind theme/utilities
  types/index.ts           domain types
  components/
    Sidebar.tsx            eight-page navigation and Quick Add
    Dashboard.tsx          current-month overview and trends
    TransactionForm.tsx    validated add/edit dialog
    TransactionList.tsx    search, filters, edit/delete
    CategoryManager.tsx    category CRUD and automation keywords
    BudgetManager.tsx      category budget CRUD/utilization
    SavingsGoals.tsx       goals and contribution/withdrawal actions
    Reports.tsx            range summaries, charts, PDF export
    MonthComparison.tsx    adjacent-month comparison and insights
    Dialog.tsx             shared native accessible modal primitive
    Settings.tsx           import/export, Gmail, backup/restore, reset
    ImportPreviewModal.tsx import classification and update choice
    QuickAddWidget.tsx     preset transaction entry and preset CRUD
  db/database.ts           Dexie schema, initialization, CRUD, invariants
  hooks/
    useLocalBackup.ts      File System Access API state and writes
    usePageRoute.ts        query routing, history, focus and deep links
  services/
    backup.ts              versioning, validation, migration, atomic restore
    analytics.ts           summaries, breakdowns, trends, report model
    comparison.ts          monthly comparison and insights
    classifier.ts          keyword/history categorization
    importer.ts            Excel preview/import, CSV/Excel export
    gmailSync.ts           OAuth/Gmail fetch, dedupe, import/cleanup
    cardEmailParser.ts     supported card-notification parsing
  test/setup.ts            browser API/storage test shims
public/
  icon.svg
  icon-192.png
  icon-512.png
scripts/verify-build.mjs    checks built HTML/manifest asset references
.github/workflows/deploy.yml
vite.config.ts
vitest.config.ts
```

The app uses query-string page routing, IndexedDB persistence, optional Google Gmail API access, and an installable PWA rooted at `/spendwise/`.
