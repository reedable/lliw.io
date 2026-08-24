# PaletteCard complexity

`PaletteCard` in `src/pages/home.tsx` is the app's concentration of risk: a
hand-rolled FLIP animation carrying a three-value `Phase` machine, four refs, and
four coordinated effects (two of them `useLayoutEffect`), plus a two-frame `rAF`
release and a manually driven scroll unwind.

It is heavily commented and the comments explain real browser constraints — the
positioning-scheme problem that makes both animation endpoints `position: fixed`,
why the pinned rect must be painted before the viewport rect replaces it, why the
closing effect deliberately returns no cleanup. None of that is speculative and
none of it should be removed without reading it.

It is also the component you edit to change anything in the card body, and it has
no tests.

## Two specific couplings

**`LIFT_MS` is duplicated across JS and CSS.** `const LIFT_MS = 300` in
`home.tsx`; `300ms` appears five times in `.pcard.is-lifted`'s transition and
again in `html.pcard-open .views > .tabbar` (`src/css/app.css`). The comments on
both sides note the coupling; nothing enforces it. A CSS custom property read
back via `getComputedStyle`, or a shared constant injected into CSS, would make
one of them derive from the other.

**`ease()` reimplements a CSS timing function in JS.** `home.tsx` contains 19
lines evaluating `cubic-bezier(0.25, 0.1, 0.25, 1)` by bisection, because the
scroll unwind is driven from JS and must follow the same curve the geometry is
transitioning along. It is correct. It also contains dead arithmetic:
`bx = 3 * (0.25 - 0.25) - cx` is always `-cx`, since x1 and x2 are equal. The
curve is declared in two places.

## Not decided

Whether to leave it as-is (it works, and the comments carry the reasoning) or to
extract the FLIP mechanics into a hook so the component reads as markup again.
The second is only safe with tests, which cannot cover the animation itself —
only the phase transitions.
