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

## Document properties

_md2conf_ reads a page ID, a space key and a `generated-by` note from HTML comments, and the
rest of the page settings from YAML or JSON front-matter (the front-matter itself may also be
wrapped in an HTML comment). The comments are the same as upstream's:

```markdown
<!-- confluence-page-id: 19840101 -->
<!-- confluence-space-key: SPACE -->
<!-- generated-by: This page has been generated with md2conf. -->
```

The front-matter keys, with upstream's spelling:

```yaml
---
# page title; otherwise the first top-level heading is used
title: 'Example document'
# Confluence page ID, also accepted as confluence_page_id; needs no quotes
page_id: 19840101
# Confluence space key, also accepted as confluence_space_key
space_key: SPACE
# page labels
tags: ['markdown', 'md']
# false keeps the page content in Confluence only
synchronized: true
# page properties to apply
properties:
  content-appearance-published: full-width
# layout options for this page
layout:
  alignment: left
  image:
    alignment: left
    max_width: 640
  table:
    width: 640
    # or responsive (default)
    display_mode: fixed
---
```

A key the scanner does not know is ignored, and reported in the debug log. Keys that upstream
supports but this release does not yet, such as `folder_id` for Confluence folders, are ignored
the same way.

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
