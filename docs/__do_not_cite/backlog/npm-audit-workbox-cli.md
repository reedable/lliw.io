# npm audit: the workbox-cli chain

```
workbox-cli@7.4.1 -> inquirer@7.3.3 -> external-editor@3.1.0 -> tmp@0.0.33
```

Two high-severity advisories against `tmp` (GHSA-52f5-9888-hmc6 symlink write,
GHSA-ph9p-34f9-6g65 path traversal via unsanitized prefix/postfix).

## Reachability, verified 2026-08-23

`inquirer` is required only by `workbox-cli/build/lib/questions/*`, reached via
`run-wizard.js`, reached only from `case 'wizard'` in `app.js:81`. The build runs
`npx workbox generateSW workbox-config.js`, a different branch.

**However:** `app.js:47` does a top-level `require('./lib/run-wizard.js')`, so
`inquirer` and `tmp` are loaded into the process on every `workbox` invocation,
`generateSW` included. Loaded is not exercised — both advisories need
attacker-controlled `dir` / `prefix` / `postfix` reaching `tmp`, and nothing on
the `generateSW` path calls it — but "not loaded at all" would be the stronger
claim and it is not true.

Exposure: `workbox-cli` is a devDependency, run on a developer machine and in
the GitHub Actions build on a trusted checkout of this repo. No untrusted input
reaches it.

## Why the offered fix is not available

`npm audit fix --force` installs `workbox-cli@2.1.3` — the 2018 line, six majors
back. `generateSW` in v2 does not accept the current `workbox-config.js`:
`skipWaiting` and `clientsClaim` as top-level options are v4+, and the comment in
that file documents why both matter for iOS PWA staleness. No non-breaking fix
exists; `7.4.1` is current and still pins `inquirer@^7`.

## Options, none tested

1. Do nothing, record why. Audit stays red.
2. `npm audit --omit=dev`. Reports what ships to users; hides real dev-chain
   issues too.
3. Drop `workbox-cli`, call `workbox-build` directly. It is already installed as
   a dependency of workbox-cli and has no `inquirer`. Costs a small Node script
   replacing the `npx workbox generateSW` step. The `generateSW` export signature
   has not been checked against the current config.
4. `overrides` forcing `tmp@>=0.2.6`. `external-editor@3.1.0` pins `tmp@0.0.33`;
   the API gap across that jump is untested and would break `workbox wizard`.
