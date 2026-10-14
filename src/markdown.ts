/**
 * Publish Markdown files to Confluence wiki.
 *
 * Port of upstream `md2conf/markdown.py`. Upstream renders Markdown into XHTML with
 * Python-Markdown and its extensions; we render it with markdown-it into the same
 * element and class vocabulary, so the converter in `src/converter.ts` can follow
 * `converter.py` closely.
 *
 * @see https://github.com/hunyadi/md2conf
 * @see docs/adr/0002-markdown-parser-and-conversion-pipeline.md
 *
 * `markdown_with_line_numbers` (`--line-numbers`) and emoji rendering are post-MVP and
 * are not ported yet; the ZER-28 plan lists both as non-goals.
 */

import { alert } from '@mdit/plugin-alert';
import { footnote } from '@mdit/plugin-footnote';
import { tasklist } from '@mdit/plugin-tasklist';
import MarkdownIt, {
  type MarkdownIt as MarkdownItType,
  type RendererRule,
  type StateBlock,
  type StateCore,
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
 * Block rule for Python-Markdown's `!!!` admonition syntax.
 *
 * The body is the indented block that follows the marker, dedented by one tab stop and
 * tokenized in place, so an admonition nests, holds any block content, and keeps the
 * source line numbers of the document it came from. As upstream, the rule also ends a
 * paragraph that runs into a marker at the same margin.
 */
function admonition(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  // A marker one tab stop into the block belongs to that block's content, not to us.
  if ((state.sCount[startLine] ?? 0) - state.blkIndent >= ADMONITION_INDENT) {
    return false;
  }
  const match = ADMONITION_REGEXP.exec(lineContent(state, startLine));
  if (match === null) {
    return false;
  }
  // Python-Markdown looks for `!!!` at the start of a block, so a marker that runs into
  // an indented paragraph line stays part of that paragraph.
  if (silent && (state.sCount[startLine] ?? 0) !== state.blkIndent) {
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

function createConverter(): MarkdownItType {
  // The default preset (unlike `commonmark`) brings the tables and strikethrough rules
  // upstream enables, `html` keeps inline HTML, `xhtmlOut` closes void elements, and
  // `linkify` matches upstream's `pymdownx.magiclink` autolinks.
  const md = new MarkdownIt({ html: true, xhtmlOut: true, linkify: true })
    .use(alert)
    .use(tasklist)
    .use(footnote);

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
