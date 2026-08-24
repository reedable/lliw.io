# Content Security Policy

`src/index.html` carries a Cordova-era comment block linking cordova.apache.org,
above this meta tag:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: content:">
```

`default-src *` with `unsafe-inline` and `unsafe-eval` restricts nothing. It is
scaffold left over from the Framework7 CLI template, and removing it changes no
behaviour.

## Two directions

**Remove it.** No behavioural change. Leaves the app with no CSP.

**Replace it with a real one.** Its own task — the policy has to be derived from
what the app actually loads: the Vite bundle, the two icon fonts served from
`assets/`, inline styles Framework7 writes at runtime, and `blob:`/`data:` URLs
used by the export download in `src/pages/settings.tsx`.

## Constraint worth recording

`frame-ancestors` is ignored when a policy is delivered via `<meta>` — it
requires an HTTP response header. GitHub Pages does not allow custom response
headers, so anti-framing specifically is not achievable from `index.html` on the
current hosting.
