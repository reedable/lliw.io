
import { createStore } from 'framework7/lite';

export interface PaletteColor {
  id: string;
  name: string;
  value: string;
}

export interface Palette {
  id: string;
  name: string;
  colors: PaletteColor[];
}

/*
 * Not crypto.randomUUID(): vite is configured with `server.host: true`, so the dev
 * app is reachable over plain http on a LAN address. That is not a secure context,
 * where crypto.randomUUID is undefined — it would work on localhost and break on a
 * phone. The caller generates the id so it can auto-expand the card it just made.
 */
const randomSuffix = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export const createPaletteId = () => `p${randomSuffix()}`;
export const createColorId = () => `c${randomSuffix()}`;

/** The conformance tab the colour page opens on. */
export type ConformanceSetting = 'AAA' | 'AA' | 'A';

export interface Settings {
  defaultConformance: ConformanceSetting;
  showBaseColors: boolean;
}

interface AppState {
  palettes: Palette[];
  settings: Settings;
}

const SETTINGS_KEY = 'palette.settings';

const DEFAULT_SETTINGS: Settings = {
  defaultConformance: 'AAA',
  showBaseColors: true,
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

const seedColors = (values: string[]): PaletteColor[] =>
  values.map((value, i) => ({ id: createColorId(), name: `Color ${i + 1}`, value }));

/** Used only when storage has never been written — not when it holds an empty list. */
const SEED_PALETTES: Palette[] = [
  { id: 'p1', name: 'Dusk', colors: seedColors(['#2b2d42', '#8d99ae', '#edf2f4', '#ef233c', '#d90429']) },
  { id: 'p2', name: 'Citrus', colors: seedColors(['#fec89a', '#ffd7ba', '#fec5bb', '#f8edeb', '#d8e2dc']) },
  { id: 'p3', name: 'Forest', colors: seedColors(['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51']) },
];

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

const normalizePalette = (value: unknown): Palette | null => {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || typeof p.name !== 'string') return null;
  const colors = normalizeColors(p.colors);
  if (colors === null) return null;
  return { id: p.id, name: p.name, colors };
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
 */
export const EXPORT_FORMAT = 'lliw.io/palettes';
export const EXPORT_VERSION = 2;

export interface PaletteExport {
  format: string;
  version: number;
  exportedAt: string;
  palettes: Palette[];
}

export type ImportResult = { ok: true; palettes: Palette[] } | { ok: false; reason: string };

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

/** Applies `fn` to one palette's colours and persists. */
const updateColors = (
  state: AppState,
  paletteId: string,
  fn: (colors: PaletteColor[]) => PaletteColor[],
) => {
  state.palettes = state.palettes.map((p) =>
    p.id === paletteId ? { ...p, colors: fn(p.colors) } : p,
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
        colors: [{ id: createColorId(), name: 'Color 1', value: '#3b82f6' }],
      };
      state.palettes = [newPalette, ...state.palettes];
      savePalettes(state.palettes);
    },
    renamePalette({ state }: StoreCtx, { id, name }: { id: string; name: string }) {
      state.palettes = state.palettes.map((p) => (p.id === id ? { ...p, name } : p));
      savePalettes(state.palettes);
    },
    addColor({ state }: StoreCtx, { paletteId, value }: { paletteId: string; value: string }) {
      updateColors(state, paletteId, (colors) => [
        ...colors,
        { id: createColorId(), name: `Color ${colors.length + 1}`, value },
      ]);
    },
    setColorValue(
      { state }: StoreCtx,
      { paletteId, colorId, value }: { paletteId: string; colorId: string; value: string },
    ) {
      updateColors(state, paletteId, (colors) =>
        colors.map((c) => (c.id === colorId ? { ...c, value } : c)),
      );
    },
    renameColor(
      { state }: StoreCtx,
      { paletteId, colorId, name }: { paletteId: string; colorId: string; name: string },
    ) {
      updateColors(state, paletteId, (colors) =>
        colors.map((c) => (c.id === colorId ? { ...c, name } : c)),
      );
    },
    removeColor(
      { state }: StoreCtx,
      { paletteId, colorId }: { paletteId: string; colorId: string },
    ) {
      updateColors(state, paletteId, (colors) => colors.filter((c) => c.id !== colorId));
    },
    /*
     * from/to are positions in the full colour list as rendered. Guarded because
     * F7 reports indices from the DOM, and a stale or out-of-range pair would
     * otherwise splice `undefined` into the array.
     */
    reorderColors(
      { state }: StoreCtx,
      { paletteId, from, to }: { paletteId: string; from: number; to: number },
    ) {
      updateColors(state, paletteId, (colors) => {
        if (from === to || from < 0 || to < 0 || from >= colors.length || to >= colors.length) {
          return colors;
        }
        const next = [...colors];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    },
  },
});
export default store;
