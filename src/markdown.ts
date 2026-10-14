/**
 * Publish Markdown files to Confluence wiki.
 *
 * Port of upstream `md2conf/markdown.py`. Upstream renders Markdown into XHTML with
 * Python-Markdown and its extensions; we render it with markdown-it into the same
 * element and class vocabulary, so the converter in `src/converter.ts` can follow
 * `converter.py` closely.
 *
 * Alerts and task lists need no plugin: markdown-it without one already produces the
 * block quotes and list items upstream's converter reads (ADR 0007). Footnotes are parsed
 * by `@mdit/plugin-footnote`, but their render rules are replaced here so the anchors are
 * the ones upstream publishes.
 *
 * @see https://github.com/hunyadi/md2conf
 * @see docs/adr/0002-markdown-parser-and-conversion-pipeline.md
 * @see docs/adr/0007-markdown-plugins-follow-upstream-vocabulary.md
 *
 * `markdown_with_line_numbers` (`--line-numbers`) and emoji rendering are post-MVP and
 * are not ported yet; the ZER-28 plan lists both as non-goals.
 */

import { footnote, type FootNoteToken } from '@mdit/plugin-footnote';
import MarkdownIt, {
  type MarkdownIt as MarkdownItType,
  type RendererRule,
  type StateBlock,
  type StateCore,
  type Token,
} from 'markdown-it';

/**
 * Matches an admonition marker line: `!!! type` with an optional quoted title. The type
 * is a word of letters, digits or underscores, as in Python-Markdown, whose `\w` is
 * Unicode-aware.
 */
const ADMONITION_REGEXP = /^!!! ?([\p{L}\p{N}_-]+(?: +[\p{L}\p{N}_-]+)*)(?: +"(.*?)")? *$/u;

/** An admonition body is indented by one tab stop, as in Python-Markdown. */
const ADMONITION_INDENT = 4;

const SPACE = 0x20;
const TAB = 0x09;

/** Class names upstream's `admonition` extension puts on the element and its title. */
const ADMONITION_CLASS = 'admonition';
const ADMONITION_TITLE_CLASS = 'admonition-title';

/** Fence name whose body is Confluence Storage Format the user wrote. */
const CSF_LANGUAGE = 'csf';

function isSpace(code: number): boolean {
  return code === SPACE || code === TAB;
}

/** Returns a line with its leading whitespace removed, whatever mix of spaces and tabs. */
function lineContent(state: StateBlock, line: number): string {
  const end = state.eMarks[line] ?? 0;
  let pos = state.bMarks[line] ?? 0;
  while (pos < end && isSpace(state.src.charCodeAt(pos))) {
    pos += 1;
  }
  return state.src.slice(pos, end);
}

/**
 * Removes one tab stop of indentation from a body line in place, the way markdown-it's
 * own rules remove a block quote marker, so that every rule that reads the body sees it
 * at the marker's margin and reports source positions of the original document.
 */
function dedentLine(state: StateBlock, line: number): void {
  const end = state.eMarks[line] ?? 0;
  let pos = state.bMarks[line] ?? 0;
  let columns = 0;
  while (pos < end && columns < ADMONITION_INDENT) {
    const code = state.src.charCodeAt(pos);
    if (code === TAB) {
      columns += 4 - (columns % 4);
    } else if (code === SPACE) {
      columns += 1;
    } else {
      break;
    }
    pos += 1;
  }
  const content = pos;
  while (pos < end && isSpace(state.src.charCodeAt(pos))) {
    pos += 1;
  }
  state.bMarks[line] = content;
  state.tShift[line] = pos - content;
  state.sCount[line] = (state.sCount[line] ?? 0) - ADMONITION_INDENT;
}

/**
 * Reads the class list and the title of an admonition marker, with the semantics of
 * Python-Markdown's `admonition` extension: extra words after the type become part of
 * the class, a missing title becomes the capitalized type, and an explicitly empty
 * title suppresses the title element altogether.
 */
function admonitionClassAndTitle(match: RegExpExecArray): {
  readonly className: string;
  readonly title: string | undefined;
} {
  const className = (match[1] ?? '').toLowerCase().replace(/ {2,}/g, ' ');
  const quoted = match[2];
  const title =
    quoted === undefined
      ? capitalize(className.split(' ')[0] ?? '')
      : quoted === ''
        ? undefined
        : quoted;
  return { className, title };
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * True if a blank line inside the enclosing list item precedes this line.
 *
 * Python-Markdown dedents a block that follows a blank line by one tab stop, so a marker
 * in such a block reaches column 0 and opens a block. A marker in the item's *first*
 * block is a lazy line that keeps its indentation, and stays text.
 */
function followsBlankLineInItem(state: StateBlock, line: number): boolean {
  for (let index = line - 1; index >= 0; index -= 1) {
    if (state.isEmpty(index)) {
      return true;
    }
    // `bsCount` is set on the line that opens a list item or a block quote, which ends
    // the walk into the block the marker is in.
    if (state.bsCount[index] !== 0 || (state.sCount[index] ?? 0) < state.blkIndent) {
      return false;
    }
  }
  return false;
}

/**
 * True if the line may open a block whose first line is an admonition marker.
 *
 * Python-Markdown matches `!!!` at the start of a block, and its list items decide what a
 * block is differently from markdown-it. Inside a list item it starts a nested block
 * only for an indent of whole tab stops, which it then strips one tab stop at a time. That
 * block starts after a blank line, or where the lists inside the item have just closed,
 * which leaves the marker left of the item's margin.
 *
 * - a marker at column 0 ends the list or quote around it and opens a block of its own;
 * - a marker inside a list item opens a nested block when it is indented by whole tab
 *   stops and either starts a block or falls outside the item being closed;
 * - everywhere else the marker has to sit at the margin of the block it opens, so a
 *   marker indented into a block, or running into one of its paragraphs, is its text.
 */
function startsAdmonitionBlock(state: StateBlock, line: number): boolean {
  const columns = state.sCount[line] ?? 0;
  const relative = columns - state.blkIndent;
  if (columns === 0) {
    return true;
  }
  if (state.listIndent >= 0) {
    if (state.parentType === 'admonition') {
      // A nested admonition at the body's margin is a block of its own, as it is
      // outside a list.
      return relative === 0;
    }
    if (columns < ADMONITION_INDENT || columns % ADMONITION_INDENT !== 0) {
      return false;
    }
    return (
      (state.parentType === 'list' && relative >= 0) ||
      relative < 0 ||
      followsBlankLineInItem(state, line)
    );
  }
  return relative === 0;
}

/**
 * Block rule for Python-Markdown's `!!!` admonition syntax.
 *
 * The body is the indented block that follows the marker, dedented by one tab stop and
 * tokenized in place, so an admonition nests, holds any block content, and keeps the
 * source line numbers of the document it came from. As upstream, the rule also ends a
 * paragraph that runs into a marker that opens a block.
 */
function admonition(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  if (!startsAdmonitionBlock(state, startLine)) {
    return false;
  }
  const match = ADMONITION_REGEXP.exec(lineContent(state, startLine));
  if (match === null) {
    return false;
  }
  if (silent) {
    return true;
  }

  const bodyStart = startLine + 1;
  let nextLine = bodyStart;
  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine = state.skipEmptyLines(nextLine + 1);
      continue;
    }
    if ((state.sCount[nextLine] ?? 0) - state.blkIndent < ADMONITION_INDENT) {
      break;
    }
    nextLine += 1;
  }

  const oldParentType = state.parentType;
  const oldLineMax = state.lineMax;
  const oldBlkIndent = state.blkIndent;
  const oldBMarks: number[] = [];
  const oldSCount: number[] = [];
  const oldTShift: number[] = [];
  for (let line = bodyStart; line < nextLine; line++) {
    oldBMarks.push(state.bMarks[line] ?? 0);
    oldSCount.push(state.sCount[line] ?? 0);
    oldTShift.push(state.tShift[line] ?? 0);
    if (!state.isEmpty(line)) {
      dedentLine(state, line);
    }
  }

  state.line = nextLine;
  state.parentType = 'admonition';
  state.lineMax = nextLine;
  // The body starts at the marker's own margin, so nested rules see the same relative
  // indentation they would see in a document of its own.
  state.blkIndent = state.sCount[startLine] ?? 0;

  const { className, title } = admonitionClassAndTitle(match);
  const open = state.push('admonition_open', 'div', 1);
  open.map = [startLine, nextLine];
  open.attrSet('class', `${ADMONITION_CLASS} ${className}`);

  if (title !== undefined) {
    const titleOpen = state.push('admonition_title_open', 'p', 1);
    titleOpen.map = [startLine, startLine + 1];
    titleOpen.attrSet('class', ADMONITION_TITLE_CLASS);
    // The core `inline` rule parses `content` into `children` after this rule returns.
    const titleInline = state.push('inline', '', 0);
    titleInline.map = [startLine, startLine + 1];
    titleInline.content = title;
    titleInline.children = [];
    state.push('admonition_title_close', 'p', -1);
  }

  state.md.block.tokenize(state, bodyStart, nextLine);

  state.push('admonition_close', 'div', -1);
  for (let i = 0; i < oldTShift.length; i++) {
    state.bMarks[bodyStart + i] = oldBMarks[i] ?? 0;
    state.sCount[bodyStart + i] = oldSCount[i] ?? 0;
    state.tShift[bodyStart + i] = oldTShift[i] ?? 0;
  }
  state.parentType = oldParentType;
  state.lineMax = oldLineMax;
  state.blkIndent = oldBlkIndent;
  state.line = nextLine;
  return true;
}

/**
 * Names markdown-it's strikethrough element `del`, the name Python-Markdown gives it
 * and the name that ends up in Confluence Storage Format.
 */
function useDelForStrikethrough(state: StateCore): void {
  for (const blockToken of state.tokens) {
    for (const token of blockToken.children ?? []) {
      if (token.type === 's_open' || token.type === 's_close') {
        token.tag = 'del';
      }
    }
  }
}

/** Escapes a value for an XHTML attribute, as Python-Markdown's serializer does. */
function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Names an anchor of a footnote the way upstream does, from the label the author wrote:
 * `fnref:label` for the first reference, `fnref2:label` and so on after it.
 */
function footnoteRefId(label: string, subId: number): string {
  return `fnref${subId === 0 ? '' : String(subId + 1)}:${escapeAttribute(label)}`;
}

/**
 * Footnote rendering keyed by the label the author wrote.
 *
 * `@mdit/plugin-footnote` parses footnotes, but its own HTML names anchors
 * `footnote1`, which would rename every anchor upstream publishes in a page. These
 * render rules emit the HTML Python-Markdown's `footnotes` extension produces with
 * `BACKLINK_TITLE: ""`, so `converter.ts` can follow `converter.py`.
 */
function renderFootnoteRef(tokens: Token[], idx: number): string {
  const { id, subId, label } = (tokens[idx] as FootNoteToken).meta;
  return (
    `<sup id="${footnoteRefId(label, subId)}">` +
    `<a class="footnote-ref" href="#fn:${escapeAttribute(label)}">${String(id + 1)}</a></sup>`
  );
}

function renderFootnoteAnchor(tokens: Token[], idx: number): string {
  const { subId, label } = (tokens[idx] as FootNoteToken).meta;
  // Upstream separates the footnote text from its first back-reference with a
  // non-breaking space, and gives further back-references none.
  const separator = subId === 0 ? '&#160;' : '';
  return (
    `${separator}<a class="footnote-backref" href="#${footnoteRefId(label, subId)}" ` +
    `title="">&#8617;</a>`
  );
}

function renderFootnoteOpen(tokens: Token[], idx: number): string {
  const { label } = (tokens[idx] as FootNoteToken).meta;
  return `<li id="fn:${escapeAttribute(label)}">\n`;
}

/**
 * Builds the converter. Exported for the tests that assert the token stream; the package
 * entry point does not re-export it.
 */
export function createConverter(): MarkdownItType {
  // The default preset (unlike `commonmark`) brings the tables and strikethrough rules
  // upstream enables, `html` keeps inline HTML, `xhtmlOut` closes void elements, and
  // `linkify` matches upstream's `pymdownx.magiclink` autolinks.
  const md = new MarkdownIt({ html: true, xhtmlOut: true, linkify: true }).use(footnote);
  // Python-Markdown has no inline footnote syntax, so `^[…]` stays literal text.
  md.inline.ruler.disable('footnoteInline');

  md.block.ruler.before('fence', 'admonition', admonition, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.core.ruler.after('inline', 'strikethrough_del', useDelForStrikethrough);

  const renderFence = md.renderer.rules.fence;
  if (renderFence === undefined) {
    throw new Error('markdown-it has no renderer rule for fenced code blocks');
  }

  // Port of upstream's `_verbatim_formatter`, which `pymdownx.superfences` calls for a
  // custom fence: the body of a `csf` fence is Confluence Storage Format the user wrote,
  // so it goes into the element verbatim and has to be well-formed XHTML on its own.
  const verbatimFormatter: RendererRule = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx];
    const info = token?.info.trim().split(/\s+/u)[0] ?? '';
    if (token === undefined || info !== CSF_LANGUAGE) {
      return renderFence(tokens, idx, options, env, renderer);
    }
    return `<div class="${CSF_LANGUAGE}">${token.content.replace(/\n$/u, '')}</div>\n`;
  };

  md.renderer.rules.fence = verbatimFormatter;

  md.renderer.rules.footnote_ref = renderFootnoteRef;
  md.renderer.rules.footnote_anchor = renderFootnoteAnchor;
  md.renderer.rules.footnote_open = renderFootnoteOpen;
  md.renderer.rules.footnote_close = () => '</li>\n';
  md.renderer.rules.footnote_block_open = () => '<div class="footnote">\n<hr />\n<ol>\n';
  md.renderer.rules.footnote_block_close = () => '</ol>\n</div>\n';

  return md;
}

const CONVERTER = createConverter();

/**
 * Converts a Markdown document into XHTML.
 *
 * `[[_TOC_]]` and `[[_LISTING_]]` need no rule of their own: markdown-it's emphasis
 * turns the underscores into `<em>TOC</em>` and `<em>LISTING</em>` inside the bracketed
 * placeholder, which is the shape upstream's converter looks for. Mermaid fences
 * likewise stay the code blocks upstream's converter reads, with their `mermaid`
 * language on the `code` element.
 */
export function markdownToHtml(content: string): string {
  return CONVERTER.render(content);
}
