import Color from 'colorjs.io';

/**
 * Contrast ratio between two colours, 1–21, using colorjs.io's WCAG 2.1
 * implementation. Null if either colour fails to parse, so callers can decide what
 * to render rather than getting NaN.
 */
export const contrastRatio = (a: string, b: string): number | null => {
  try {
    return Color.contrastWCAG21(a, b);
  } catch {
    return null;
  }
};
