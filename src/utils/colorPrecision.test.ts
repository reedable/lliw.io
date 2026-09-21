import Color from "colorjs.io";
import { describe, expect, it } from "vitest";

type Triple = [number, number, number];
const MAX = 1023;
const DIGITS = [2, 3, 4, 5, 6, 7];
const roundSignificant = (value: number, digits: number) => Number(value.toPrecision(digits));

// Finite, reproducible exploration, not an exhaustive proof over 1024^3 colors.
// RGB codes are encoded (nonlinear) sRGB or Display P3, not linear-light RGB.
const makeSamples = (): Triple[] => {
  const samples = new Map<string, Triple>();
  const add = (value: Triple) => samples.set(value.join(","), value);
  const levels = [0, 1, 2, 3, 15, 31, 63, 127, 255, 511, 512, 767, 959, 991, 1021, 1022, 1023];
  for (const r of levels) for (const g of levels) for (const b of levels) add([r, g, b]);
  for (let n = 0; n <= MAX; n++) {
    add([n, n, n]);
    // Near-neutral colors, black/white boundaries, primaries and gamut edges.
    for (let axis = 0; axis < 3; axis++) {
      for (const base of [0, MAX, n]) {
        const value: Triple = [base, base, base];
        value[axis] = base === n ? Math.min(MAX, n + 1) : n;
        add(value);
      }
      const edge: Triple = [0, MAX, n];
      add([edge[axis], edge[(axis + 1) % 3], edge[(axis + 2) % 3]]);
    }
  }
  let seed = 0x10b17;
  const randomCode = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed >>> 22;
  };
  for (let i = 0; i < 8192; i++) add([randomCode(), randomCode(), randomCode()]);
  return [...samples.values()];
};
const samples = makeSamples();

interface Result {
  digits: number;
  failedColors: number;
  maxErrorSteps: number;
  worstInput: Triple | null;
}

// No hex serialization, clipping, or gamut mapping: those would introduce or
// conceal quantization independently of significant-digit rounding.
const sweep = (rgbSpace: "srgb" | "p3", intermediate: "hsl" | "oklch") => {
  const results: Result[] = DIGITS.map((digits) => ({
    digits,
    failedColors: 0,
    maxErrorSteps: 0,
    worstInput: null,
  }));
  let baselineMaxErrorSteps = 0;
  for (const codes of samples) {
    const source = new Color(rgbSpace, codes.map((code) => code / MAX) as Triple);
    const converted = source.to(intermediate);
    const baseline = converted.to(rgbSpace).coords;
    baseline.forEach((channel, i) => {
      const error = Math.abs((channel ?? 0) * MAX - codes[i]);
      baselineMaxErrorSteps = Math.max(baselineMaxErrorSteps, error);
    });
    for (const result of results) {
      const rounded = converted.coords.map((channel) =>
        channel === null ? null : roundSignificant(channel, result.digits),
      );
      const restored = new Color(
        intermediate,
        rounded as [number | null, number | null, number | null],
      ).to(rgbSpace).coords;
      let failed = false;
      restored.forEach((channel, i) => {
        const actual = (channel ?? 0) * MAX;
        if (!Number.isFinite(actual)) throw new Error(`Non-finite channel for ${codes}`);
        const error = Math.abs(actual - codes[i]);
        if (error > result.maxErrorSteps) {
          result.maxErrorSteps = error;
          result.worstInput = codes;
        }
        if (Math.round(actual) !== codes[i]) failed = true;
      });
      if (failed) result.failedColors++;
    }
  }
  return { results, baselineMaxErrorSteps };
};

describe("10-bit significant-digit exploration", () => {
  it("recovers all 1024 channel codes with four normalized significant digits, but not three", () => {
    const failures = (digits: number) =>
      Array.from({ length: MAX + 1 }, (_, code) => code).filter(
        (code) => Math.round(roundSignificant(code / MAX, digits) * MAX) !== code,
      );
    expect(failures(4)).toEqual([]);
    expect(failures(3).length).toBeGreaterThan(0);
    // This also covers standalone 10-bit alpha; compositing is a separate path.
  });

  for (const [rgbSpace, intermediate] of [
    ["srgb", "hsl"],
    ["srgb", "oklch"],
    ["p3", "oklch"],
  ] as const) {
    it(`${rgbSpace} → ${intermediate} → ${rgbSpace}: finds a sampled minimum`, () => {
      const { results, baselineMaxErrorSteps } = sweep(rgbSpace, intermediate);
      const minimum = results.find(
        (result) => result.failedColors === 0 && result.maxErrorSteps < 0.5,
      );
      console.info(
        `${rgbSpace} → ${intermediate}: ${samples.length} colors; baseline max error ${baselineMaxErrorSteps} code steps; sampled minimum ${minimum?.digits ?? "not found"} significant digits`,
      );
      console.table(
        results.map((result) => ({
          ...result,
          worstInput: result.worstInput?.join(","),
        })),
      );
      expect(baselineMaxErrorSteps).toBeLessThan(0.5);
      expect(minimum, "No tested precision preserved every sample").toBeDefined();
      expect(minimum?.digits).toBe(intermediate === "hsl" ? 5 : 6);
      expect(results[0].failedColors, "Low-precision negative control must fail").toBeGreaterThan(
        0,
      );
      for (const result of results.filter((result) => result.digits >= minimum!.digits)) {
        expect(result.failedColors).toBe(0);
        expect(result.maxErrorSteps).toBeLessThan(0.5);
      }
    }, 60_000);
  }
});
