export interface PaletteColor {
  id: string;
  name: string;
  value: string;
}

/** Colours live in groups, so a palette reads as sections rather than one long list. */
export interface ColorGroup {
  id: string;
  name: string;
  colors: PaletteColor[];
}

export interface Palette {
  id: string;
  name: string;
  /** Colours before the first group header. Implicitly the leading bucket. */
  ungrouped: PaletteColor[];
  groups: ColorGroup[];
}

/*
 * The card renders one flat list whose rows are headers and colours as siblings,
 * so Framework7's sortable — whose indices are sibling-scoped — can move a colour
 * across groups and reposition a header. The flat form is derived for render and
 * for interpreting a drop; it is never stored. The folds themselves live in
 * store.ts.
 */
export type PaletteItem =
  | { kind: 'color'; color: PaletteColor }
  | { kind: 'group'; group: ColorGroup };

/** The conformance tab the colour page opens on. */
export type ConformanceSetting = 'AAA' | 'AA' | 'A';

/*
 * Which Framework7 theme to render. 'auto' hands the decision back to F7, which
 * resolves it as `device.ios ? 'ios' : 'md'` — and its iPad detection matches
 * window.screen against a hardcoded list of resolutions, because iPadOS reports
 * platform 'MacIntel'. An iPad whose screen is not on that list gets Material
 * Design. This setting exists so that guess can be overridden.
 */
export type ThemeSetting = 'auto' | 'ios' | 'md';

export interface Settings {
  defaultConformance: ConformanceSetting;
  showBaseColors: boolean;
  theme: ThemeSetting;
}
