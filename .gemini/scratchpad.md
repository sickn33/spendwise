# Reliability-First Scratchpad - spendwise

## Background and Motivation

Remaking Spendwise UI into "Technical Editorial Design". After the UI overhaul, it's critical to add component tests to ensure the new "Raw Precision" aesthetic and functional components are reliable and regression-proof.

## Project Status Board

- ID: T05
  Goal: Fix theme regression (Dark and Light modes are same)
  Success Criteria: Dark mode has a dark background/light text, Light mode has a light background/dark text.
  Test Case: `vitest src/App.test.tsx` (with new theme test)
  Status: done
- ID: T06
  Goal: Fix contrast issue in theme toggle
  Success Criteria: "MODO SCURO" text and icons are clearly visible in dark mode.
  Test Case: Visual verification.
  Status: done
- ID: T07
  Goal: Refine dark mode palette for better readability
  Success Criteria: Dark mode uses a softer charcoal/navy palette instead of absolute black.
  Test Case: Visual verification.
  Status: done
- ID: T08
  Goal: Commit and push all changes
  Success Criteria: `git status` shows clean worktree and changes are pushed to remote.
  Test Case: `git status` and `git log`
  Status: in_progress

### TDD Evidence - T05

- RED: `npm test src/App.test.tsx` -> failed (attribute was null)
- GREEN: `npm test src/App.test.tsx` -> 1 passed (attribute correctly toggles)
- REFACTOR: Moved core colors to theme blocks in `index.css`.

### TDD Evidence - T04

- RED: N/A (Initial tests were improved to define new spec, they passed because some labels were already present, but the UI was manually refined for precision)
- GREEN: `npm test src/components/Settings.test.tsx` -> 1 passed
- REFACTOR: Refined `Settings.tsx` with `page-header`, `card`, `grid-2`, and industrial-style typography.

## Current Status

Implementing theme fix in `index.css`.

## Lessons

- UI overhaul without existing component tests is risky; adding them now is essential for long-term health.
- Monospace labels and technical uppercase strings need to be tested for exact matches to satisfy the design spec.

## Executor's Feedback

N/A
