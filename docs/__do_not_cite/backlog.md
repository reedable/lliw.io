# Backlog

One file per item in `backlog/`. Each records what was verified, when, and what
is still unknown — so a decision is not re-derived from scratch later.

## Blocked

- [Linting and formatting](backlog/linting.md) — ESLint + typescript-eslint
  cannot run on TypeScript 7.

## Accessibility

- [Reduced motion](backlog/reduced-motion.md) — `prefers-reduced-motion` is not
  honoured anywhere; the card expand is a full-viewport geometry change.

## Hardening

- [Automated tests](backlog/automated-tests.md) — runner in place; the palette
  folds in `store.ts` are still uncovered and not reachable from a test.
- [Error boundary](backlog/error-boundary.md) — a throw in any page blanks the
  app.
- [npm audit: workbox-cli chain](backlog/npm-audit-workbox-cli.md) — the only
  offered fix downgrades six majors.

## Structure

- [Store shape: ungrouped vs groups](backlog/store-shape-ungrouped.md)
- [PaletteCard complexity](backlog/palette-card-complexity.md)

## On hold

- [Color picker](backlog/color-picker.md) — nothing built; records the
  Framework7 research so it need not be redone.

## Cleanup

- [Content Security Policy](backlog/content-security-policy.md)
- [Small cleanups](backlog/small-cleanups.md)
- [Generated fonts are tracked](backlog/generated-fonts-tracked.md)
- [Bundle size](backlog/bundle-size.md)
