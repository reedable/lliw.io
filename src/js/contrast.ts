import Color from 'colorjs.io';

/*
 * Contrast + WCAG conformance.
 *
 * The ratio itself comes from colorjs.io (Color.contrastWCAG21), so the
 * sRGB-linearisation and luminance maths are not ours to maintain, and parsing is
 * not limited to hex. What colorjs.io does NOT provide is the conformance mapping
 * below — no contrast library surveyed returns AA/AAA by text size — so the
 * thresholds are ours.
 *
 * Thresholds come from two success criteria:
 *   SC 1.4.3 Contrast (Minimum)  — Level AA  — 4.5:1 normal text, 3:1 large text
 *   SC 1.4.6 Contrast (Enhanced) — Level AAA — 7:1 normal text, 4.5:1 large text
 *
 * There is deliberately no Level A tier: WCAG defines no contrast requirement at
 * Level A, so a pairing below the AA threshold simply fails.
 *
 * "Large" means >= 18pt (24px), or >= 14pt (18.66px) when bold.
 */

export type Conformance = 'AAA' | 'AA' | 'Fail';

export interface ContrastReport {
  ratio: number;
  smallText: Conformance;
  largeText: Conformance;
  /** APCA lightness contrast, the WCAG 3 candidate. Signed, roughly -108..106. */
  apca: number;
}

/** Contrast ratio between two colours, 1–21. Null if either fails to parse. */
export const contrastRatio = (a: string, b: string): number | null => {
  try {
    return Color.contrastWCAG21(a, b);
  } catch {
    return null;
  }
};

export const conformance = (ratio: number, large: boolean): Conformance => {
  const [aaa, aa] = large ? [4.5, 3] : [7, 4.5];
  if (ratio >= aaa) return 'AAA';
  if (ratio >= aa) return 'AA';
  return 'Fail';
};

/** Null if either colour is unparseable, so callers can render a placeholder. */
export const report = (background: string, foreground: string): ContrastReport | null => {
  try {
    const ratio = Color.contrastWCAG21(background, foreground);
    return {
      ratio,
      smallText: conformance(ratio, false),
      largeText: conformance(ratio, true),
      apca: Color.contrastAPCA(background, foreground),
    };
  } catch {
    return null;
  }
};
