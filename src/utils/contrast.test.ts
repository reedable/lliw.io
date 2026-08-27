import { describe, expect, it } from 'vitest';

import { canonical, contrastRatio, flatten } from './contrast';

/*
 * The regression guard comes first and matters most. Alpha support must not
 * move a single opaque number — these were captured from the previous
 * implementation (a bare Color.contrastWCAG21 call) before it was changed.
 */
const OPAQUE_BASELINE: [string, string, number][] = [
  ['#C8102E', '#FFFFFF', 5.8825],
  ['#C8102E', '#00B140', 2.0624],
  ['#C8102E', '#012169', 2.5091],
  ['#C8102E', '#FFFF00', 5.4781],
  ['#C8102E', '#000000', 3.5699],
  ['#FFFFFF', '#00B140', 2.8523],
  ['#FFFFFF', '#012169', 14.7598],
  ['#FFFFFF', '#FFFF00', 1.0738],
  ['#FFFFFF', '#000000', 21.0],
  ['#757575', '#FFFFFF', 4.6072],
  ['#757575', '#000000', 4.5581],
  ['#264653', '#e9c46a', 6.0331],
  ['#2a9d8f', '#f4a261', 1.6126],
];

describe('opaque colours are unchanged by alpha support', () => {
  it.each(OPAQUE_BASELINE)('%s on %s stays %f', (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 3);
  });

  it('is still symmetric when both colours are opaque', () => {
    for (const [fg, bg] of OPAQUE_BASELINE) {
      expect(contrastRatio(fg, bg)).toBeCloseTo(contrastRatio(bg, fg) as number, 10);
    }
  });
});

describe('alpha is accounted for', () => {
  /*
   * Before this change every one of these reported 5.8825, including the fully
   * transparent case.
   *
   * Alpha is the hex byte over 255, not a round fraction: `80` is 128/255 =
   * 0.50196, not 0.5. These expectations were computed from that exact value.
   */
  it.each([
    ['#C8102Eff', 5.8825],
    ['#C8102Ecc', 4.5265],
    ['#C8102E80', 2.5648],
    ['#C8102E40', 1.5657],
    ['#C8102E00', 1.0],
  ])('%s over white reads %f, not 5.88', (fg, expected) => {
    expect(contrastRatio(fg, '#ffffff')).toBeCloseTo(expected, 3);
  });

  it('treats a fully transparent colour as invisible, ratio 1', () => {
    expect(contrastRatio('#C8102E00', '#ffffff')).toBeCloseTo(1, 6);
  });

  it('treats a fully opaque 8-digit value as identical to its 6-digit form', () => {
    expect(contrastRatio('#C8102Eff', '#ffffff')).toBeCloseTo(
      contrastRatio('#C8102E', '#ffffff') as number,
      10,
    );
  });

  it('accepts 4-digit shorthand', () => {
    // #f008 is red at alpha 0.533.
    expect(contrastRatio('#f008', '#ffffff')).toBeCloseTo(
      contrastRatio('#ff000088', '#ffffff') as number,
      2,
    );
  });
});

describe('asymmetry, which only appears with alpha', () => {
  it('gives different numbers depending on which colour is on top', () => {
    const over = contrastRatio('#C8102E80', '#000000');
    const under = contrastRatio('#000000', '#C8102E80');
    expect(over).not.toBeCloseTo(under as number, 2);
  });

  it('composites a translucent background onto the white base', () => {
    /*
     * Black over a 50% red background: the background resolves to red-over-white
     * first, so the pairing is black against a light pink, not black against a
     * dark red.
     */
    const translucentBg = contrastRatio('#000000', '#C8102E80') as number;
    const opaqueBg = contrastRatio('#000000', '#C8102E') as number;
    expect(translucentBg).toBeGreaterThan(opaqueBg);
  });
});

describe('unparseable input', () => {
  it.each([
    ['not a colour', 'banana', '#ffffff'],
    ['empty string', '', '#ffffff'],
    ['half-typed hex', '#2a', '#ffffff'],
    ['bad background', '#ffffff', 'nope'],
  ])('returns null for %s', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeNull();
  });
});

describe('flatten', () => {
  it('leaves an opaque colour alone', () => {
    expect(flatten('#C8102E')).toBe(canonical('#C8102E'));
  });

  it('resolves a translucent colour to what is actually visible', () => {
    /*
     * #C8102E at alpha 128/255 over white. Hand-checked per channel:
     * R = 0.502*(200/255) + 0.498 = 0.892 -> e3, G -> 87, B -> 96.
     */
    expect(flatten('#C8102E80')).toBe(canonical('#e38796'));
  });

  it('resolves a fully transparent colour to the base', () => {
    expect(flatten('#C8102E00')).toBe(canonical('#ffffff'));
  });

  it('returns unparseable input unchanged', () => {
    expect(flatten('banana')).toBe('banana');
  });
});

describe('canonical', () => {
  it.each([
    ['#FF0000', '#ff0000'],
    ['#f00', '#ff0000'],
    ['#ff0000ff', '#ff0000'],
  ])('%s and %s are the same colour', (a, b) => {
    expect(canonical(a)).toBe(canonical(b));
  });

  it('keeps genuinely different alphas apart', () => {
    expect(canonical('#ff000080')).not.toBe(canonical('#ff0000'));
  });

  it('falls back to the lowercased input when it cannot parse', () => {
    expect(canonical('Banana')).toBe('banana');
  });
});
