# Small cleanups

## theme colour disagrees with itself

`src/index.html` sets `<meta name="theme-color" content="#fff">`.
`src/manifest.json` sets `theme_color` and `background_color` to `#c8102e`.

The browser uses the meta tag, the installed PWA uses the manifest, so the two
contexts render different chrome. `#c8102e` is brand red (`BRAND.red` in
`src/js/colors.ts`), so the manifest is on-brand and the meta tag is not.

## floating comment in color.tsx

`src/pages/color.tsx` has a 17-line comment block explaining why `noToolbar` is
the only reliable way to suppress the app tabbar — F7's `pageBeforeIn` handler
branches on the `no-toolbar` class, so calling `app.toolbar.hide()` loses the
race. The explanation is worth keeping. It currently sits between two unrelated
declarations, attached to neither of the two `noToolbar` usages it describes.

## delete the localStorage key shim

The keys were renamed `palette.*` -> `lliw.*`. `migrateKey` in
`src/js/storage.ts`, its two call sites in `store.ts`, and the `LEGACY_*`
constants are a one-time move and are meant to be deleted.

Safe to delete once every browser holding data under the old keys has loaded the
app at least once. At the time of writing that is two testers, so it is a
question you can answer by asking them.

## vite.config.ts

Left alone deliberately: `treeshake: false` and `assetsInlineLimit: 0`. See
[bundle-size](bundle-size.md).
