# md2conf

Publish Markdown files to a Confluence wiki.

**Status: pre-MVP.** The rewrite is in progress and is tracked in the project board. The
command line interface today supports `--version` and `--help` only; conversion flags and
publishing arrive with later issues.

## Upstream

This is a rewrite of [hunyadi/md2conf](https://github.com/hunyadi/md2conf) (Python, MIT).
We port the behaviour, not the Python idioms. The upstream notice is in
[NOTICE.md](NOTICE.md); this repository keeps its own MIT [LICENSE](LICENSE).

## Requirements

Node.js 22.15 or later.

## Usage

```console
$ npx md2conf --version
0.0.0
```

## Development

```console
$ npm ci             # install the pinned toolchain
$ npm run lint       # ESLint, type-checked rules
$ npm run typecheck  # tsc --noEmit
$ npm test           # vitest run
$ npm run build      # emit dist/ with tsc
$ npm run format     # Prettier, rewriting in place
```

Architecture and tooling decisions are recorded as ADRs in [docs/adr](docs/adr).

## Licence

MIT. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
