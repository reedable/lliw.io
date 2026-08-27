# Automated tests: the gaps that remain

Vitest 4.1.11 is installed and runs under `typescript@7.0.2` — it strips types
via esbuild rather than calling the TypeScript compiler API, which is why it does
not hit the wall that blocks typescript-eslint (see [linting](linting.md)).
`npm test` and `npm run test:watch`.

Covered today: `src/utils/migrations.ts` and `src/utils/contrast.ts`.

`build` still gates on `typecheck` only, not on tests. Whether it should is
undecided.

## What is still uncovered

All three are pure and are the correctness-critical parts of the app that no
test touches.

- **`flattenPalette` / `rebuildPalette` round trip** (`src/utils/store.ts`). The
  highest-value gap. The card renders one flat list with headers and colours as
  siblings, and a drop is interpreted by folding that sequence back into groups.
  A colour dragged past a header changes group; a dragged header repositions
  alone and leaves its colours to whatever now precedes them. Both behaviours
  are load-bearing, both are easy to break, and neither is verified.
- **`moveItem`** (`src/utils/store.ts`). Applies the move to the flat sequence and
  folds back, bounds-checking `from`/`to` against the flattened length.
- **`namedGroup`** (`src/utils/seed.ts`). Derives colour names from the object keys
  in `colors.ts`, so the brand palette's names and values have a single source.

## The obstacle: they are not reachable from a test

This is the actual work, not the test-writing.

`src/utils/store.ts` imports `framework7/lite` and calls `loadPalettes()` and
`loadSettings()` at module load, which touch `localStorage`. Importing it from a
node test environment is therefore not free. `namedGroup` is not exported from
`seed.ts`.

Two ways out:

1. **Extract the pure folds out of `store.ts`.** `migrations.ts` and
   `contrast.ts` are both testable precisely because they are pure modules with
   no Framework7 or storage dependency. `flattenPalette`, `rebuildPalette` and
   the move arithmetic could sit in the same shape — the store would import them
   and stay responsible for state and persistence only. This also shrinks
   `store.ts`, which is doing several jobs.
2. **Run under jsdom.** Adds a dependency and an environment, and leaves
   `store.ts` importing Framework7 in tests for no benefit. Cheaper to set up,
   worse to live with.

Option 1 is the same move that made the two currently-tested modules testable,
and it is a prerequisite for the [PaletteCard](palette-card-complexity.md) work
regardless.

## Related

The `ungrouped`/`groups` question in [store shape](store-shape-ungrouped.md)
cannot be safely changed without the round-trip tests above — `rebuildPalette`
is exactly what a change there would alter.
