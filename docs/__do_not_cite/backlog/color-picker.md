# Color picker

On hold. Nothing was built. This records the research so it does not have to be
redone.

The judgement that put it on hold: a picker is a large effort for low value in
this app. Developers punch in precise numbers, and the hex field already accepts
them — including alpha, since that work landed. It is wanted eventually, but it
is not a flagship feature.

`src/pages/home.tsx` still calls `DEFAULT_COLOR` "a placeholder until Add opens a
real picker". That comment is the origin of this item.

## What was established, 2026-08-25

**Framework7 ships one, and it is already loaded.** `ColorPicker` is present in
`framework7/lite-bundle`, which `src/js/app.tsx` already imports. Adding it costs
no bundle size.

**There is no React wrapper.** `framework7-react` has no ColorPicker component —
verified by listing `node_modules/framework7-react/components/`. It is core-only,
created imperatively through `f7.colorPicker.create({ containerEl, ... })`.

That makes it the same class of problem this codebase has hit twice and
documented both times: the `Toggle` `defaultChecked` note in
`src/pages/settings.tsx`, and the `SwipeoutButton close` note in
`src/pages/home.tsx`. The rule that worked both times is to let Framework7 own
its DOM — create once in an effect, destroy in cleanup, push updates in with
`setValue` rather than re-creating, and guard against the echo of the widget's
own change event.

**It is composed from modules**, in
`node_modules/framework7/components/color-picker/modules/`: `wheel`,
`sb-spectrum`, `hs-spectrum`, `hue-slider`, `brightness-slider`, `alpha-slider`,
`rgb-sliders`, `hsb-sliders`, `rgb-bars`, `hex`, `palette`, `current-color`,
`initial-current-colors`. Default is `['wheel']`.

**Its value object** is `{ hex, rgb, hsl, hsb, alpha, hue, rgba, hsla }`
(`color-picker-class.js:222-234`), so both the hex and the alpha needed for the
current `#rrggbbaa` storage format are directly available.

**Placement** can be inline via `containerEl`, or `popover` / `sheet` / `popup` /
`page`. Inline on the colour page was the preference at the time.

## Open questions if it is picked up

- Whether the picker style is a user setting. `SettingsSchema` in
  `src/js/types.ts` is unversioned by deliberate decision, so adding a
  `pickerModules` field needs no schema work.
- Gesture conflict. The colour page already hosts a horizontal Swiper and a
  vertical swipe-down that calls `preventDefault` on downward drags. A picker
  adds more drag targets to the same page. Needs testing on a real touch device,
  not a desktop browser.
- Whether it replaces the hex `ListInput` or sits alongside it. The field is
  currently the only way to enter a value and is what developers actually use.

## Not a blocker any more

Alpha was originally scoped as part of this work. It shipped separately and is
done: storage takes `#rrggbbaa`, `src/js/contrast.ts` composites before
measuring, and every rendering surface paints over an opaque base. A picker
would only need to enable the `alpha-slider` module.
