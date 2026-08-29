# Bundle size

Measured from the build on 2026-08-23:

|             | raw      | gzip   |
| ----------- | -------- | ------ |
| `index.js`  | 1,206 kB | 341 kB |
| `index.css` | 512 kB   | 75 kB  |

Vite emits its own warning that chunks exceed 500 kB. The service worker
precaches 15 URLs totalling 2.33 MB, all up front — there is no lazy chunk, which
is what makes `skipWaiting` / `clientsClaim` safe (see `workbox-config.js`).

## Three contributing settings, all template defaults

- `vite.config.ts`: `rollupOptions.treeshake: false` — no dead-code elimination.
- `vite.config.ts`: `assetsInlineLimit: 0` — nothing is inlined as a data URI.
- `src/main.tsx`: `import 'framework7/css/bundle'` — the whole Framework7
  stylesheet, both themes, every component.

## Unknown

How much any of these actually costs here has not been measured. Turning
treeshaking on is a one-line experiment, but Framework7 v9 registers components
in ways that can defeat static analysis, so the result has to be checked by
running the app rather than by reading the bundle size alone. The same applies to
narrowing the CSS import: both themes are reachable at runtime via the `theme`
setting (`auto` / `ios` / `md`), so neither can be dropped.

Not a problem to solve until there is a reason — a first-load target, or a
complaint. Recorded so the numbers do not have to be re-measured.
