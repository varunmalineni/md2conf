# ADR 0005: Toolchain and dependency policy

- Status: Accepted (board accepted the ZER-28 plan, 2026-10-14); amended by ADR 0006 and ADR 0007
- Context issues: ZER-28

## Context

Three Engineers will work in parallel, and a Reviewer checks every PR against STANDARDS.md. The toolchain should be boring, quick in CI, and identical on every machine. npm supply-chain risk is the main weakness of the TypeScript choice (ADR 0001).

## Decision

| Concern | Choice |
|---|---|
| Runtime | Node.js LTS. `engines: ">=22.15"`. CI runs on Node 22 and 24. |
| Package manager | **npm** with a committed `package-lock.json`, installed with `npm ci`. No corepack or pnpm. |
| Module system | ESM only (`"type": "module"`), TypeScript `module: nodenext`. |
| Compiler | `tsc` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, emitting to `dist/`. No bundler for the CLI. |
| Tests | **vitest**. Golden fixtures are compared with a canonicalising XML comparison, not snapshot files. |
| Lint / format | **ESLint** (flat config, `typescript-eslint` type-checked rules, including `no-floating-promises`) and **Prettier**. |
| CI | GitHub Actions: lint, typecheck, test and build on Node 22 and 24. Docker images are built (not pushed) on PRs. |
| CLI parsing | `commander`, with environment-variable fallbacks declared next to each option. |
| HTTP | Built-in `fetch`, with a `fetch` function passed in so tests can replace it. `zod` schemas check every Confluence response. |
| Other runtime deps | `markdown-it` with `@mdit/plugin-*`, `@xmldom/xmldom`, `entities`, `yaml`, `ignore` (for `.mdignore`), `image-size`. |

Dependency rules:

1. A new runtime dependency needs a line in the PR description saying why the standard library or an existing dependency isn't enough.
2. Versions are pinned through the lockfile. Renovate or Dependabot is a separate follow-up.
3. Native addons are not allowed.

## Alternatives considered

- **pnpm.** Faster installs, but it adds a tool to every environment, and installs aren't our bottleneck.
- **Biome instead of ESLint and Prettier.** One fast tool, but its type-aware rules are less mature than `typescript-eslint`, and we want `no-floating-promises` in an I/O-heavy codebase.
- **Jest.** Slower with ESM and TypeScript, and needs more configuration than vitest.
- **yargs or oclif.** Heavier than we need for one command with flags.

## Consequences

- One `npm ci && npm test` works locally and in CI.
- The runtime dependency list is short enough to audit by hand in each PR.
