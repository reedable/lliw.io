# Store shape: `ungrouped` alongside `groups`

`Palette` (`src/utils/types.ts`) has two colour buckets:

```ts
interface Palette {
  id: string;
  name: string;
  ungrouped: PaletteColor[]; // colours before the first group header
  groups: ColorGroup[];
}
```

## What it costs

Two write helpers exist solely because of the split (`src/utils/store.ts`):

- `updateGroups` — group-scoped writes (`addGroup`, `renameGroup`,
  `removeGroup`, `addColor`).
- `mapAllColors` — id-scoped writes that must also sweep `ungrouped`
  (`setColorValue`, `renameColor`, `removeColor`).

`allColors`, `flattenPalette`, `rebuildPalette` and `normalizePalette` each
handle both buckets as well.

## What produces it

Nothing creates an ungrouped colour deliberately. `SEED_PALETTES`, `addPalette`
and `addColor` all write into a group. `ungrouped` is reachable only by:

1. dragging a colour above the first group header (`moveItem` folds the flat
   sequence back, and anything before the first header lands here), or
2. importing a file that already contains one.

So it is a state with two producers and five consumers.

## Not decided

Whether the leading bucket should exist at all, or whether a palette should
always have at least one group and a drag above the first header should be
refused or should push the colour into that first group instead. Either change
alters `rebuildPalette`, so it wants the round-trip tests first — see
[automated-tests](automated-tests.md).
