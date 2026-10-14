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
  type StateBlock,
  type StateCore,
} from 'markdown-it';

/** Matches an admonition marker line: `!!! type` with an optional quoted title. */
const ADMONITION_REGEXP = /^!!! ?([\w-]+(?: +[\w-]+)*)(?: +"(.*?)")? *$/;

/** An admonition body is indented by one tab stop, as in Python-Markdown. */
const ADMONITION_INDENT = '    ';

/** Class names upstream's `admonition` extension puts on the element and its title. */
const ADMONITION_CLASS = 'admonition';
const ADMONITION_TITLE_CLASS = 'admonition-title';

/** Fence name whose body is Confluence Storage Format the user wrote. */
const CSF_LANGUAGE = 'csf';

/** Returns a source line with its indentation intact. */
function rawLine(state: StateBlock, line: number): string {
  return state.src.slice(state.bMarks[line] ?? 0, state.eMarks[line] ?? 0);
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
 * parsed as Markdown, so an admonition nests and holds any block content. As upstream,
 * the rule also ends a paragraph that runs into the marker line.
 */
function admonition(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const match = ADMONITION_REGEXP.exec(rawLine(state, startLine));
  if (match === null) {
    return false;
  }
  if (silent) {
    return true;
  }

  const content: string[] = [];
  let nextLine = startLine + 1;
  while (nextLine < endLine) {
    const line = rawLine(state, nextLine);
    if (line.trim() === '') {
      content.push('');
      nextLine += 1;
      continue;
    }
    if (!line.startsWith(ADMONITION_INDENT)) {
      break;
    }
    content.push(line.slice(ADMONITION_INDENT.length));
    nextLine += 1;
  }
  while (content.at(-1)?.trim() === '') {
    content.pop();
  }
  state.line = nextLine;

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

  state.md.block.parse(`${content.join('\n')}\n`, state.md, state.env, state.tokens);

  state.push('admonition_close', 'div', -1);
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

  // Port of upstream's `_verbatim_formatter`, which `pymdownx.superfences` calls for a
  // custom fence: the body of a `csf` fence is Confluence Storage Format the user wrote,
  // so it goes into the element verbatim and has to be well-formed XHTML on its own.
  const renderFence = md.renderer.rules.fence;
  if (renderFence === undefined) {
    throw new Error('markdown-it has no renderer rule for fenced code blocks');
  }
  md.renderer.rules.fence = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx];
    const info = token?.info.trim().split(/\s+/u)[0] ?? '';
    if (token === undefined || info !== CSF_LANGUAGE) {
      return renderFence(tokens, idx, options, env, renderer);
    }
    return `<div class="${CSF_LANGUAGE}">${token.content.replace(/\n$/u, '')}</div>\n`;
  };

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
