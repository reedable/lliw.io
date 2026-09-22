import Color from "colorjs.io";

export type ColorModel = "rgb" | "hsl" | "oklch";
export const COLOR_DIGITS = { rgb: 4, hsl: 5, oklch: 6, alpha: 4 } as const;
// Encoded sRGB channel spread, not HSL saturation percentage points.
export const HSL_NEUTRAL_RGB_SPREAD = 1e-12;
export const significant = (value: number, digits: number): number =>
  Number(value.toPrecision(digits));
export const channelDigits = (model: ColorModel, index: number) =>
  index === 3 ? COLOR_DIGITS.alpha : COLOR_DIGITS[model];

export const colorChannels = (value: string, model: ColorModel): number[] => {
  const source = new Color(value);
  const parsed = source.to(model === "rgb" ? "srgb" : model);
  if (model === "hsl") {
    const rgb = source.to("srgb").coords.map((v) => v ?? 0);
    if (Math.max(...rgb) - Math.min(...rgb) <= HSL_NEUTRAL_RGB_SPREAD) {
      return [0, 0, parsed.coords[2] ?? 0, parsed.alpha];
    }
  }
  return [...parsed.coords.map((v) => (v ?? 0) * (model === "rgb" ? 255 : 1)), parsed.alpha];
};

export const formatChannels = (values: number[], model: ColorModel): string => {
  const [x, y, z, a] = values.map((v, i) => significant(v, channelDigits(model, i)));
  if (model === "rgb") return `rgba(${x}, ${y}, ${z}, ${a})`;
  if (model === "hsl") return `hsla(${x}, ${y}%, ${z}%, ${a})`;
  return `oklch(${x} ${y} ${z} / ${a})`;
};

// Slider position resolution is independent of significant-digit formatting.
// Numeric entry bypasses this positional grid entirely.
export const SLIDER_TICKS = 1_000_000;
export const sliderPosition = (value: number, max: number) =>
  Math.round(Math.max(0, Math.min(1, value / max)) * SLIDER_TICKS);
export const sliderChannel = (position: number, max: number, digits: number) =>
  significant((position / SLIDER_TICKS) * max, digits);
