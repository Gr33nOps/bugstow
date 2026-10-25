# UI review — October 25, 2026

This review covers the Local and Team web application for version 2.9.2.

## Repeatable screen coverage

`e2e/screens.e2e.ts` visits Local at 390 × 667 and 1440 × 900 in light and dark themes: mode selection, empty inbox, projects, project creation/editing/menu, general settings, shortcuts, About, data settings, backup export/restore, data deletion confirmation, Completed, issue creation and expanded report, issue detail/edit, GitHub import/export, and Trash. Screenshots are written to `test-results/`.

`e2e/team.e2e.ts` visits Team authentication, project creation/move, issue creation and expanded report, People, invitations, password reset and its result, Copy Local issues, password change, backups, GitHub import, workspace menu, and Trash in the same four display combinations. A separate guest session exercises joining and forced password change. Existing interaction tests cover list/board switching, status changes, filtering, selection, comments, direct links, and issue deletion confirmation.

Setup and desktop connection screens use API fixtures. Walkthroughs check document overflow; keyboard regressions check focus containment, Escape, and nested dialog dismissal. Screenshots supplement these assertions; they are not pixel-baseline tests.

## Changes from findings

- Shared List/Board switcher, priority indicators, filters, and board cards.
- Aligned Local list columns and wrapped long content.
- Team theme control and mutually dismissing menus.
- Scrollable dialogs, accessible field names, and keyboard focus restoration.
- Mobile Team report controls stack instead of squeezing into three columns.
- Team project creation is reachable from navigation and mobile Actions.
- People refreshes on open so newly joined teammates appear without reloading.
- Project save errors stay in the form for correction or retry.

## Verification and boundaries

Production build/typecheck, 101 unit tests, and all 16 Playwright tests passed. Browser runs use Chromium and isolated test data. No real GitHub issues were exported and no user data was modified.

This does not certify every possible error, dataset, browser, or OS combination. Native install/shortcut UI and the browser extension's permission prompts are outside this web-screen pass. Real-device Safari/Firefox and live GitHub authorization remain release checks.
