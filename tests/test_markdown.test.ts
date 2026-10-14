import { describe, expect, it } from 'vitest';
import { createConverter, markdownToHtml } from '../src/markdown.js';

/**
 * `tests/source/admonition.md` from hunyadi/md2conf (MIT, see NOTICE.md), copied
 * verbatim. Issue C5 brings upstream's fixture tree in and compares the whole document
 * end to end; this copy keeps the renderer honest on its own.
 */
const UPSTREAM_ADMONITION_SOURCE = `<!-- confluence-page-id: 00000000000 -->

## Admonitions

!!! info
    This is an information panel.

!!! info "Optional explicit title"
    This is an information panel with an explicit title.

    This is the second paragraph with a [link](https://example.com/).

!!! tip "Tip of the day"
    This is a structured macro panel showing a tip.

!!! note "A note"
    This is a structured macro panel showing a note.

!!! warning "A warning message"
    This is a structured macro panel showing a warning.

!!! abstract
    This is an admonition type used in Material for MkDocs.

!!! attention
    This is a structured macro panel defined in rST syntax.

!!! bug
    This is an admonition type used in Material for MkDocs.

!!! caution
    This is a structured macro panel defined in rST syntax.

!!! danger
    This is a structured macro panel defined in rST syntax.

!!! error
    This is a structured macro panel defined in rST syntax.

!!! example
    This is an admonition type used in Material for MkDocs.

!!! failure
    This is an admonition type used in Material for MkDocs.

!!! hint
    This is a structured macro panel defined in rST syntax.

!!! important
    This is a structured macro panel defined in rST syntax.

!!! question
    This is an admonition type used in Material for MkDocs.

!!! quote
    This is an admonition type used in Material for MkDocs.

!!! success
    This is an admonition type used in Material for MkDocs.`;

/**
 * XHTML that upstream's `markdown_to_html` produces for that source, captured from
 * Python-Markdown 3.10 with the `pymdown-extensions` version upstream pins.
 */
const UPSTREAM_ADMONITION_HTML = `<!-- confluence-page-id: 00000000000 -->

<h2>Admonitions</h2>
<div class="admonition info">
<p class="admonition-title">Info</p>
<p>This is an information panel.</p>
</div>
<div class="admonition info">
<p class="admonition-title">Optional explicit title</p>
<p>This is an information panel with an explicit title.</p>
<p>This is the second paragraph with a <a href="https://example.com/">link</a>.</p>
</div>
<div class="admonition tip">
<p class="admonition-title">Tip of the day</p>
<p>This is a structured macro panel showing a tip.</p>
</div>
<div class="admonition note">
<p class="admonition-title">A note</p>
<p>This is a structured macro panel showing a note.</p>
</div>
<div class="admonition warning">
<p class="admonition-title">A warning message</p>
<p>This is a structured macro panel showing a warning.</p>
</div>
<div class="admonition abstract">
<p class="admonition-title">Abstract</p>
<p>This is an admonition type used in Material for MkDocs.</p>
</div>
<div class="admonition attention">
<p class="admonition-title">Attention</p>
<p>This is a structured macro panel defined in rST syntax.</p>
</div>
<div class="admonition bug">
<p class="admonition-title">Bug</p>
<p>This is an admonition type used in Material for MkDocs.</p>
</div>
<div class="admonition caution">
<p class="admonition-title">Caution</p>
<p>This is a structured macro panel defined in rST syntax.</p>
</div>
<div class="admonition danger">
<p class="admonition-title">Danger</p>
<p>This is a structured macro panel defined in rST syntax.</p>
</div>
<div class="admonition error">
<p class="admonition-title">Error</p>
<p>This is a structured macro panel defined in rST syntax.</p>
</div>
<div class="admonition example">
<p class="admonition-title">Example</p>
<p>This is an admonition type used in Material for MkDocs.</p>
</div>
<div class="admonition failure">
<p class="admonition-title">Failure</p>
<p>This is an admonition type used in Material for MkDocs.</p>
</div>
<div class="admonition hint">
<p class="admonition-title">Hint</p>
<p>This is a structured macro panel defined in rST syntax.</p>
</div>
<div class="admonition important">
<p class="admonition-title">Important</p>
<p>This is a structured macro panel defined in rST syntax.</p>
</div>
<div class="admonition question">
<p class="admonition-title">Question</p>
<p>This is an admonition type used in Material for MkDocs.</p>
</div>
<div class="admonition quote">
<p class="admonition-title">Quote</p>
<p>This is an admonition type used in Material for MkDocs.</p>
</div>
<div class="admonition success">
<p class="admonition-title">Success</p>
<p>This is an admonition type used in Material for MkDocs.</p>
</div>`;

/**
 * `tests/source/footnote.md` from hunyadi/md2conf (MIT, see NOTICE.md), copied
 * verbatim, because the footnote render rules are ours and issue C5 compares the whole
 * fixture tree later.
 */
const UPSTREAM_FOOTNOTE_SOURCE = `<!-- confluence-page-id: 00000000000 -->

## Footnotes

Footnote with numeric notation [^1] and string identifier [^string].

Multiple references to the same footnote: first [^multi], second [^multi], third [^multi].

[^1]: This is a footnote with *numeric* notation.
[^string]: This is a footnote with a *string identifier*.
[^multi]: **[External Link](https://example.com)**. This footnote is referenced multiple times.`;

/** XHTML that upstream's `markdown_to_html` produces for that source. */
const UPSTREAM_FOOTNOTE_HTML = `<!-- confluence-page-id: 00000000000 -->

<h2>Footnotes</h2>
<p>Footnote with numeric notation <sup id="fnref:1"><a class="footnote-ref" href="#fn:1">1</a></sup> and string identifier <sup id="fnref:string"><a class="footnote-ref" href="#fn:string">2</a></sup>.</p>
<p>Multiple references to the same footnote: first <sup id="fnref:multi"><a class="footnote-ref" href="#fn:multi">3</a></sup>, second <sup id="fnref2:multi"><a class="footnote-ref" href="#fn:multi">3</a></sup>, third <sup id="fnref3:multi"><a class="footnote-ref" href="#fn:multi">3</a></sup>.</p>
<div class="footnote">
<hr />
<ol>
<li id="fn:1">
<p>This is a footnote with <em>numeric</em> notation.&#160;<a class="footnote-backref" href="#fnref:1" title="">&#8617;</a></p>
</li>
<li id="fn:string">
<p>This is a footnote with a <em>string identifier</em>.&#160;<a class="footnote-backref" href="#fnref:string" title="">&#8617;</a></p>
</li>
<li id="fn:multi">
<p><strong><a href="https://example.com">External Link</a></strong>. This footnote is referenced multiple times.&#160;<a class="footnote-backref" href="#fnref:multi" title="">&#8617;</a><a class="footnote-backref" href="#fnref2:multi" title="">&#8617;</a><a class="footnote-backref" href="#fnref3:multi" title="">&#8617;</a></p>
</li>
</ol>
</div>`;

/**
 * Python-Markdown separates blocks with blank lines that markdown-it does not emit, and
 * neither output ends the same way. Element structure is what this port has to match.
 */
function withoutBlankLines(html: string): string {
  return html
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
}

describe('markdownToHtml', () => {
  it('renders block elements', () => {
    expect(markdownToHtml('# Title\n\nA paragraph.\n')).toBe(
      '<h1>Title</h1>\n<p>A paragraph.</p>\n',
    );
  });

  it('keeps inline HTML and closes void elements for XHTML', () => {
    expect(markdownToHtml('<span class="x">raw</span> and a break  \nhere\n')).toBe(
      '<p><span class="x">raw</span> and a break<br />\nhere</p>\n',
    );
  });

  it('linkifies bare URLs and email addresses', () => {
    expect(markdownToHtml('Visit https://example.com/ or mail me@example.com.\n')).toBe(
      '<p>Visit <a href="https://example.com/">https://example.com/</a> or mail ' +
        '<a href="mailto:me@example.com">me@example.com</a>.</p>\n',
    );
  });

  it('renders tables', () => {
    expect(markdownToHtml('| Name | Value |\n| --- | --- |\n| a | 1 |\n')).toBe(
      '<table>\n<thead>\n<tr>\n<th>Name</th>\n<th>Value</th>\n</tr>\n</thead>\n' +
        '<tbody>\n<tr>\n<td>a</td>\n<td>1</td>\n</tr>\n</tbody>\n</table>\n',
    );
  });

  it('renders strikethrough as del, the element Python-Markdown uses', () => {
    expect(markdownToHtml('~~gone~~\n')).toBe('<p><del>gone</del></p>\n');
  });

  it('renders a task list as the plain list item upstream reads', () => {
    expect(markdownToHtml('- [x] done\n- [ ] todo\n')).toBe(
      '<ul>\n<li>[x] done</li>\n<li>[ ] todo</li>\n</ul>\n',
    );
  });

  it('renders footnotes the way upstream anchors them', () => {
    expect(
      markdownToHtml(
        'Text[^1] again[^1] and[^note].\n\n[^1]: First note.\n\n[^note]: Second note.\n',
      ),
    ).toBe(
      '<p>Text<sup id="fnref:1"><a class="footnote-ref" href="#fn:1">1</a></sup> again' +
        '<sup id="fnref2:1"><a class="footnote-ref" href="#fn:1">1</a></sup> and' +
        '<sup id="fnref:note"><a class="footnote-ref" href="#fn:note">2</a></sup>.</p>\n' +
        '<div class="footnote">\n<hr />\n<ol>\n' +
        '<li id="fn:1">\n<p>First note.&#160;' +
        '<a class="footnote-backref" href="#fnref:1" title="">&#8617;</a>' +
        '<a class="footnote-backref" href="#fnref2:1" title="">&#8617;</a></p>\n</li>\n' +
        '<li id="fn:note">\n<p>Second note.&#160;' +
        '<a class="footnote-backref" href="#fnref:note" title="">&#8617;</a></p>\n</li>\n' +
        '</ol>\n</div>\n',
    );
  });

  it('numbers footnotes in the order they are first referenced', () => {
    // Python-Markdown numbers in the order the definitions appear (ADR 0007 §5); the
    // plugin numbers in the order they are referenced, and drops a definition that is
    // never referenced. Both are pinned here so the difference is visible.
    expect(markdownToHtml('Text[^b] and [^a].\n\n[^a]: A\n[^b]: B\n')).toBe(
      '<p>Text<sup id="fnref:b"><a class="footnote-ref" href="#fn:b">1</a></sup> and ' +
        '<sup id="fnref:a"><a class="footnote-ref" href="#fn:a">2</a></sup>.</p>\n' +
        '<div class="footnote">\n<hr />\n<ol>\n' +
        '<li id="fn:b">\n<p>B&#160;<a class="footnote-backref" href="#fnref:b" title="">&#8617;</a></p>\n</li>\n' +
        '<li id="fn:a">\n<p>A&#160;<a class="footnote-backref" href="#fnref:a" title="">&#8617;</a></p>\n</li>\n' +
        '</ol>\n</div>\n',
    );
    expect(markdownToHtml('Text[^used].\n\n[^u]: Never referenced.\n')).toBe(
      '<p>Text[^used].</p>\n',
    );
  });

  it('leaves an inline footnote as text, as Python-Markdown does', () => {
    expect(markdownToHtml('An ^[inline] footnote.\n')).toBe('<p>An ^[inline] footnote.</p>\n');
  });

  it('renders a GitHub alert as the block quote upstream reads', () => {
    expect(markdownToHtml('> [!NOTE]\n> Useful information.\n')).toBe(
      '<blockquote>\n<p>[!NOTE]\nUseful information.</p>\n</blockquote>\n',
    );
  });

  it('renders the same footnote anchors on every call', () => {
    const source = 'Text[^1]\n\n[^1]: The note.\n';

    expect(markdownToHtml(source)).toBe(markdownToHtml(source));
  });
});

describe('admonitions', () => {
  it('titles an admonition with its capitalized type when no title is given', () => {
    expect(markdownToHtml('!!! note\n    body\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('uses a quoted title as it is', () => {
    expect(markdownToHtml('!!! note "A title"\n    body\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">A title</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('renders no title for an explicitly empty quoted title', () => {
    expect(markdownToHtml('!!! note ""\n    body\n')).toBe(
      '<div class="admonition note">\n<p>body</p>\n</div>\n',
    );
  });

  it('keeps a whitespace-only quoted title', () => {
    expect(markdownToHtml('!!! note "   "\n    body\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">   </p>\n<p>body</p>\n</div>\n',
    );
  });

  it('parses the title as Markdown', () => {
    expect(markdownToHtml('!!! note "Title with *emphasis*"\n    body\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Title with <em>emphasis</em></p>\n' +
        '<p>body</p>\n</div>\n',
    );
  });

  it('lowercases the type and adds words after it to the class', () => {
    expect(markdownToHtml('!!! NOTE Uppercase type\n    body\n')).toBe(
      '<div class="admonition note uppercase type">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('takes every word after the type as part of the class, not as a title', () => {
    expect(markdownToHtml('!!! note A bare title\n    body\n')).toBe(
      '<div class="admonition note a bare title">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('collapses repeated spaces inside the class', () => {
    expect(markdownToHtml('!!! note    spaced    out\n    body\n')).toBe(
      '<div class="admonition note spaced out">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('accepts a marker without a space, but only one', () => {
    expect(markdownToHtml('!!!note\n    body\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
    expect(markdownToHtml('!!!   note\n    body\n')).toBe('<p>!!!   note\nbody</p>\n');
  });

  it('leaves a marker without a type, or a single-quoted title, as a paragraph', () => {
    expect(markdownToHtml('!!!\n    body\n')).toBe('<p>!!!\nbody</p>\n');
    expect(markdownToHtml("!!! note 'Single quoted'\n    body\n")).toBe(
      "<p>!!! note 'Single quoted'\nbody</p>\n",
    );
  });

  it('takes a marker at column 0 that follows a list item, as upstream does', () => {
    expect(markdownToHtml('- item\n!!! note\n    body\n')).toBe(
      '<ul>\n<li>item</li>\n</ul>\n<div class="admonition note">\n' +
        '<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
    expect(markdownToHtml('1. item\n!!! note\n    body\n')).toBe(
      '<ol>\n<li>item</li>\n</ol>\n<div class="admonition note">\n' +
        '<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('takes a marker at column 0 that follows a nested list item', () => {
    expect(markdownToHtml('- a\n  - b\n!!! note\n    body\n')).toBe(
      '<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul>\n</li>\n</ul>\n' +
        '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('holds an admonition in a list item whose margin is four columns, as upstream does', () => {
    expect(markdownToHtml('1.  a\n\n    !!! note\n        body\n')).toBe(
      '<ol>\n<li>\n<p>a</p>\n<div class="admonition note">\n<p class="admonition-title">Note</p>\n' +
        '<p>body</p>\n</div>\n</li>\n</ol>\n',
    );
    expect(markdownToHtml('-   a\n\n    !!! note\n        body\n')).toBe(
      '<ul>\n<li>\n<p>a</p>\n<div class="admonition note">\n<p class="admonition-title">Note</p>\n' +
        '<p>body</p>\n</div>\n</li>\n</ul>\n',
    );
    expect(markdownToHtml('10. a\n\n    !!! note\n        body\n')).toBe(
      '<ol start="10">\n<li>\n<p>a</p>\n<div class="admonition note">\n' +
        '<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n</li>\n</ol>\n',
    );
  });

  it('holds a nested admonition at the body margin inside a list item, as upstream does', () => {
    expect(markdownToHtml('- a\n\n    !!! note\n        !!! note\n')).toBe(
      '<ul>\n<li>\n<p>a</p>\n<div class="admonition note">\n<p class="admonition-title">Note</p>\n' +
        '<div class="admonition note">\n<p class="admonition-title">Note</p>\n</div>\n</div>\n</li>\n</ul>\n',
    );
    expect(markdownToHtml('- a\n\n    !!! note\n        !!! note\n        !!! note\n')).toBe(
      '<ul>\n<li>\n<p>a</p>\n<div class="admonition note">\n<p class="admonition-title">Note</p>\n' +
        '<div class="admonition note">\n<p class="admonition-title">Note</p>\n</div>\n' +
        '<div class="admonition note">\n<p class="admonition-title">Note</p>\n</div>\n</div>\n</li>\n</ul>\n',
    );
  });

  it('takes a marker after a paragraph in a later block of a list item, as upstream does', () => {
    expect(markdownToHtml('- a\n\n    p\n    !!! note\n        body\n')).toBe(
      '<ul>\n<li>\n<p>a</p>\n<p>p</p>\n<div class="admonition note">\n' +
        '<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n</li>\n</ul>\n',
    );
    expect(markdownToHtml('- a\n\n    p\n\t!!! note\n\t    body\n')).toBe(
      '<ul>\n<li>\n<p>a</p>\n<p>p</p>\n<div class="admonition note">\n' +
        '<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n</li>\n</ul>\n',
    );
  });

  it('holds an admonition that closes a nested list, as upstream does', () => {
    expect(markdownToHtml('- a\n    - b\n    !!! note\n        body\n')).toBe(
      '<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul>\n<div class="admonition note">\n' +
        '<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n</li>\n</ul>\n',
    );
    expect(markdownToHtml('- a\n    - b\n        - c\n    !!! note\n        body\n')).toBe(
      '<ul>\n<li>a\n<ul>\n<li>b\n<ul>\n<li>c</li>\n</ul>\n</li>\n</ul>\n' +
        '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n' +
        '</li>\n</ul>\n',
    );
  });

  it('documents the list and quote shapes that follow markdown-it, not Python-Markdown', () => {
    // Python-Markdown decides what continues a list item differently from CommonMark, and
    // these three shapes follow from that, not from the marker rule. Each is recorded here
    // so it is visible rather than implicit; they belong in ADR 0003.
    //
    // The rows for these three live in ZER-62, which asks for docs/dialect.md.
    // `- a` + a two-space paragraph ends the list upstream, which then makes the marker an
    // indented code block; we keep the paragraph in the item and open a block.
    expect(markdownToHtml('- a\n\n  para\n\n    !!! note\n        body\n')).toContain(
      '<p>para</p>\n<div class="admonition note">',
    );
    // A three-space nested list is not nested upstream, so its marker is code.
    expect(markdownToHtml('1. a\n   - b\n\n        !!! note\n            body\n')).toContain(
      '<div class="admonition note">',
    );
    // A block quote inside a list item closes at the marker upstream; CommonMark keeps the
    // marker inside the quote's paragraph.
    expect(markdownToHtml('1. a\n\n    > q\n    !!! note\n      body\n')).not.toContain(
      'admonition',
    );
  });

  it('leaves a marker on the first line of a list item as the item’s text', () => {
    // Upstream opens a block here, because the marker is the first thing in the item;
    // markdown-it hands the item's first line to the paragraph rule before any block rule
    // sees it, so the marker stays text. Recorded here so it is visible, not implicit;
    // the row for it is asked for in ZER-62.
    expect(markdownToHtml('- !!! note\n    body\n')).toBe('<ul>\n<li>!!! note\nbody</li>\n</ul>\n');
  });

  it('leaves a marker deeper inside a list item as the item’s text, as upstream does', () => {
    // Python-Markdown flattens the two-space list, so the marker sits in the item's text
    // there too; CommonMark strips the indentation of the continuation lines.
    expect(markdownToHtml('- a\n    - b\n        !!! note\n            body\n')).toBe(
      '<ul>\n<li>a\n<ul>\n<li>b\n!!! note\nbody</li>\n</ul>\n</li>\n</ul>\n',
    );
    expect(markdownToHtml('- a\n  - b\n    !!! note\n        body\n')).not.toContain('admonition');
  });

  it('leaves a marker indented inside a list item as the item’s text, as upstream does', () => {
    // A marker left of a list item's margin, and one at that margin, stay the item's text;
    // only column 0 ends the list. CommonMark strips the continuation lines' indentation,
    // so these differ from Python-Markdown in whitespace only.
    expect(markdownToHtml('- a\n !!! note\n     body\n')).toBe(
      '<ul>\n<li>a\n!!! note\nbody</li>\n</ul>\n',
    );
    expect(markdownToHtml('1. a\n  !!! note\n      body\n')).toBe(
      '<ol>\n<li>a\n!!! note\nbody</li>\n</ol>\n',
    );
    expect(markdownToHtml('- a\n  !!! note\n      body\n')).toBe(
      '<ul>\n<li>a\n!!! note\nbody</li>\n</ul>\n',
    );
    expect(markdownToHtml('- a\n  - b\n    !!! note\n        body\n')).toBe(
      '<ul>\n<li>a\n<ul>\n<li>b\n!!! note\nbody</li>\n</ul>\n</li>\n</ul>\n',
    );
  });

  it('leaves a marker that is not a whole number of tab stops into a list item as text', () => {
    expect(markdownToHtml('- a\n\n  !!! note\n      body\n')).not.toContain('admonition');
    expect(markdownToHtml('- a\n\n   !!! note\n       body\n')).not.toContain('admonition');
  });

  it('leaves a marker in a block quote inside a list item as the quote’s text', () => {
    expect(markdownToHtml('- a\n  > q\n  !!! note\n      body\n')).not.toContain('admonition');
  });

  it('leaves a marker indented into the block as a paragraph, as upstream does', () => {
    // Python-Markdown keeps the indentation of the continuation line and CommonMark
    // strips it. Upstream renders no admonition for either input, and neither do we.
    expect(markdownToHtml('   !!! note\n       body\n')).toBe('<p>!!! note\nbody</p>\n');
    expect(markdownToHtml('>  !!! note\n>      body\n')).toBe(
      '<blockquote>\n<p>!!! note\nbody</p>\n</blockquote>\n',
    );
  });

  it('leaves a marker that runs into an indented paragraph line as text', () => {
    expect(markdownToHtml('- list item\n    !!! note\n        body\n')).toBe(
      '<ul>\n<li>list item\n!!! note\nbody</li>\n</ul>\n',
    );
  });

  it('takes a body indented with a tab', () => {
    expect(markdownToHtml('!!! note\n\tbody\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('takes a body indented with spaces and a tab', () => {
    expect(markdownToHtml('!!! note\n  \tbody more\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<p>body more</p>\n</div>\n',
    );
  });

  it('holds an admonition inside an unordered list item, as upstream does', () => {
    expect(markdownToHtml('- item\n\n    !!! note\n        body\n\n    after\n')).toBe(
      '<ul>\n<li>\n<p>item</p>\n<div class="admonition note">\n' +
        '<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n<p>after</p>\n</li>\n</ul>\n',
    );
  });

  it('holds an admonition inside an ordered list item, as upstream does', () => {
    expect(markdownToHtml('1. item\n\n    !!! note\n        body\n\n    after\n')).toBe(
      '<ol>\n<li>\n<p>item</p>\n<div class="admonition note">\n' +
        '<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n<p>after</p>\n</li>\n</ol>\n',
    );
  });

  it('takes a type outside ASCII', () => {
    expect(markdownToHtml('!!! nötig\n    body\n')).toBe(
      '<div class="admonition nötig">\n<p class="admonition-title">Nötig</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('ends a paragraph that runs into the marker, as upstream does', () => {
    expect(markdownToHtml('Text before the marker\n!!! note\n    body\n')).toBe(
      '<p>Text before the marker</p>\n<div class="admonition note">\n' +
        '<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('renders an admonition without a body', () => {
    expect(markdownToHtml('!!! note\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n</div>\n',
    );
  });

  it('keeps each paragraph of the body apart', () => {
    expect(markdownToHtml('!!! note\n    First.\n\n    Second.\n\nAfter.\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<p>First.</p>\n' +
        '<p>Second.</p>\n</div>\n<p>After.</p>\n',
    );
  });

  it('takes a body that starts after a blank line', () => {
    expect(markdownToHtml('!!! note\n\n    body\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n',
    );
  });

  it('ends the body at the first line that is not indented', () => {
    expect(markdownToHtml('!!! note\n    body\nNot indented.\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<p>body</p>\n</div>\n' +
        '<p>Not indented.</p>\n',
    );
  });

  it('holds an admonition inside a block quote, as upstream does', () => {
    expect(markdownToHtml('> !!! note\n>     body\n')).toBe(
      '<blockquote>\n<div class="admonition note">\n<p class="admonition-title">Note</p>\n' +
        '<p>body</p>\n</div>\n</blockquote>\n',
    );
  });

  it('holds a nested admonition', () => {
    expect(
      markdownToHtml('!!! note "Outer"\n    Outer.\n\n    !!! warning "Inner"\n        Inner.\n'),
    ).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Outer</p>\n<p>Outer.</p>\n' +
        '<div class="admonition warning">\n<p class="admonition-title">Inner</p>\n<p>Inner.</p>\n</div>\n' +
        '</div>\n',
    );
  });

  it('holds a list', () => {
    expect(markdownToHtml('!!! note\n    * one\n    * two\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<ul>\n' +
        '<li>one</li>\n<li>two</li>\n</ul>\n</div>\n',
    );
  });

  it('holds a table', () => {
    expect(markdownToHtml('!!! note\n    | a | b |\n    |---|---|\n    | 1 | 2 |\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n<table>\n<thead>\n<tr>\n' +
        '<th>a</th>\n<th>b</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>1</td>\n<td>2</td>\n</tr>\n' +
        '</tbody>\n</table>\n</div>\n',
    );
  });

  it('renders a body indented by more than one tab stop as a code block', () => {
    expect(markdownToHtml('!!! note\n        code\n')).toBe(
      '<div class="admonition note">\n<p class="admonition-title">Note</p>\n' +
        '<pre><code>code\n</code></pre>\n</div>\n',
    );
  });
});

describe('csf fences', () => {
  it('emits the body verbatim instead of escaping it', () => {
    expect(markdownToHtml('```csf\n<ac:structured-macro ac:name="status" />\n```\n')).toBe(
      '<div class="csf"><ac:structured-macro ac:name="status" /></div>\n',
    );
  });

  it('keeps surrounding blocks intact', () => {
    expect(markdownToHtml('Before.\n\n```csf\n<ac:image />\n```\n\nAfter.\n')).toBe(
      '<p>Before.</p>\n<div class="csf"><ac:image /></div>\n<p>After.</p>\n',
    );
  });

  it('matches a fence that carries extra info words', () => {
    expect(markdownToHtml('```csf extra\n<ac:image />\n```\n')).toBe(
      '<div class="csf"><ac:image /></div>\n',
    );
  });

  it('renders any other fence as a code block', () => {
    expect(markdownToHtml('```python\nprint("hi")\n```\n')).toBe(
      '<pre><code class="language-python">print(&quot;hi&quot;)\n</code></pre>\n',
    );
  });
});

describe('mermaid fences', () => {
  it('stays the code block upstream reads, with the language on the code element', () => {
    expect(markdownToHtml('```mermaid\ngraph TD;\nA-->B;\n```\n')).toBe(
      '<pre><code class="language-mermaid">graph TD;\nA--&gt;B;\n</code></pre>\n',
    );
  });
});

describe('confluence placeholders', () => {
  it('renders the table of contents placeholder', () => {
    expect(markdownToHtml('[[_TOC_]]\n')).toBe('<p>[[<em>TOC</em>]]</p>\n');
  });

  it('renders the child pages placeholder', () => {
    expect(markdownToHtml('[[_LISTING_]]\n')).toBe('<p>[[<em>LISTING</em>]]</p>\n');
  });
});

describe("upstream's admonition document", () => {
  it('renders the same element structure as Python-Markdown does', () => {
    expect(withoutBlankLines(markdownToHtml(UPSTREAM_ADMONITION_SOURCE))).toBe(
      withoutBlankLines(UPSTREAM_ADMONITION_HTML),
    );
  });
});

describe("upstream's footnote document", () => {
  it('renders the same anchors and elements as Python-Markdown does', () => {
    expect(withoutBlankLines(markdownToHtml(UPSTREAM_FOOTNOTE_SOURCE))).toBe(
      withoutBlankLines(UPSTREAM_FOOTNOTE_HTML),
    );
  });
});

describe('token positions inside an admonition', () => {
  // The body is tokenized in place rather than re-parsed from a dedented copy, so the
  // tokens inside it carry the line numbers and nesting levels of the document.
  const source = [
    'Intro paragraph.',
    '',
    '!!! note "Outer"',
    '    Outer body.',
    '',
    '    !!! warning "Inner"',
    '        Inner body.',
    '',
    'After.',
    '',
  ].join('\n');

  it('reports document line numbers for every token in the body', () => {
    const tokens = createConverter().parse(source, {});

    expect(tokens.map((token) => [token.type, token.map])).toEqual([
      ['paragraph_open', [0, 1]],
      ['inline', [0, 1]],
      ['paragraph_close', null],
      ['admonition_open', [2, 8]],
      ['admonition_title_open', [2, 3]],
      ['inline', [2, 3]],
      ['admonition_title_close', null],
      ['paragraph_open', [3, 4]],
      ['inline', [3, 4]],
      ['paragraph_close', null],
      ['admonition_open', [5, 8]],
      ['admonition_title_open', [5, 6]],
      ['inline', [5, 6]],
      ['admonition_title_close', null],
      ['paragraph_open', [6, 7]],
      ['inline', [6, 7]],
      ['paragraph_close', null],
      ['admonition_close', null],
      ['admonition_close', null],
      ['paragraph_open', [8, 9]],
      ['inline', [8, 9]],
      ['paragraph_close', null],
    ]);
  });

  it('nests the tokens of an admonition inside the one that holds it', () => {
    const tokens = createConverter().parse(source, {});

    expect(tokens.map((token) => token.level)).toEqual([
      0, 1, 0, 0, 1, 2, 1, 1, 2, 1, 1, 2, 3, 2, 2, 3, 2, 1, 0, 0, 1, 0,
    ]);
  });
});
