# ADR 0009: Named entities, blank text and what a parse error can say

- Status: Accepted (Engineer 1 on ZER-30, 2026-10-14)
- Context issues: ZER-30
- Amends: ADR 0002, ADR 0005

## Context

`src/csf.ts` is the port of `md2conf/csf.py`. Upstream parses Markdown output with lxml and a parser configured with `remove_blank_text=True`, `remove_comments=True`, `strip_cdata=False` and `load_dtd=True`, where the DTD is `md2conf/entities.dtd` (the HTML 4 named character entities). We parse with `@xmldom/xmldom` (ADR 0002), which has no DTD loading, no blank-text removal, no comment removal and no error position. Four gaps follow from that, and each needed a decision.

## Decision

1. **The entity table is a module constant, not a package.** `csf.ts` holds the 248 entities `entities.dtd` declares, as name to code point. `entities()` rewrites a named entity as a numeric character reference before parsing, and rejects a reference no DTD would define, which is what libxml2 does and xmldom does not.
2. **`remove_blank_text` and `remove_comments` are a pass over the parsed tree.** `removeCommentsAndBlankText()` reproduces libxml2's `areBlanks()` heuristic: a blank text node goes, unless the element holds an element or CDATA section, text already seen makes the content mixed, or the blank is all the element holds. Comments are invisible to that decision, because upstream disables the comment callback, so a comment never becomes a node. Removing a comment joins the text on either side of it.
3. **`contentToString()` does not re-indent.** Upstream serializes with `pretty_print=True`; `XMLSerializer` has no such option. The function returns the serialized document, which is what the Confluence REST API returns and what its single caller (an integration test that writes a file to look at) needs.
4. **`ParseError` carries no Markdown line number.** Upstream maps the position of the parse error onto the `<line-number value="N"/>` markers the Markdown renderer emits. xmldom reports no position for a parse error, and no supported mechanism recovers one, so the message is `XML parse error: <reason>`. ADR 0002 already puts `--line-numbers` after the MVP; when it lands, the mapping needs a position source this library does not have.

## Alternatives considered

- **The `entities` package** (already on the ADR 0005 list). It would replace 248 lines of table with a call, but its entity set is HTML 5 (2,231 entities), so documents that upstream rejects, such as `&NewLine;`, would parse here. Exact parity with the entity set upstream accepts is worth more than the table.
- **Ship `entities.dtd` and a DTD parser.** A DTD parser is a large dependency for 248 constant values, and xmldom does not load DTDs.
- **Keep blank text and comments.** The golden fixtures are compared after canonicalisation as strings, so any difference in blank text shows up as a failure in every conversion test.
- **Pre-scan the document for blank text or malformed entities.** The scan cannot tell text from markup; the tree can.

## Consequences

- `canonicalize()` produces byte-identical output to upstream for every input in the fixture corpus, which is what the conversion tests compare.
- `csf.ts` is longer than `csf.py` because of the table; the table is data, not logic.
- A document that upstream rejects for a bare `&` is rejected here too, but for a reason that is checked in `csf.ts` rather than by the parser. That check is the part most likely to need revisiting if the parser changes.
