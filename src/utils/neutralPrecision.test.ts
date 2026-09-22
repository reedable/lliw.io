import Color from "colorjs.io";
import { describe, expect, it } from "vitest";

type Triple = [number, number, number];
const MAX = 1023;
const CUTOFFS = [
  1e-15, 1e-14, 1e-13, 1e-12, 1e-11, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6, 1e-4, 0.001, 0.002,
];
const coords = (color: Color, space: string) => color.to(space).coords.map((v) => v ?? 0) as Triple;
const spread = (rgb: Triple) => Math.max(...rgb) - Math.min(...rgb);
const codes = (rgb: Triple) => rgb.map((v) => Math.round(v * MAX) + 0);
const normalized = (color: Color) => {
  const hsl = coords(color, "hsl");
  return new Color("hsl", [0, 0, hsl[2]], color.alpha);
};

const neutrals: { name: string; color: Color }[] = [];
for (let n = 0; n <= MAX; n++) {
  const x = n / MAX;
  const gray = new Color("srgb", [x, x, x]);
  neutrals.push(
    { name: `sRGB gray ${n}`, color: gray },
    { name: `sRGB gray ${n} via OKLCH`, color: gray.to("oklch") },
    { name: `P3 gray ${n}`, color: new Color("p3", [x, x, x]) },
    { name: `OKLCH neutral L=${x}`, color: new Color("oklch", [x, 0, 0]) },
  );
}
// Probe conditioning near white/black, not just regularly spaced samples.
for (let exponent = 1; exponent <= 15; exponent++) {
  for (const lightness of [10 ** -exponent, 1 - 10 ** -exponent]) {
    neutrals.push({
      name: `OKLCH neutral L=${lightness}`,
      color: new Color("oklch", [lightness, 0, 0]),
    });
  }
}
neutrals.push({ name: "reported example", color: new Color("oklch(0.666667 0 0 / 1)") });

const nearNeutrals: Color[] = [];
for (let n = 0; n <= MAX; n++) {
  for (const delta of [-1, 1]) {
    if (n + delta < 0 || n + delta > MAX) continue;
    for (let axis = 0; axis < 3; axis++) {
      const rgb: Triple = [n / MAX, n / MAX, n / MAX];
      rgb[axis] = (n + delta) / MAX;
      nearNeutrals.push(new Color("srgb", rgb));
    }
  }
}

describe("experimental neutral cutoff", () => {
  it("measures saturation residue and encoded-sRGB spread on known neutrals", () => {
    const measurements = neutrals.map(({ name, color }) => ({
      name,
      saturation: Math.abs(coords(color, "hsl")[1]),
      spread: spread(coords(color, "srgb")),
    }));
    const worstSaturation = measurements.reduce((a, b) => (a.saturation > b.saturation ? a : b));
    const worstSpread = measurements.reduce((a, b) => (a.spread > b.spread ? a : b));
    console.info("Known neutrals:", measurements.length, { worstSaturation, worstSpread });
    console.table(
      CUTOFFS.map((cutoff) => ({
        cutoff,
        missedByHslSaturation: measurements.filter((m) => m.saturation > cutoff).length,
        missedByRgbSpread: measurements.filter((m) => m.spread > cutoff).length,
      })),
    );
    // A saturation-only epsilon is ill-conditioned near white.
    expect(worstSaturation.saturation).toBeGreaterThan(1e-10);
    expect(worstSpread.spread).toBeGreaterThan(1e-15);
    expect(worstSpread.spread).toBeLessThan(1e-14);
  });

  it("sweeps RGB-spread cutoffs against all adjacent-code near-neutrals", () => {
    console.table(
      CUTOFFS.map((cutoff) => {
        let classified = 0;
        let changedCodes = 0;
        for (const color of nearNeutrals) {
          const rgb = coords(color, "srgb");
          if (spread(rgb) > cutoff) continue;
          classified++;
          const after = codes(coords(normalized(color), "srgb"));
          if (codes(rgb).some((code, i) => code !== after[i])) changedCodes++;
        }
        return { cutoff, classified, changedCodes };
      }),
    );
    expect(nearNeutrals).toHaveLength(6138);
    expect(nearNeutrals.every((color) => spread(coords(color, "srgb")) > 1e-12)).toBe(true);
    expect(nearNeutrals.some((color) => spread(coords(color, "srgb")) <= 0.001)).toBe(true);
  });

  it("zeroes hue/saturation of sampled neutrals without changing 10-bit output or alpha", () => {
    let maxErrorSteps = 0;
    for (const sample of neutrals) {
      const color = sample.color.clone();
      color.alpha = 0.123456789;
      const before = coords(color, "srgb");
      const result = normalized(color);
      const after = coords(result, "srgb");
      expect(codes(after)).toEqual(codes(before));
      expect(result.alpha).toBe(color.alpha);
      after.forEach((channel, i) => {
        maxErrorSteps = Math.max(maxErrorSteps, Math.abs(channel - before[i]) * MAX);
      });
    }
    console.info("Maximum neutral normalization error in 10-bit steps:", maxErrorSteps);
    expect(maxErrorSteps).toBeLessThan(0.5);
  });

  it("bounds the effect on deliberate sub-code chroma, rather than claiming it is all noise", () => {
    let classified = 0;
    let retained = 0;
    let maxErrorSteps = 0;
    for (const l of [0.01, 0.1, 0.5, 0.9, 0.99]) {
      for (const hue of [0, 60, 120, 180, 240, 300]) {
        for (let exponent = 4; exponent <= 15; exponent++) {
          const color = new Color("oklch", [l, 10 ** -exponent, hue]);
          const rgb = coords(color, "srgb");
          if (spread(rgb) > 1e-12) {
            retained++;
            continue;
          }
          classified++;
          const after = coords(normalized(color), "srgb");
          after.forEach((channel, i) => {
            maxErrorSteps = Math.max(maxErrorSteps, Math.abs(channel - rgb[i]) * MAX);
          });
        }
      }
    }
    console.info("Deliberate tiny chroma:", { classified, retained, maxErrorSteps });
    expect(classified).toBeGreaterThan(0);
    expect(retained).toBeGreaterThan(0);
    expect(maxErrorSteps).toBeLessThan(0.5);
  });
});
