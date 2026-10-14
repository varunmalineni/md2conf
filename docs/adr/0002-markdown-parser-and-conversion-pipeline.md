# ADR 0002: markdown-it → XHTML → strict XML DOM → Confluence Storage Format

- Status: Accepted (board accepted the ZER-28 plan, 2026-10-14); amended by ADR 0006, ADR 0007 and ADR 0008
- Context issues: ZER-27 §3.3, ZER-28

## Context

Upstream converts in two stages. First, Python-Markdown renders Markdown into an HTML string. Then lxml parses that string as **strict XML** (with a DTD for HTML named entities), and `converter.py` (~2.1k LOC) rewrites the tree into Confluence Storage Format (CSF), which is XHTML with elements in the `ac:` and `ri:` namespaces. Upstream's guarantee that "inline HTML must be well-formed XML" comes from this strict parse. Its 35 golden fixtures (`tests/source/*.md` → `tests/target/*.xml`) are compared after canonicalisation (`csf.canonicalize`).

We had to choose a TypeScript Markdown parser and the tree model the converter works on. The candidates were **markdown-it** and **unified/remark** (mdast → hast).

### Spike (2026-10-14, throwaway, deleted)

We used markdown-it 15 with `html: true` and `xhtmlOut: true`, plus `markdown-it-footnote`, `@mdit/plugin-alert`, `@mdit/plugin-tasklist` and `markdown-it-admon`. We rendered 10 upstream fixtures (`admonition`, `alert`, `collapsed`, `footnote`, `tasklist`, `table`, `basic`, `code`, `fenced`, `sections`). We wrapped each output in a root element and parsed it with `@xmldom/xmldom` 0.9, counting every error and warning.

- All 10 parsed as XML with **0 errors**. `<details markdown="1">` blocks that contain Markdown come out as one well-formed subtree.
- xmldom 0.9 is strict where we need it to be. These inputs **throw**: unclosed `<br>`, mismatched tags, and an `ac:` prefix with no namespace declaration. An undeclared named entity (`&nbsp;`) causes a non-fatal `error` event. Our wrapper must treat that as fatal, and it must turn HTML named entities into numeric references before parsing (this replaces upstream's `entities.dtd`).
- `markdown-it-admon` (last release 2023) keeps the quotes in `!!! info "Title"`, rendering `"Title"` instead of `Title`. We will write our own small admonition rule that follows Python-Markdown's `admonition` semantics.

## Decision

1. **Parser: markdown-it.** We configure it with `html: true` and `xhtmlOut: true`. Plugins come from the maintained `@mdit/plugin-*` family (alerts, task lists, footnotes and, if accepted, sub/sup/ins/mark), plus our own rules for `!!!` admonitions, `csf` and `mermaid` fences, and the `[[_TOC_]]` and `[[_LISTING_]]` placeholders.
2. **Pipeline:** Markdown → XHTML string → strict XML DOM (`@xmldom/xmldom`) → CSF transforms on the DOM → serialise. The renderer emits the same element vocabulary that Python-Markdown emits for the same constructs (for example `<div class="admonition info">` with `<p class="admonition-title">`). That lets the converter follow `converter.py`'s structure closely.
3. **Strictness:** every xmldom `warning`, `error` or `fatalError` fails the conversion of that document. The error names the file and, where markdown-it has a line map, the line.

## Alternatives considered

- **unified/remark (mdast → hast → CSF).**
  - It has the better AST and source positions on every node.
  - Rejected for three reasons:
    1. Raw HTML only becomes a tree through `rehype-raw`, which uses parse5. parse5 is a lenient HTML5 parser, so it silently fixes malformed HTML, and we would lose upstream's well-formed-XML rule unless we added a second, strict parse.
    2. The `!!!` admonition syntax needs a custom micromark extension, which ZER-27 rated as fiddly.
    3. The ecosystem is spread over many small packages, which means more supply-chain surface.
- **Rendering markdown-it tokens straight to CSF (no DOM).** This skips one parse, but inline HTML arrives as raw string fragments: `<details>` open and close are separate tokens with Markdown between them. We would still need an XML parser to validate and restructure that HTML, so we would end up with two tree models instead of one.
- **Other XML libraries.** `linkedom` and `htmlparser2` are lenient. `fast-xml-parser` has no mutable DOM. `libxmljs2` is a native addon and is barely maintained. Of the options we found, xmldom 0.9 is the only maintained, pure-JS, strict, mutable DOM.

## Consequences

- Converter code reads like `converter.py`, which makes porting fixtures and reviewing the port simpler.
- markdown-it only gives line maps for block tokens, so error positions are block-level. Upstream's `--line-numbers` mode is post-MVP.
- The parser is not Python-Markdown, so the dialect is different. ADR 0003 covers how we record each difference.
- If xmldom ever proves too limited, the DOM boundary sits in one module (`src/csf/`), so we can swap the library without touching the converter.
