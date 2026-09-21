# 10-bit color precision exploration

The tests in `src/utils/colorPrecision.test.ts` explore significant-digit rounding
using the installed Color.js implementation. The editor now applies these
sampled limits through `src/utils/colorEditing.ts`: 4 significant digits for
RGB and alpha, 5 for HSL, and 6 for OKLCH.

Run the exploration and print its tables:

```sh
npm test -- src/utils/colorPrecision.test.ts --silent=false --disableConsoleIntercept --reporter=verbose
```

## Method

Each conversion path uses 26,225 unique 10-bit RGB colors: a boundary-heavy
17-by-17-by-17 grid, every neutral level, near-neutrals, primary and gamut-edge
ramps, and 8,192 seeded pseudorandom samples (before deduplication).

Convert encoded RGB to HSL or OKLCH, round each coordinate to 2 through 7
significant digits using `Number.toPrecision`, then convert back. HSL uses degrees
and percentages; OKLCH uses its Color.js native coordinates, with hue in degrees.
No hex serialization, clipping, or gamut mapping is applied. HSL is tested with
sRGB; OKLCH is tested with both sRGB and Display P3.

A precision passes when every reconstructed channel rounds to its original code
and the maximum absolute error is below half a 10-bit code step. An unrounded
conversion provides the baseline. A separate test exhausts all 1,024 normalized
channel values, also applicable to standalone alpha.

## Measured results

| Conversion | Sampled minimum significant digits | Maximum error at that precision, in code steps | Failed colors at one fewer digit |
| --- | ---: | ---: | ---: |
| sRGB → HSL → sRGB | 5 | 0.085000 | 2,065 |
| sRGB → OKLCH → sRGB | 6 | 0.142183 | 1,030 |
| Display P3 → OKLCH → Display P3 | 6 | 0.119009 | 888 |

Normalized RGB requires 4 significant digits to recover all 1,024 original codes;
3 fails. The unrounded conversion baselines stay below 7e-11 code steps.

Examples of why the preceding precision fails:

- HSL at 4 digits: sRGB `(15, 31, 1021)` has a maximum channel error of 0.878644 code steps.
- OKLCH at 5 digits: sRGB `(0, 1023, 72)` has an error of 1.397893 code steps.
- OKLCH at 5 digits: Display P3 `(0, 1022, 0)` has an error of 1.211892 code steps.

These are sampled minima, not guarantees over all 1,073,741,824 RGB combinations.
The tests lock in the observed minima and verify that higher tested precisions
also pass. Tables include failure counts and worst-case inputs for every tested
precision, making changes in Color.js behavior visible.

This measures one conversion round trip from a 10-bit code grid. It does not
establish guarantees for arbitrary values near quantization boundaries, repeated
edits, alpha compositing, HDR transfer functions, cross-gamut mapping, or browser
color management. The separate `colorEditing.test.ts` suite checks the actual UI serializer against
a boundary-heavy 10-bit RGB grid and checks every 10-bit channel through the
RGB/alpha slider position mapping. Sliders use a million-position grid; numeric
entry bypasses that grid and rounds by significant digits. Opening or focusing
a field does not commit a color change. These checks do not constitute a browser
interaction test.
