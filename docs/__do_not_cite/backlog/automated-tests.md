# Automated tests

There is no test runner in `devDependencies` and no test files. `tsc --noEmit`
gates `build`, so type-level regressions are caught; behavioural ones are not.

## Highest-value surface, because it is pure

- `src/js/store.ts` — `flattenPalette` / `rebuildPalette`. The round trip that
  drag-and-drop reordering depends on: the card renders one flat list of headers
  and colours as siblings, and a drop is interpreted by folding that sequence
  back into groups. A colour dragged past a header changes group; a dragged
  header repositions alone and leaves its colours to whatever now precedes them.
  Both behaviours are load-bearing and currently unverified.
- `src/js/store.ts` — `moveItem`. Applies the move to the flat sequence and
  folds back; bounds-checks `from`/`to` against the flattened length.
- `src/js/store.ts` — `normalizeColors` / `normalizeGroups` / `normalizePalette`.
  Accept three historical shapes (v1 `string[]` of hex, v2 `{id,name,value}`,
  v3 grouped) and drop malformed entries individually rather than discarding a
  whole palette.
- `src/js/store.ts` — `parseImport`. Rejects non-JSON, wrong `format`, missing
  `version`, and versions newer than `EXPORT_VERSION`.
- `src/js/seed.ts` — `namedGroup` derives colour names from object keys in
  `colors.ts`.

None of these touch the DOM, Framework7, or localStorage, so they need no
environment beyond a runner.

## Not decided

Which runner. Vitest is the obvious fit for a Vite project but has not been
checked against `typescript@7.0.2` — that is the same class of question that
blocked typescript-eslint, so verify before committing to it.
