# Generated fonts are tracked

`package.json` has:

```
"postinstall": "cpy --flat ./node_modules/framework7-icons/fonts/*.* ./src/fonts/
              && cpy --flat ./node_modules/material-icons/iconfont/*.* ./src/fonts/"
```

27 of the resulting files are committed to git. `src/css/icons.css` references
four of them:

- `material-icons.woff2`, `material-icons.woff`
- `Framework7Icons-Regular.woff2`, `Framework7Icons-Regular.woff`

Unreferenced but tracked: 8 material-icons variant woffs (outlined, round, sharp,
two-tone), `Framework7Icons-Regular.ttf`, and 14 `.css` / `.scss` files shipped by
the two packages.

The repo is committing the output of its own `postinstall`.

## Why deleting them does not hold

`postinstall` re-copies everything on every `npm install`, so removing the
unused files from git leaves them reappearing untracked. Two ways to actually fix
it, neither chosen:

1. Narrow the `cpy` globs to the four files that are used.
2. Gitignore `src/fonts/` and let `postinstall` own the directory. CI already
   runs `npm ci`, which runs `postinstall`, so the build would still have them.

## Related unknown

Whether `framework7-icons` and `material-icons` count as used dependencies
cannot be settled statically: neither package name appears in `src/`, but
`postinstall` copies their fonts in and `icons.css` loads them by path. They are
real runtime dependencies through a filesystem hop. Do not remove them on the
basis of a grep.
