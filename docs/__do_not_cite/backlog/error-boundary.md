# No React error boundary

Nothing in the tree catches a render error. `src/js/app.tsx` mounts `App`
directly:

```tsx
const root = createRoot(container);
root.render(React.createElement(App));
```

A throw anywhere in a page unmounts the whole tree and leaves a blank `#app`.

## Why it matters more here than in a plain web app

This is a PWA with `skipWaiting` and `clientsClaim` set in `workbox-config.js`,
and everything is precached up front. A reload after a blank screen is served
the same build from the service worker, so the user cannot recover by refreshing
— the failing bundle is what comes back.

Palettes live in localStorage, so a render error caused by stored data would
reproduce on every load until the key is cleared, which the user has no in-app
way to do.

## Shape of a fix, not decided

A boundary needs somewhere to send the user that does not depend on the thing
that threw. Candidates: a static fallback with the export payload offered as a
download so data can be rescued, or a reset that clears `lliw.palettes` after
confirmation. Neither designed.
