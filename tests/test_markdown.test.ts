import { describe, expect, it } from 'vitest';
import { markdownToHtml } from '../src/markdown.js';

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

  it('renders task lists', () => {
    expect(markdownToHtml('- [x] done\n- [ ] todo\n')).toBe(
      '<ul class="task-list-container">\n' +
        '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" ' +
        'id="task-item-0" checked="checked" disabled="disabled" />' +
        '<label class="task-list-item-label" for="task-item-0"> done</label></li>\n' +
        '<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" ' +
        'id="task-item-1" disabled="disabled" />' +
        '<label class="task-list-item-label" for="task-item-1"> todo</label></li>\n</ul>\n',
    );
  });

  it('renders footnotes', () => {
    expect(markdownToHtml('Text with a note[^1]\n\n[^1]: The note.\n')).toBe(
      '<p>Text with a note<sup class="footnote-ref"><a href="#footnote1">[1]</a>' +
        '<a class="footnote-anchor" id="footnote-ref1"></a></sup></p>\n' +
        '<hr class="footnotes-sep" />\n<section class="footnotes">\n<ol class="footnotes-list">\n' +
        '<li id="footnote1" class="footnote-item"><p>The note. ' +
        '<a href="#footnote-ref1" class="footnote-backref">↩︎</a></p>\n</li>\n' +
        '</ol>\n</section>\n',
    );
  });

  it('renders GitHub alerts', () => {
    expect(markdownToHtml('> [!NOTE]\n> Useful information.\n')).toBe(
      '<div class="markdown-alert markdown-alert-note">\n<p class="markdown-alert-title">NOTE</p>\n' +
        '<p>Useful information.</p>\n</div>\n',
    );
  });

  it('numbers task lists and footnotes from scratch on every call', () => {
    const source = '- [x] done\n- [ ] todo\n\nText[^1]\n\n[^1]: The note.\n';

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

  it('leaves a marker that runs into an indented paragraph line as text, as upstream does', () => {
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
