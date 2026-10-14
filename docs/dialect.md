# Markdown dialect: where we differ from upstream

md2conf parses CommonMark as markdown-it implements it, plus the extensions listed in [ADR 0003](adr/0003-markdown-dialect-and-recorded-differences.md) §1. Upstream md2conf parses Python-Markdown, which is not CommonMark. This page lists every known place where the same document converts differently. Each row is a difference in the parser's dialect, not a bug in the converter (ADR 0003 §4).

Every row was measured by running upstream's `markdown_to_html` (md2conf 0.6.4, Python-Markdown 3.11.1, pymdown-extensions 12.2) beside ours on the example input.

If a document hits a row, rewrite it in the form the last column gives. That form converts the same way in upstream and here.

## Differences in the published page

| ID  | Construct                                                                    | Upstream                                           | Ours                                | Why                                                                                            | Write it as                            | Fixture |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- | ------- |
| D1  | Paragraph after a blank line, indented less than 4 spaces, under a list item | Ends the list                                      | Stays in the item                   | Python-Markdown continues an item only at 4 spaces; CommonMark at the item's content column    | Indent the paragraph 4 spaces          | —       |
| D2  | Nested list indented 2 or 3 spaces                                           | Not nested                                         | Nested                              | Same as D1                                                                                     | Indent nested lists 4 spaces           | —       |
| D3  | Top-level list items indented 1 to 3 spaces, with a nested list at 4         | Nested                                             | The nested line is text of the item | Python-Markdown counts 4 spaces from the line start; CommonMark from the item's content column | Start top-level items at column 0      | —       |
| D4  | List directly after a paragraph line, with no blank line                     | Paragraph text                                     | A list                              | CommonMark lets a list interrupt a paragraph                                                   | Put a blank line before the list       | —       |
| D5  | List of the other type (`1.` and `-`) directly after a list                  | Text of the last item, or items of the nested list | A new list                          | `sane_lists` upstream; CommonMark starts a new list on a type change                           | Put a blank line between the two lists | —       |
| D6  | Blank line between some items of a list but not others                       | Only items next to a blank line get `<p>`          | Every item gets `<p>`               | CommonMark makes the whole list loose                                                          | Blank lines between all items or none  | —       |
| D7  | Block quote line without `>` that continues a block inside the quote         | Part of the block                                  | Ends the quote                      | CommonMark continues a quote lazily only for paragraph text                                    | Start every line of the quote with `>` | —       |

The fixture column names the upstream golden fixture in `tests/fixtures/manifest.json` that shows the row. `—` means no upstream fixture is known to hit the row yet.

### D1. Paragraph indented less than 4 spaces under a list item

```text
- a

  para
```

Upstream: `<ul><li>a</li></ul><p>para</p>`. Ours: `<ul><li><p>a</p><p>para</p></li></ul>`.

A `!!!` marker indented 4 spaces after such a paragraph follows from this: upstream makes it a code block after the list, and we make it an admonition in the item.

### D2. Nested list indented 2 or 3 spaces

```text
- a
  - b
```

```text
1. a
   - b
```

Upstream: `- b` is a second item of the same list, or the text `a - b` of item `1.`. Ours: `b` is a nested list in both.

### D3. Top-level list items indented 1 to 3 spaces

```text
   - a
    - b
```

Upstream: `b` is a nested list of `a`. Ours: `- b` is the second line of `a`'s text.

### D4. List directly after a paragraph line

```text
Text
- a
- b
```

Upstream: one paragraph, `Text - a - b`. Ours: a paragraph, then a list of two items.

### D5. List type changes without a blank line

```text
1. a
2. b
* c
```

```text
1. a
    - b
- c
```

Upstream: `* c` is text of item `b`; in the second list, `c` becomes a second item of the nested list. Ours: `c` is a new bulleted list after the numbered one, in both.

### D6. Loose lists

```text
- a

- b
- c
```

Upstream: `a` and `b` are wrapped in `<p>`, `c` is not. Ours: all three are wrapped in `<p>`.

### D7. Lazy lines in a block quote

```text
> !!! note
    body
```

Upstream: `body` is the admonition's body, inside the quote. Ours: the admonition is empty, and `body` is a code block after the quote.

## Differences that do not change the page

The published page is the same, but the HTML or storage-format XML differs. They matter to anyone comparing our output with upstream's byte for byte.

| ID  | Construct                                                                | Upstream                               | Ours                 | Why                                                                             |
| --- | ------------------------------------------------------------------------ | -------------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| W1  | Indented continuation lines of a paragraph (`Text` then `    continued`) | Indentation kept in the text           | Indentation stripped | CommonMark strips leading spaces of paragraph lines                             |
| W2  | Item text followed by a nested list                                      | No newline between the text and `<ul>` | A newline            | markdown-it's renderer                                                          |
| W3  | `"` in text                                                              | `"`                                    | `&quot;`             | markdown-it escapes it; the XML value is equal                                  |
| W4  | Fenced and indented code blocks                                          | `<pre class="highlight">`              | `<pre>`              | Upstream runs `pymdownx.highlight`; the converter reads `pre > code` either way |

## Constructs with no row

Footnotes, alerts and task lists convert as upstream does (ADR 0007 §5 and §6).

## Adding a row

Measure the difference against upstream's `markdown_to_html` first, and show that it comes from the parser, not from our rules (ADR 0003 §4). Give the row the next free ID, an example input, and the form that converts the same way in both. A fixture that hits a row is an `override` in `tests/fixtures/manifest.json` and names the row's ID.
