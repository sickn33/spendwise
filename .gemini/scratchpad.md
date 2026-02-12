# SpendWise UI Performance Optimization

## Background and Motivation

The user reports that the SpendWise app UI is slow and buggy, and wants to improve its fluidity. After thorough analysis of the entire codebase (11 components, App.tsx, database.ts, CSS, services, tests), I identified 7 concrete performance bottlenecks.

## Project Status Board

- ID: T01
  Goal: Wrap page components in React.memo to prevent re-render cascades from App-level state changes
  Success Criteria: Components don't re-render when unrelated App state changes (e.g., theme toggle doesn't re-render Dashboard)
  Test Case: `npm run build` succeeds + Playwright E2E tests pass
  Status: todo

- ID: T02
  Goal: Memoize callbacks and inline options objects passed as props
  Success Criteria: Stable references for event handlers and chart options prevent unnecessary child re-renders
  Test Case: `npm run build` succeeds
  Status: todo

- ID: T03
  Goal: Lazy-load jsPDF in Reports.tsx and MonthComparison.tsx using dynamic import()
  Success Criteria: Initial bundle size reduced; jsPDF only loaded when user clicks "Download PDF"
  Test Case: `npm run build` shows smaller initial chunk; PDF generation still works
  Status: todo

- ID: T04
  Goal: Fix CSS `transition: all` anti-pattern (5 selectors) to use specific properties
  Success Criteria: Transitions only animate intended properties, reducing compositor work
  Test Case: Visual inspection + `npm run build` succeeds
  Status: todo

- ID: T05
  Goal: Optimize BudgetManager data fetching — use date-filtered query instead of fetching all transactions
  Success Criteria: BudgetManager only fetches current month's transactions from IndexedDB
  Test Case: `npm run build` succeeds + budget page loads correctly
  Status: todo

- ID: T06
  Goal: Add React.lazy + Suspense for page-level code splitting in App.tsx
  Success Criteria: Each page component is loaded on demand, reducing initial bundle
  Test Case: `npm run build` shows multiple chunks
  Status: todo

- ID: T07
  Goal: Disable Chart.js animations for faster chart rendering
  Success Criteria: Charts render without animation delay
  Test Case: Visual inspection — charts appear instantly
  Status: todo

## Current Status

State: PLANNER — awaiting user approval of implementation plan.

## Lessons

- Project has good existing memoization in Dashboard.tsx, TransactionList.tsx via useMemo/useCallback
- Reports.tsx already disables bar chart animation but not doughnut chart
- Existing E2E tests are in Python/Playwright (`tests/test_spendwise.py`), vitest setup exists but no unit tests yet
- The `getTransactions()` function in database.ts supports date filters but BudgetManager doesn't use them

## Executor's Feedback

(none yet)
