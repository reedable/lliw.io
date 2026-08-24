# Linting and formatting

No linter or formatter is configured. No ESLint, Prettier, Biome, oxlint, or
`.editorconfig`. `tsc --noEmit` runs clean and gates `build`, so type errors are
caught; nothing else is.

## ESLint + typescript-eslint is blocked on TypeScript 7

Verified 2026-08-23 against `typescript@7.0.2`, by installing it and running it:

- `typescript-eslint@8.67.0` throws at module load when `ts.versionMajorMinor`
  major is >= 7 (`node_modules/typescript-eslint/dist/index.js:45-53`).
  Config-independent — type-aware or not, the package will not load.
- The same guard is compiled into `@typescript-eslint/parser` and
  `@typescript-eslint/eslint-plugin`, so importing the sub-packages directly
  does not get around it.
- `@typescript-eslint/typescript-estree` has no guard and still crashes on the
  TS 7 API (`Cannot read properties of undefined (reading 'Cjs')`), so the guard
  reflects a real API break rather than caution.
- Peer range is `typescript >=4.8.4 <6.1.0`. An npm `overrides` entry silences
  ERESOLVE but has no effect on the runtime guard.
- The documented workaround — run typescript-eslint against a side-by-side TS 6
  — cannot be wired through npm here. `typescript` is a *peerDependency*, so it
  must resolve at root scope, and npm refuses to nest a second copy:
  `Conflicting peer dependency: typescript@6.0.3`.
- Upstream: typescript-eslint#10940, "support for TS >=7.1". No release, no
  `next` tag as of 2026-08-23.

Downgrading the project to TypeScript 6 would unblock it. **Rejected** — staying
on 7.

## Remaining candidates, neither evaluated

**ESLint 10 without typescript-eslint, plus Prettier.** Works today, no peer
conflict. `eslint-plugin-react-hooks@7.1.1` peers ESLint ^10 and needs no type
information, so `exhaustive-deps` is available — the only automated check there
would be on the four coordinated effects in `PaletteCard`
(`src/pages/home.tsx`). Cost: no TS-specific rules at all, so the four
`(e: any)` handlers in `src/pages/color.tsx` and `src/pages/settings.tsx` stay
uncaught.

**oxlint plus Prettier.** Optional peer `oxlint-tsgolint@7.0.2001` is versioned
against TS 7, making it the only type-aware path not blocked. Rule coverage and
react-hooks support on this codebase are unverified.

## Cleanup owed

`node_modules/@eslint` and `node_modules/@typescript-eslint` may still be
orphaned in the working tree from the abandoned install. They are not in
`package-lock.json`; `npm ci` clears them.
