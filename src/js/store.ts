
import { createStore } from 'framework7/lite';

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

/*
 * Not crypto.randomUUID(): vite is configured with `server.host: true`, so the dev
 * app is reachable over plain http on a LAN address. That is not a secure context,
 * where crypto.randomUUID is undefined — it would work on localhost and break on a
 * phone. The caller generates the id so it can auto-expand the card it just made.
 */
export const createPaletteId = () =>
  `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

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

interface StoreCtx {
  state: AppState;
}

const store = createStore({
  state: {
    palettes: [
      {
        id: 'p1',
        name: 'Dusk',
        colors: ['#2b2d42', '#8d99ae', '#edf2f4', '#ef233c', '#d90429'],
      },
      {
        id: 'p2',
        name: 'Citrus',
        colors: ['#fec89a', '#ffd7ba', '#fec5bb', '#f8edeb', '#d8e2dc'],
      },
      {
        id: 'p3',
        name: 'Forest',
        colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
      },
    ],
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
    addPalette({ state }: StoreCtx, { id }: { id: string }) {
      const newPalette: Palette = { id, name: 'Untitled', colors: ['#3b82f6'] };
      state.palettes = [newPalette, ...state.palettes];
    },
    renamePalette({ state }: StoreCtx, { id, name }: { id: string; name: string }) {
      state.palettes = state.palettes.map((p) => (p.id === id ? { ...p, name } : p));
    },
    addColor({ state }: StoreCtx, { id, color }: { id: string; color: string }) {
      state.palettes = state.palettes.map((p) =>
        p.id === id ? { ...p, colors: [...p.colors, color] } : p,
      );
    },
    setColor(
      { state }: StoreCtx,
      { id, index, color }: { id: string; index: number; color: string },
    ) {
      state.palettes = state.palettes.map((p) =>
        p.id === id ? { ...p, colors: p.colors.map((c, i) => (i === index ? color : c)) } : p,
      );
    },
    removeColor({ state }: StoreCtx, { id, index }: { id: string; index: number }) {
      state.palettes = state.palettes.map((p) =>
        p.id === id ? { ...p, colors: p.colors.filter((_, i) => i !== index) } : p,
      );
    },
  },
})
export default store;
