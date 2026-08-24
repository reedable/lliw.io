# Backlog

One file per item in `backlog/`. Each records what was verified, when, and what
is still unknown — so a decision is not re-derived from scratch later.

## Blocked

- [Linting and formatting](backlog/linting.md) — ESLint + typescript-eslint
  cannot run on TypeScript 7.

## Hardening

- [Automated tests](backlog/automated-tests.md) — no runner; the pure functions
  in `store.ts` are uncovered.
- [Error boundary](backlog/error-boundary.md) — a throw in any page blanks the
  app.
- [npm audit: workbox-cli chain](backlog/npm-audit-workbox-cli.md) — the only
  offered fix downgrades six majors.

## Structure

- [Store shape: ungrouped vs groups](backlog/store-shape-ungrouped.md)
- [PaletteCard complexity](backlog/palette-card-complexity.md)

## Cleanup

- [Content Security Policy](backlog/content-security-policy.md)
- [Small cleanups](backlog/small-cleanups.md)
- [Generated fonts are tracked](backlog/generated-fonts-tracked.md)
- [Bundle size](backlog/bundle-size.md)
