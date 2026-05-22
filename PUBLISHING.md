# Publishing `@seamless/node`

Both `@seamless` and `@withseamless` org names were unclaimed on
npm as of 2026-05-22. PARTNER-API.md's locked decision is
`@seamless/*` first; fall back to `@withseamless/*` only if
`seamless` becomes unavailable.

## One-time setup

1. **Create the org on npmjs.com.** Free tier is fine for public
   packages — https://www.npmjs.com/org/create → pick `seamless`.
   (Operator's npm account must be a member.)
2. **Log in locally:**
   ```
   npm login
   ```

## Publish

From `seamless-node/`:

```bash
npm run build      # emits dist/
npm publish --access public
```

`--access public` is required because the package is scoped — npm
defaults scoped packages to private otherwise. Verify with:

```bash
npm view @seamless/node version
# → 1.0.0
```

## Bumping versions

The SDK tracks `api-withseamless/openapi.yaml`. Any additive change
to the spec → patch bump. New endpoint family or signature break →
minor bump. Wire-shape changes (rare, 12-month deprecation
required) → major bump. semver.

```bash
npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.x → 1.1.0
git push --tags
npm publish --access public
```

## CI automation (future)

Once the partner stream has traction, add a GitHub Action that:
1. Runs `npm run build` on every push to `dev`.
2. Publishes to npm on every tag matching `v*` (use `NPM_TOKEN`
   stored as a repo secret).

Not in scope for Phase 1.
