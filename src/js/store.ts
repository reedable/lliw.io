import { createStore } from 'framework7/lite';

import { TERTIARY } from './colors';
import { createColorId, createGroupId } from './ids';
import { DEFAULT_GROUP_NAME, SEED_PALETTES } from './seed';
import type {
  ColorGroup,
  ConformanceSetting,
  Palette,
  PaletteColor,
  PaletteItem,
  Settings,
  ThemeSetting,
} from './types';

export const flattenPalette = (palette: Palette): PaletteItem[] => [
  ...palette.ungrouped.map((color): PaletteItem => ({ kind: 'color', color })),
  ...palette.groups.flatMap((group): PaletteItem[] => [
    { kind: 'group', group },
    ...group.colors.map((color): PaletteItem => ({ kind: 'color', color })),
  ]),
];

/** Walks the flat order back into groups: each header opens one, colours fill it. */
const rebuildPalette = (
  items: PaletteItem[],
): Pick<Palette, 'ungrouped' | 'groups'> => {
  const ungrouped: PaletteColor[] = [];
  const groups: ColorGroup[] = [];
  items.forEach((item) => {
    if (item.kind === 'group') {
      groups.push({ ...item.group, colors: [] });
    } else if (groups.length === 0) {
      ungrouped.push(item.color);
    } else {
      groups[groups.length - 1].colors.push(item.color);
    }
  });
  return { ungrouped, groups };
};

/** Flattened view for callers that need every colour in order. */
export const allColors = (palette: Palette): PaletteColor[] => [
  ...palette.ungrouped,
  ...palette.groups.flatMap((g) => g.colors),
];

export const findColor = (palette: Palette, colorId: string): PaletteColor | undefined =>
  allColors(palette).find((c) => c.id === colorId);

interface AppState {
  palettes: Palette[];
  settings: Settings;
}

const SETTINGS_KEY = 'palette.settings';

const DEFAULT_SETTINGS: Settings = {
  defaultConformance: 'AAA',
  showBaseColors: true,
  theme: 'auto',
};

/*
 * Reads back field by field rather than trusting the parsed object: whatever is in
 * localStorage was written by a previous version of this app and is not guaranteed
 * to match the current Settings shape. An unknown conformance value would other-
 * wise reach the colour page as a filter with no MIN_RATIO entry.
 */
const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      defaultConformance: (['AAA', 'AA', 'A'] as const).includes(
        parsed.defaultConformance as ConformanceSetting,
      )
        ? (parsed.defaultConformance as ConformanceSetting)
        : DEFAULT_SETTINGS.defaultConformance,
      showBaseColors:
        typeof parsed.showBaseColors === 'boolean'
          ? parsed.showBaseColors
          : DEFAULT_SETTINGS.showBaseColors,
      theme: (['auto', 'ios', 'md'] as const).includes(parsed.theme as ThemeSetting)
        ? (parsed.theme as ThemeSetting)
        : DEFAULT_SETTINGS.theme,
    };
  } catch {
    // Unreadable or unparseable storage should not stop the app booting.
    return DEFAULT_SETTINGS;
  }
};

const saveSettings = (settings: Settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable or full; the in-memory state is still correct.
  }
};

const PALETTES_KEY = 'palette.palettes';

const isPaletteColor = (value: unknown): value is PaletteColor => {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === 'string' && typeof c.name === 'string' && typeof c.value === 'string';
};

/*
 * Colours were plain hex strings before names existed. Anything read from storage
 * or an imported file may still be in that shape, so both forms are accepted here
 * and normalised to the current one. Position supplies the generated name, which
 * is why this maps rather than filters first.
 */
const normalizeColors = (raw: unknown): PaletteColor[] | null => {
  if (!Array.isArray(raw)) return null;
  const colors: PaletteColor[] = [];
  raw.forEach((entry, i) => {
    if (typeof entry === 'string') {
      colors.push({ id: createColorId(), name: `Color ${i + 1}`, value: entry });
    } else if (isPaletteColor(entry)) {
      colors.push(entry);
    }
  });
  return colors;
};

/*
 * Accepts all three shapes. v1/v2 stored `colors` on the palette; v3 stores
 * `groups`. An older palette is wrapped in one group so nothing is lost and the
 * user sees the same list under a "Colors" heading.
 */
const normalizeGroups = (p: Record<string, unknown>): ColorGroup[] | null => {
  if (Array.isArray(p.groups)) {
    const groups: ColorGroup[] = [];
    p.groups.forEach((raw) => {
      if (typeof raw !== 'object' || raw === null) return;
      const g = raw as Record<string, unknown>;
      if (typeof g.id !== 'string' || typeof g.name !== 'string') return;
      const colors = normalizeColors(g.colors);
      if (colors === null) return;
      groups.push({ id: g.id, name: g.name, colors });
    });
    return groups;
  }
  const colors = normalizeColors(p.colors);
  if (colors === null) return null;
  return [{ id: createGroupId(), name: DEFAULT_GROUP_NAME, colors }];
};

const normalizePalette = (value: unknown): Palette | null => {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || typeof p.name !== 'string') return null;
  const groups = normalizeGroups(p);
  if (groups === null) return null;
  const ungrouped = normalizeColors(p.ungrouped) ?? [];
  return { id: p.id, name: p.name, ungrouped, groups };
};

/*
 * Malformed entries are dropped individually rather than discarding the whole set,
 * so one bad record written by an older version does not cost the user every
 * palette they have. An empty stored array is honoured as empty — the seeds are
 * only a first-run value, not a floor.
 */
const loadPalettes = (): Palette[] => {
  try {
    const raw = localStorage.getItem(PALETTES_KEY);
    if (raw === null) return SEED_PALETTES;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED_PALETTES;
    return parsed.map(normalizePalette).filter((p): p is Palette => p !== null);
  } catch {
    return SEED_PALETTES;
  }
};

const savePalettes = (palettes: Palette[]) => {
  try {
    localStorage.setItem(PALETTES_KEY, JSON.stringify(palettes));
  } catch {
    // Storage can be unavailable or full; the in-memory state is still correct.
  }
};

/*
 * Transfer format. `format` lets a stray JSON file be rejected as "not ours"
 * rather than "corrupt". `version` is the part that has to exist from the first
 * exported file onwards: it does not make anything future-proof by itself, but it
 * is what lets a later build recognise an old file and migrate it, instead of
 * silently misreading a changed shape. Bump it whenever the payload changes, and
 * never reuse a number for a different shape.
 *
 * v1: colors were string[] of hex values.
 * v2: colors are { id, name, value }. v1 files still import — normalizeColors
 *     converts them and generates the names.
 * v3: colours live in groups. v1 and v2 files still import — their flat list is
 *     wrapped in one group named "Colors".
 */
const EXPORT_FORMAT = 'lliw.io/palettes';
const EXPORT_VERSION = 3;

interface PaletteExport {
  format: string;
  version: number;
  exportedAt: string;
  palettes: Palette[];
}

type ImportResult = { ok: true; palettes: Palette[] } | { ok: false; reason: string };

export const buildExport = (palettes: Palette[]): PaletteExport => ({
  format: EXPORT_FORMAT,
  version: EXPORT_VERSION,
  exportedAt: new Date().toISOString(),
  palettes,
});

export const parseImport = (text: string): ImportResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file is not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'That file is not a lliw.io export.' };
  }

  const payload = parsed as Record<string, unknown>;
  if (payload.format !== EXPORT_FORMAT) {
    return { ok: false, reason: 'That file was not exported from lliw.io.' };
  }
  if (typeof payload.version !== 'number') {
    return { ok: false, reason: 'That file has no version and cannot be read safely.' };
  }
  // Refuse rather than guess: a newer file may contain fields this build would drop.
  if (payload.version > EXPORT_VERSION) {
    return {
      ok: false,
      reason: `That file is version ${payload.version}, and this app reads up to ${EXPORT_VERSION}. Update the app first.`,
    };
  }
  if (!Array.isArray(payload.palettes)) {
    return { ok: false, reason: 'That file contains no palettes.' };
  }

  const palettes = payload.palettes
    .map(normalizePalette)
    .filter((p): p is Palette => p !== null);
  if (palettes.length === 0) {
    return { ok: false, reason: 'No readable palettes in that file.' };
  }
  return { ok: true, palettes };
};

interface StoreCtx {
  state: AppState;
}

/** Applies `fn` to one palette's groups and persists. */
const updateGroups = (
  state: AppState,
  paletteId: string,
  fn: (groups: ColorGroup[]) => ColorGroup[],
) => {
  state.palettes = state.palettes.map((p) =>
    p.id === paletteId ? { ...p, groups: fn(p.groups) } : p,
  );
  savePalettes(state.palettes);
};

/** Applies `fn` to every colour list, ungrouped included — for edits by colour id. */
const mapAllColors = (
  state: AppState,
  paletteId: string,
  fn: (colors: PaletteColor[]) => PaletteColor[],
) => {
  state.palettes = state.palettes.map((p) =>
    p.id === paletteId
      ? {
          ...p,
          ungrouped: fn(p.ungrouped),
          groups: p.groups.map((g) => ({ ...g, colors: fn(g.colors) })),
        }
      : p,
  );
  savePalettes(state.palettes);
};

const store = createStore({
  state: {
    palettes: loadPalettes(),
    settings: loadSettings(),
  } as AppState,
  getters: {
    palettes({ state }: StoreCtx) {
      return state.palettes;
    },
    settings({ state }: StoreCtx) {
      return state.settings;
    },
  },
  actions: {
    setSettings({ state }: StoreCtx, patch: Partial<Settings>) {
      state.settings = { ...state.settings, ...patch };
      saveSettings(state.settings);
    },
    /*
     * Merge, incoming wins on id collision. Existing palettes keep their position
     * so an import does not reshuffle the list; genuinely new ones are appended.
     */
    importPalettes({ state }: StoreCtx, { palettes }: { palettes: Palette[] }) {
      const incoming = new Map(palettes.map((p) => [p.id, p]));
      const existingIds = new Set(state.palettes.map((p) => p.id));
      const merged = state.palettes.map((p) => incoming.get(p.id) ?? p);
      const added = palettes.filter((p) => !existingIds.has(p.id));
      state.palettes = [...merged, ...added];
      savePalettes(state.palettes);
    },
    deletePalette({ state }: StoreCtx, { id }: { id: string }) {
      state.palettes = state.palettes.filter((p) => p.id !== id);
      savePalettes(state.palettes);
    },
    addPalette({ state }: StoreCtx, { id }: { id: string }) {
      const newPalette: Palette = {
        id,
        name: 'Untitled',
        ungrouped: [],
        groups: [
          {
            id: createGroupId(),
            name: DEFAULT_GROUP_NAME,
            colors: [{ id: createColorId(), name: 'Color 1', value: TERTIARY.gray }],
          },
        ],
      };
      state.palettes = [newPalette, ...state.palettes];
      savePalettes(state.palettes);
    },
    renamePalette({ state }: StoreCtx, { id, name }: { id: string; name: string }) {
      state.palettes = state.palettes.map((p) => (p.id === id ? { ...p, name } : p));
      savePalettes(state.palettes);
    },
    addGroup(
      { state }: StoreCtx,
      { paletteId, id, name }: { paletteId: string; id: string; name: string },
    ) {
      updateGroups(state, paletteId, (groups) => [...groups, { id, name, colors: [] }]);
    },
    renameGroup(
      { state }: StoreCtx,
      { paletteId, groupId, name }: { paletteId: string; groupId: string; name: string },
    ) {
      updateGroups(state, paletteId, (groups) =>
        groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
      );
    },
    /* Colours go with the group; deleting is the only way to remove them wholesale. */
    removeGroup({ state }: StoreCtx, { paletteId, groupId }: { paletteId: string; groupId: string }) {
      updateGroups(state, paletteId, (groups) => groups.filter((g) => g.id !== groupId));
    },
    /* Appends to a named group. Numbering counts the whole palette, so names stay
       unique across groups rather than restarting at 1 in each. */
    addColor(
      { state }: StoreCtx,
      { paletteId, groupId, value }: { paletteId: string; groupId: string; value: string },
    ) {
      updateGroups(state, paletteId, (groups) => {
        const total = groups.reduce((n, g) => n + g.colors.length, 0);
        return groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                colors: [
                  ...g.colors,
                  { id: createColorId(), name: `Color ${total + 1}`, value },
                ],
              }
            : g,
        );
      });
    },
    setColorValue(
      { state }: StoreCtx,
      { paletteId, colorId, value }: { paletteId: string; colorId: string; value: string },
    ) {
      mapAllColors(state, paletteId, (colors) =>
        colors.map((c) => (c.id === colorId ? { ...c, value } : c)),
      );
    },
    renameColor(
      { state }: StoreCtx,
      { paletteId, colorId, name }: { paletteId: string; colorId: string; name: string },
    ) {
      mapAllColors(state, paletteId, (colors) =>
        colors.map((c) => (c.id === colorId ? { ...c, name } : c)),
      );
    },
    removeColor(
      { state }: StoreCtx,
      { paletteId, colorId }: { paletteId: string; colorId: string },
    ) {
      mapAllColors(state, paletteId, (colors) => colors.filter((c) => c.id !== colorId));
    },
    /*
     * from/to are positions in the flat rendered sequence — headers and colours as
     * siblings in one list, which is what makes Framework7's sibling-scoped indices
     * meaningful across groups. The move is applied to that sequence and folded
     * back, so a colour dragged past a header changes group and a dragged header
     * repositions alone, leaving its colours to join whatever now precedes them.
     */
    moveItem(
      { state }: StoreCtx,
      { paletteId, from, to }: { paletteId: string; from: number; to: number },
    ) {
      state.palettes = state.palettes.map((p) => {
        if (p.id !== paletteId) return p;
        const items = flattenPalette(p);
        if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
          return p;
        }
        const next = [...items];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...p, ...rebuildPalette(next) };
      });
      savePalettes(state.palettes);
    },
  },
});
export default store;
