# Markdown dialect: where we differ from upstream

md2conf parses CommonMark as markdown-it implements it, plus the extensions listed in
[ADR 0003](adr/0003-markdown-dialect-and-recorded-differences.md) §1. Upstream md2conf parses
Python-Markdown, which is not CommonMark, so some documents convert differently. This page lists
every known difference: the construct, what upstream produces, what we produce, why, and the golden
fixture that shows it.

A row is a difference in the parser's dialect, never a converter bug (ADR 0003 §4). An Engineer who
finds one measures it against upstream first, then adds the row in the same PR that introduces the
`override`.

## Differences in the published page

No difference is recorded yet. The first rows land with the converter issues that move a fixture to
`override` in [`tests/manifest.json`](../tests/manifest.json).

| ID  | Construct                  | Upstream | Ours | Why | Fixture |
| --- | -------------------------- | -------- | ---- | --- | ------- |
| —   | No difference recorded yet | —        | —    | —   | —       |

## Adding a row

1. Measure the difference against upstream's `markdownToHtml` on the smallest input that shows it,
   and confirm it comes from the parser and not from our rules (ADR 0003 §4).
2. Give the row the next free ID, and record the construct, both outputs, the reason and the golden
   fixture that reproduces it.
3. Mark that fixture `override` in [`tests/manifest.json`](../tests/manifest.json). A test fails when
   an `override` has no row here.
