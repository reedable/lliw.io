import Color from "colorjs.io";

/*
 * colorjs.io's contrastWCAG21 ignores alpha entirely: #C8102E00 — fully
 * transparent — reports 5.88 against white, exactly as the opaque #C8102E does.
 * Measured, not assumed. So a colour carrying an alpha channel has to be
 * composited onto something before it can be measured, or the app certifies AA
 * and AAA passes for pairings that are invisible.
 */

/*
 * What a translucent colour is taken to sit on. framework7.json has
 * theming.darkMode: false, so the app is light-only and white is what a
 * translucent colour actually composites over on screen.
 *
 * This has to stay in step with the opaque base painted under every surface
 * that renders a colour (the combo, chip, and hero-slide rules in the page CSS
 * modules). If the two ever disagree, the number and the picture disagree.
 */
const BASE = "#ffffff";

/**
 * Alpha-blends `fg` over `bg` in sRGB: `a*fg + (1-a)*bg` per channel. An opaque
 * `fg` returns itself.
 */
export const composite = (fg: Color, bg: Color): Color => {
  const a = fg.alpha;
  if (a >= 1) return fg;
  /*
   * `coords` is nullable: CSS Color 4 allows a `none` component, which colorjs
   * carries through as null. Treated as 0 here — a channel with no value
   * contributes nothing to the blend, which is what `none` means when a colour
   * is actually rendered.
   */
  const f = fg.to("srgb").coords;
  const b = bg.to("srgb").coords;
  const mix = (i: number) => a * (f[i] ?? 0) + (1 - a) * (b[i] ?? 0);
  return new Color("srgb", [mix(0), mix(1), mix(2)]);
};

/**
 * The opaque colour that `value` actually appears as on screen, once composited
 * onto the base. Returns the input unchanged if it does not parse.
 *
 * Used where something has to reason about what is *visible* rather than what
 * was stored — the swiper pagination bullets derive their colour from the hero
 * via CSS contrast-color(), and handing that a translucent value would have it
 * pick a contrast against a colour nobody sees.
 */
export const flatten = (value: string): string => {
  try {
    return composite(new Color(value), new Color(BASE)).to("srgb").toString({ format: "hex" });
  } catch {
    return value;
  }
};

/**
 * One stable spelling per colour, for comparing two values for sameness.
 *
 * Case, shorthand and a redundant alpha of `ff` all collapse, so `#FF0000`,
 * `#f00` and `#ff0000ff` are one colour. Genuinely different alphas stay
 * distinct. Falls back to the lowercased input if it does not parse, so an
 * unreadable value still compares equal to itself.
 */
export const canonical = (value: string): string => {
  try {
    return new Color(value).to("srgb").toString({ format: "hex" });
  } catch {
    return value.toLowerCase();
  }
};

/**
 * Contrast ratio between two colours, 1–21, using colorjs.io's WCAG 2.1
 * implementation. Null if either colour fails to parse, so callers can decide
 * what to render rather than getting NaN.
 *
 * Translucent colours are composited first: the background onto BASE, then the
 * foreground onto that result. For two opaque colours this is exactly
 * contrastWCAG21 and returns identical numbers to before alpha existed.
 *
 * Note this is no longer symmetric. With alpha involved,
 * `contrastRatio(a, b) !== contrastRatio(b, a)`, because which colour is laid
 * over which changes what is actually rendered. Callers that used to compute
 * one ratio per pair have to compute both directions.
 */
export const contrastRatio = (foreground: string, background: string): number | null => {
  try {
    const base = new Color(BASE);
    const bg = composite(new Color(background), base);
    const fg = composite(new Color(foreground), bg);
    return Color.contrastWCAG21(fg, bg);
  } catch {
    return null;
  }
};
