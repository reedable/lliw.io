# Reduced motion is not honoured anywhere

`prefers-reduced-motion` does not appear in the codebase. Every animation runs
unconditionally, on every device, regardless of the OS accessibility setting.

## What currently animates

CSS, in `src/css/global.css`, `src/pages/HomePage.module.css`, and
`src/pages/PaletteCard.module.css`:

- `.pcard.isLifted` — `top`, `left`, `width`, `height`, `border-radius`, 300ms.
  The card expand/collapse. The largest movement in the app: a row grows to fill
  the viewport.
- `.paletteHero` — `height`, 300ms, in step with the card.
- `.paletteSwatches` — `transform`, 100ms, the swatch strip uncropping.
- `.controlBack` / `.controlEdit` / `.controlAdd` — `transform`, 300ms, the
  controls sliding in and out of the top of the viewport.
- `html.pcard-open .views > .tabbar` — `transform`, 300ms, the tab bar sliding
  away.

JavaScript, `src/pages/home.tsx`:

- The scroll unwind in `PaletteCard`. A `requestAnimationFrame` tween driving
  `scrollTop` back to 0 over `LIFT_MS`, following a hand-evaluated
  `cubic-bezier(0.25, 0.1, 0.25, 1)`. **This one is not covered by a CSS media
  query** — it is imperative, so honouring the setting means reading
  `matchMedia('(prefers-reduced-motion: reduce)')` in the component and jumping
  `scrollTop` to 0 instead of tweening.

Third party:

- Swiper's slide transitions on the colour page hero.
- Framework7's own page transitions, dialogs, and swipeout. F7 has its own
  animation settings; whether they read `prefers-reduced-motion` is unverified.

## Why it matters here beyond the usual

The card expand is a full-viewport geometry change triggered by a tap. That is
exactly the class of motion the setting exists for — vestibular triggers are
about large-area movement, not decoration.

## Not decided

Whether it is purely `prefers-reduced-motion`, or an in-app setting seeded from
it. The theme setting already establishes the second pattern: the OS value is
the default and the setting exists to override a guess. Reduced motion has a
stronger claim to that treatment, since the OS setting is global and a user may
want it in some apps and not others.

If it becomes a setting it joins `Settings` in `src/utils/types.ts`, which is
unversioned — losing it is a reset, not a loss, so no schema work is implied.

## Related

Any future use of the HDR white asset (`src/assets/white-7.5x.jpg`) for tap
feedback should be gated by whatever this resolves to. A luminance bloom is not
motion, so the fit is imperfect, but it is the conventional control and there is
no better signal available.
