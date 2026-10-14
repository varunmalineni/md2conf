# ADR 0008: Link and image URLs are written as the author wrote them

- Status: Accepted (Engineer proposal on ZER-65, 2026-10-14)
- Context issues: ZER-65
- Amends: ADR 0002

## Context

ADR 0002 §1 picks markdown-it as the parser and requires its output to be the XHTML
upstream's converter can read. For URLs that does not hold by default. markdown-it runs
every link, image and autolink destination through `normalizeLink`, which percent-encodes
spaces and non-ASCII characters and turns a non-ASCII host into punycode, and it runs the
text of an autolinked URL through `normalizeLinkText`, which decodes. Python-Markdown does
neither: it puts the destination on the element as the author wrote it and escapes it only
when it serializes the attribute.

Measured against upstream's `markdown_to_html` (md2conf 0.6.4, Python-Markdown 3.11.1):

| input                        | upstream `href`/`src`   | markdown-it's default          |
| ---------------------------- | ----------------------- | ------------------------------ |
| `[x](<my file.md>)`          | `my file.md`            | `my%20file.md`                 |
| `[x](café.md#Sect)`          | `café.md#Sect`          | `caf%C3%A9.md#Sect`            |
| `[x](mailto:me@exämple.com)` | `mailto:me@exämple.com` | `mailto:me@xn--exmple-cua.com` |

The encoded form is not what the page needs. `converter.py` resolves a relative link with
`urlparse(url).path` and looks that name up on disk, so `caf%C3%A9.md` is a file that does
not exist and a document that links to `déjà.png` or `my file.md` would publish a broken
link.

markdown-it's `validateLink` stays. It refuses `javascript:`, `vbscript:`, `file:` and
`data:` destinations and leaves them as text, where Python-Markdown writes them into the
page. Keeping that refusal is a deliberate difference from upstream, recorded as row D8 in
`docs/dialect.md`.

## Decision

`createConverter()` replaces `normalizeLink` and `normalizeLinkText` with the identity
function, so every `href` and `src` is the string in the Markdown source. Attribute
escaping is untouched: markdown-it's renderer still escapes `&` as `&amp;` and `"` as
`&quot;`, which is what Python-Markdown's serializer does too.

## Alternatives considered

- **Encode the destination where we render it.** Rejected. The URL reaches
  `converter.ts` through the rendered attribute, so the decision would have to be made in
  the renderer and then undone for file resolution; there is one place that knows what the
  author wrote, and that is the parser.
- **Percent-decode in `converter.ts` before looking a file up.** Rejected. It would put a
  parser's decision in the converter, and it would guess for links that were already
  encoded — `a%20b.md` is a file whose name has a literal `%20` in it, and decoding it
  would find the wrong file.
- **Keep the default and let the converter resolve percent-encoded names.** Rejected. It
  only works if the file on disk happens to be named `caf%C3%A9.md`.

## Consequences

- Links and images to files with spaces or non-ASCII names resolve on disk exactly as they
  do upstream.
- A document that carries a percent-encoded destination keeps it, so the two are never
  confused.
- Our output no longer round-trips a URL through markdown-it's encoder; anything that reads
  our HTML has to treat the destination as the author's text, which is what upstream
  publishes.
