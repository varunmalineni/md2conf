# ADR 0009: A `!!!` marker opens a block wherever Python-Markdown opens one

- Status: Accepted (Engineer proposal on ZER-64, 2026-10-14)
- Context issues: ZER-31, ZER-62, ZER-64
- Amends: ADR 0003

## Context

ADR 0003 §4 makes a difference a `docs/dialect.md` row when it comes from the parser rather
than from one of our rules. ZER-62 measured two shapes in which a `!!!` marker inside a list
item did not open a block here and did upstream, and had recorded them as dialect rows. Both
come from our own admonition rule in `src/markdown.ts`.

Python-Markdown parses a list item by taking the text that follows the item marker and
parsing it as one block. A marker on the item's first line is therefore at the start of a
block, and opens one:

```text
- !!! note
    body
```

Upstream (md2conf 0.6.4, Python-Markdown 3.11.1) gives `<li><div class="admonition note">`
with `body` as the div's text, and gives the same for `1. !!! note "T"` with a blank line
before the body. markdown-it tokenizes the item's content with every block rule, so the
rule does see the item's first line, but our rule refused it there: it asked for four
columns of indentation past the item's margin, and the item's first line sits at that
margin. It also read the marker from the start of the line, where the item marker is, and
not from the text after it.

Three further details follow from the same parser:

- **The body of a marker on the item's first line.** Python-Markdown's `indent` processor
  removes one tab stop from a block that starts a tab stop or more into the line, and the
  list processor then drops the item marker from the item's first line only, so the lines
  after it keep the columns of the source. `body` at four columns is the body of `- !!!
  note`, even though it is only two columns past the marker, and a blank line ends that
  block the way it ends any other.
- **The paragraphs inside it.** Python-Markdown parses a whole list item in its `list`
  parser state, which wraps nothing in `<p>`, and the admonition processor does not change
  that state. A block quote does change it, so a quote inside the admonition keeps its
  `<p>`. markdown-it drops the `<p>` of the blocks a tight list item holds *directly*; the
  blocks our admonition holds are one level deeper, where it keeps them.
- **The first item of a continued list.** That item alone is parsed in the `looselist`
  state, which wraps its paragraphs, so `- a`, a blank line and `- !!! note` with a body
  gives `<p>body</p>` inside the div.

## Decision

The admonition rule mirrors those three details rather than recording them as differences:

1. `lineContent` reads a line from `bMarks + tShift`, which on an item's first line is the
   text after the item marker.
2. A marker on the first line of a list item opens the item's first block when it sits at
   the item's margin.
3. For such a marker the body is the run of lines that follow it with four columns of
   indentation, counted from the column the enclosing list's `indent` processor would have
   started the block at, and a blank line ends it.
4. The paragraphs of such a body carry no `<p>` unless the item is the first item of a list
   that continues the one above it, or they are inside a block quote.

## Alternatives considered

- **Record the two shapes as `docs/dialect.md` rows.** Rejected under ADR 0003 §4: neither
  difference comes from the parser, both come from a rule of ours, and both are cheap to
  get right. A row would also tell authors to write `!!! note` on the second line of an
  item, which is a shape upstream does not produce for a body.
- **Accept the item's first line only in `silent` mode, or with a marker-only special case
  in the paragraph rule.** Rejected. The item's first line is a block start like any other
  and markdown-it already offers every block rule; the two conditions above are the parser's
  own.
- **Keep markdown-it's tight-list rule as the only source of `<p>` suppression.** Rejected:
  it cannot see into the block we open, and the difference is not about tightness at all.
  A loose list whose first item carries a marker keeps its text unwrapped upstream, which
  markdown-it has no notion of.

## Consequences

- `docs/dialect.md` gets no row for a marker on a list item's first line, and rows D1 and D2
  stay what they are: the two shapes there follow from how Python-Markdown continues a list
  item, which is a parser difference (ADR 0003 §1).
- Our output for these shapes is upstream's, so `converter.ts` sees the same elements.
- The rule now models Python-Markdown's item parsing in three places. The measurements
  behind each are in the tests in `tests/test_markdown.test.ts`, and the code says which
  Python-Markdown behaviour each line stands for.