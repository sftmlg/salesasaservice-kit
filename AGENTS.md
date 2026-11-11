# Agent notes

Unofficial kit for the Sales as a Service marketplace. Read the README first.

- Stack: pnpm workspace, TypeScript strict, Biome, vitest. Code is in `packages/saas-kit/src`, tests in `packages/saas-kit/tests`, no `.mjs`, no ad-hoc scripts folder.
- Check: `pnpm check` (typecheck, Biome, tests) must be green before a pull request.
- The procedure catalogue has one source, `packages/saas-kit/data/procedures.json`. `docs/openapi.json` and `docs/procedure-catalogue.md` are generated from it by `saas-kit docs` and a test fails when they drift. Edit the source, regenerate, do not edit the outputs.
- Mutations always go through the confirm guard; never add a write path that bypasses it, and never probe with anything but `GET`.
- Credentials come only from `SAAS_CREDENTIALS_FILE` or `SAAS_EMAIL` and `SAAS_PASSWORD`, the session only from `SAAS_SESSION_FILE`. Nothing secret is committed.
- English throughout, no em dash character. Every test name states the bug it would catch.
- This is an unofficial description derived from the web app; keep that statement in the README and the API reference.
