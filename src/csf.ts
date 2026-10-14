/**
 * Publish Markdown files to Confluence wiki.
 *
 * Copyright 2022-2026, Levente Hunyadi
 *
 * :see: https://github.com/hunyadi/md2conf
 *
 * Port of `md2conf/csf.py` from hunyadi/md2conf (MIT).
 */

import { DOMParser, MIME_TYPE, XMLSerializer, type Element, type Node } from '@xmldom/xmldom';

export type ElementType = Element;

/** XML namespaces typically associated with Confluence Storage Format documents */
const NAMESPACES = {
  ac: 'http://atlassian.com/content',
  ri: 'http://atlassian.com/resource/identifier',
} as const;

const NS_ATTR_LIST = Object.entries(NAMESPACES)
  .map(([key, value]) => ` xmlns:${key}="${value}"`)
  .join('');

export class ParseError extends Error {}

const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const COMMENT_NODE = 8;

function isTextNode(node: Node): boolean {
  return node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE;
}

/** The name of an element or attribute in `{namespace}name` notation, as lxml reports it. */
function qname(namespaceUri: string | null, name: string): string {
  return namespaceUri === null ? name : `{${namespaceUri}}${name}`;
}

function tagName(elem: ElementType): string {
  return qname(elem.namespaceURI, elem.localName ?? elem.tagName);
}

export function acAttr(name: string): string {
  return qname(NAMESPACES.ac, name);
}

export function riAttr(name: string): string {
  return qname(NAMESPACES.ri, name);
}

/**
 * Maps an HTML 4 named character entity to its Unicode code point, as declared in
 * `md2conf/entities.dtd` upstream. The five entities XML defines itself (`amp`,
 * `lt`, `gt`, `quot` and `apos`) are left out; the parser resolves those on its own.
 */
const ENTITIES: Readonly<Record<string, number>> = {
  nbsp: 0x00a0,
  iexcl: 0x00a1,
  cent: 0x00a2,
  pound: 0x00a3,
  curren: 0x00a4,
  yen: 0x00a5,
  brvbar: 0x00a6,
  sect: 0x00a7,
  uml: 0x00a8,
  copy: 0x00a9,
  ordf: 0x00aa,
  laquo: 0x00ab,
  not: 0x00ac,
  shy: 0x00ad,
  reg: 0x00ae,
  macr: 0x00af,
  deg: 0x00b0,
  plusmn: 0x00b1,
  sup2: 0x00b2,
  sup3: 0x00b3,
  acute: 0x00b4,
  micro: 0x00b5,
  para: 0x00b6,
  middot: 0x00b7,
  cedil: 0x00b8,
  sup1: 0x00b9,
  ordm: 0x00ba,
  raquo: 0x00bb,
  frac14: 0x00bc,
  frac12: 0x00bd,
  frac34: 0x00be,
  iquest: 0x00bf,
  Agrave: 0x00c0,
  Aacute: 0x00c1,
  Acirc: 0x00c2,
  Atilde: 0x00c3,
  Auml: 0x00c4,
  Aring: 0x00c5,
  AElig: 0x00c6,
  Ccedil: 0x00c7,
  Egrave: 0x00c8,
  Eacute: 0x00c9,
  Ecirc: 0x00ca,
  Euml: 0x00cb,
  Igrave: 0x00cc,
  Iacute: 0x00cd,
  Icirc: 0x00ce,
  Iuml: 0x00cf,
  ETH: 0x00d0,
  Ntilde: 0x00d1,
  Ograve: 0x00d2,
  Oacute: 0x00d3,
  Ocirc: 0x00d4,
  Otilde: 0x00d5,
  Ouml: 0x00d6,
  times: 0x00d7,
  Oslash: 0x00d8,
  Ugrave: 0x00d9,
  Uacute: 0x00da,
  Ucirc: 0x00db,
  Uuml: 0x00dc,
  Yacute: 0x00dd,
  THORN: 0x00de,
  szlig: 0x00df,
  agrave: 0x00e0,
  aacute: 0x00e1,
  acirc: 0x00e2,
  atilde: 0x00e3,
  auml: 0x00e4,
  aring: 0x00e5,
  aelig: 0x00e6,
  ccedil: 0x00e7,
  egrave: 0x00e8,
  eacute: 0x00e9,
  ecirc: 0x00ea,
  euml: 0x00eb,
  igrave: 0x00ec,
  iacute: 0x00ed,
  icirc: 0x00ee,
  iuml: 0x00ef,
  eth: 0x00f0,
  ntilde: 0x00f1,
  ograve: 0x00f2,
  oacute: 0x00f3,
  ocirc: 0x00f4,
  otilde: 0x00f5,
  ouml: 0x00f6,
  divide: 0x00f7,
  oslash: 0x00f8,
  ugrave: 0x00f9,
  uacute: 0x00fa,
  ucirc: 0x00fb,
  uuml: 0x00fc,
  yacute: 0x00fd,
  thorn: 0x00fe,
  yuml: 0x00ff,
  fnof: 0x0192,
  Alpha: 0x0391,
  Beta: 0x0392,
  Gamma: 0x0393,
  Delta: 0x0394,
  Epsilon: 0x0395,
  Zeta: 0x0396,
  Eta: 0x0397,
  Theta: 0x0398,
  Iota: 0x0399,
  Kappa: 0x039a,
  Lambda: 0x039b,
  Mu: 0x039c,
  Nu: 0x039d,
  Xi: 0x039e,
  Omicron: 0x039f,
  Pi: 0x03a0,
  Rho: 0x03a1,
  Sigma: 0x03a3,
  Tau: 0x03a4,
  Upsilon: 0x03a5,
  Phi: 0x03a6,
  Chi: 0x03a7,
  Psi: 0x03a8,
  Omega: 0x03a9,
  alpha: 0x03b1,
  beta: 0x03b2,
  gamma: 0x03b3,
  delta: 0x03b4,
  epsilon: 0x03b5,
  zeta: 0x03b6,
  eta: 0x03b7,
  theta: 0x03b8,
  iota: 0x03b9,
  kappa: 0x03ba,
  lambda: 0x03bb,
  mu: 0x03bc,
  nu: 0x03bd,
  xi: 0x03be,
  omicron: 0x03bf,
  pi: 0x03c0,
  rho: 0x03c1,
  sigmaf: 0x03c2,
  sigma: 0x03c3,
  tau: 0x03c4,
  upsilon: 0x03c5,
  phi: 0x03c6,
  chi: 0x03c7,
  psi: 0x03c8,
  omega: 0x03c9,
  thetasym: 0x03d1,
  upsih: 0x03d2,
  piv: 0x03d6,
  bull: 0x2022,
  hellip: 0x2026,
  prime: 0x2032,
  Prime: 0x2033,
  oline: 0x203e,
  frasl: 0x2044,
  weierp: 0x2118,
  image: 0x2111,
  real: 0x211c,
  trade: 0x2122,
  alefsym: 0x2135,
  larr: 0x2190,
  uarr: 0x2191,
  rarr: 0x2192,
  darr: 0x2193,
  harr: 0x2194,
  crarr: 0x21b5,
  lArr: 0x21d0,
  uArr: 0x21d1,
  rArr: 0x21d2,
  dArr: 0x21d3,
  hArr: 0x21d4,
  forall: 0x2200,
  part: 0x2202,
  exist: 0x2203,
  empty: 0x2205,
  nabla: 0x2207,
  isin: 0x2208,
  notin: 0x2209,
  ni: 0x220b,
  prod: 0x220f,
  sum: 0x2211,
  minus: 0x2212,
  lowast: 0x2217,
  radic: 0x221a,
  prop: 0x221d,
  infin: 0x221e,
  ang: 0x2220,
  and: 0x2227,
  or: 0x2228,
  cap: 0x2229,
  cup: 0x222a,
  int: 0x222b,
  there4: 0x2234,
  sim: 0x223c,
  cong: 0x2245,
  asymp: 0x2248,
  ne: 0x2260,
  equiv: 0x2261,
  le: 0x2264,
  ge: 0x2265,
  sub: 0x2282,
  sup: 0x2283,
  nsub: 0x2284,
  sube: 0x2286,
  supe: 0x2287,
  oplus: 0x2295,
  otimes: 0x2297,
  perp: 0x22a5,
  sdot: 0x22c5,
  lceil: 0x2308,
  rceil: 0x2309,
  lfloor: 0x230a,
  rfloor: 0x230b,
  lang: 0x2329,
  rang: 0x232a,
  loz: 0x25ca,
  spades: 0x2660,
  clubs: 0x2663,
  hearts: 0x2665,
  diams: 0x2666,
  OElig: 0x0152,
  oelig: 0x0153,
  Scaron: 0x0160,
  scaron: 0x0161,
  Yuml: 0x0178,
  circ: 0x02c6,
  tilde: 0x02dc,
  ensp: 0x2002,
  emsp: 0x2003,
  thinsp: 0x2009,
  zwnj: 0x200c,
  zwj: 0x200d,
  lrm: 0x200e,
  rlm: 0x200f,
  ndash: 0x2013,
  mdash: 0x2014,
  lsquo: 0x2018,
  rsquo: 0x2019,
  sbquo: 0x201a,
  ldquo: 0x201c,
  rdquo: 0x201d,
  bdquo: 0x201e,
  dagger: 0x2020,
  Dagger: 0x2021,
  permil: 0x2030,
  lsaquo: 0x2039,
  rsaquo: 0x203a,
  euro: 0x20ac,
};

/** The entities XML declares itself; libxml2 resolves these without a DTD. */
const XML_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

/** A comment, a CDATA section or a character reference, in any of the forms XML allows. */
const REFERENCE_REGEXP = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|&([^;\s<&]*)(;?)/g;

/**
 * Substitutes all occurrences of an HTML named entity with a numeric character
 * reference. This is what replaces the entity DTD upstream loads into lxml.
 *
 * A reference that XML cannot resolve is rejected here, because xmldom accepts a
 * bare ampersand where libxml2 reports an error, and upstream rejects it.
 *
 * @param content - XML fragment, possibly with named entities such as `&copy;`.
 * @returns The same fragment with every known named entity as a numeric reference.
 */
export function entities(content: string): string {
  return content.replace(REFERENCE_REGEXP, (match, name: string, semicolon: string) => {
    // text inside a comment or a CDATA section is taken literally
    if (match.startsWith('<!--') || match.startsWith('<![CDATA[')) {
      return match;
    }
    if (semicolon !== ';') {
      throw new ParseError(`XML parse error: Entity '${name}' not defined`);
    }
    if (XML_ENTITIES.has(name) || /^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(name)) {
      return match;
    }
    const code = ENTITIES[name];
    if (code === undefined) {
      throw new ParseError(`XML parse error: Entity '${name}' not defined`);
    }
    return `&#${code.toString()};`;
  });
}

/** The text held directly by an element, the equivalent of lxml's `elem.text`. */
function textOf(elem: ElementType): string | null {
  const first = elem.firstChild;
  return first !== null && isTextNode(first) ? first.nodeValue : null;
}

function setTextOf(elem: ElementType, value: string): void {
  const first = elem.firstChild;
  if (first !== null && isTextNode(first)) {
    first.nodeValue = value;
  } else {
    const document = elem.ownerDocument;
    if (document === null) {
      throw new Error(`expected: element with an owner document; got: ${elem.tagName}`);
    }
    elem.insertBefore(document.createTextNode(value), first);
  }
}

function removeTextOf(elem: ElementType): void {
  const first = elem.firstChild;
  if (first !== null && isTextNode(first)) {
    elem.removeChild(first);
  }
}

/** The text that follows an element inside its parent, the equivalent of lxml's `elem.tail`. */
function tailOf(elem: ElementType): string | null {
  const next = elem.nextSibling;
  return next !== null && isTextNode(next) ? next.nodeValue : null;
}

function setTailOf(elem: ElementType, value: string): void {
  const next = elem.nextSibling;
  if (next !== null && isTextNode(next)) {
    next.nodeValue = value;
  } else {
    const document = elem.ownerDocument;
    if (document === null) {
      throw new Error(`expected: element with an owner document; got: ${elem.tagName}`);
    }
    elem.parentNode?.insertBefore(document.createTextNode(value), next);
  }
}

function removeTailOf(elem: ElementType): void {
  const next = elem.nextSibling;
  if (next !== null && isTextNode(next)) {
    elem.parentNode?.removeChild(next);
  }
}

function createChild(parent: ElementType, tagName: string): ElementType {
  const document = parent.ownerDocument;
  if (document === null) {
    throw new Error(`expected: element with an owner document; got: ${parent.tagName}`);
  }
  return document.createElement(tagName);
}

/** Moves a node into another parent; the tail text node travels with the node, as in lxml. */
function moveNode(node: Node, parent: ElementType): void {
  const tail = node.nextSibling;
  if (tail !== null && isTextNode(tail)) {
    node.parentNode?.removeChild(tail);
  }
  parent.appendChild(node);
  if (tail !== null) {
    node.parentNode?.insertBefore(tail, node.nextSibling);
  }
}

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * Applies what lxml's parser options `remove_comments=True` and
 * `remove_blank_text=True` do, which xmldom has no equivalent for.
 *
 * A blank text node is dropped when the element holds an element or CDATA section,
 * unless text already seen in that element makes the content mixed, or the blank is
 * the only thing the element holds. This reproduces libxml2's `areBlanks()`
 * heuristic, which decides the question once per text node while parsing, so a
 * comment must stay invisible here even though the DOM materializes it.
 */
function removeCommentsAndBlankText(elem: ElementType): void {
  for (const child of [...elem.children]) {
    removeCommentsAndBlankText(child);
  }

  const nodes = [...elem.childNodes];
  let seenText = false;
  let hasElement = false;
  for (const [index, node] of nodes.entries()) {
    if (node.nodeType === COMMENT_NODE) {
      continue;
    }
    if (!isTextNode(node)) {
      hasElement = true;
      continue;
    }
    const text = node.nodeValue ?? '';
    if (isBlank(text)) {
      if (seenText || (!hasElement && index === nodes.length - 1)) {
        seenText = true;
      } else {
        elem.removeChild(node);
      }
    } else {
      seenText = true;
    }
  }

  // removing a comment joins the text on either side of it into a single text node
  for (const node of [...elem.childNodes]) {
    if (node.nodeType !== COMMENT_NODE) {
      continue;
    }
    const previous = node.previousSibling;
    const next = node.nextSibling;
    if (previous !== null && isTextNode(previous) && next !== null && isTextNode(next)) {
      previous.nodeValue = (previous.nodeValue ?? '') + (next.nodeValue ?? '');
      elem.removeChild(next);
    }
    elem.removeChild(node);
  }
}

const ROOT_REGEXP = /^<root\s+[^>]*>([\s\S]*)<\/root>\s*$/;

/**
 * Creates an XML document tree from XML fragment strings.
 *
 * This function
 * * wraps the content in a root element,
 * * adds namespace declarations associated with Confluence documents.
 *
 * @param items - Strings to parse into XML fragments.
 * @returns An XML document as an element tree.
 */
export function elementsFromStrings(items: readonly string[]): ElementType {
  const data = [`<root${NS_ATTR_LIST}>`, ...items.map(entities), '</root>'];

  const errors: string[] = [];
  const parser = new DOMParser({
    onError: (_level: string, message: string) => {
      errors.push(message);
    },
  });

  let root: ElementType | null;
  try {
    root = parser.parseFromString(data.join(''), MIME_TYPE.XML_TEXT).documentElement;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    root = null;
  }

  if (errors.length > 0 || root === null) {
    // xmldom reports where it stopped, which does not map to a position in the Markdown source
    throw new ParseError(`XML parse error: ${errors[0] ?? 'no root element'}`);
  }

  removeCommentsAndBlankText(root);
  return root;
}

/**
 * Creates a Confluence Storage Format XML document tree from an XML string.
 *
 * @param content - String to parse into XML.
 * @returns An XML document as an element tree.
 */
export function elementsFromString(content: string): ElementType {
  return elementsFromStrings([content]);
}

/**
 * Converts a Confluence Storage Format document returned by the Confluence REST
 * API into an XML document.
 *
 * This function
 * * wraps the content in a root element,
 * * adds namespace declarations associated with Confluence documents.
 *
 * @param content - Confluence Storage Format content as a string.
 * @returns XML as a string.
 */
export function contentToString(content: string): string {
  const root = elementsFromString(content);
  return new XMLSerializer().serializeToString(root);
}

/**
 * Converts a Confluence Storage Format element tree into an XML string to push to
 * the Confluence REST API.
 *
 * @param root - Synthesized XML element tree of a Confluence Storage Format document.
 * @returns XML as a string.
 */
export function elementsToString(root: ElementType): string {
  const xml = new XMLSerializer().serializeToString(root);
  const match = ROOT_REGEXP.exec(xml);
  if (match === null) {
    throw new Error('expected: Confluence content');
  }
  return match[1] ?? '';
}

export function isBlockLike(elem: ElementType): boolean {
  return ['div', 'li', 'ol', 'p', 'pre', 'td', 'th', 'ul'].includes(tagName(elem));
}

/**
 * Ensures that inline elements are direct children of an eligible block element.
 *
 * The following transformations are applied:
 *
 * * consecutive inline elements and text nodes that are the direct children of the parent element are wrapped into a `<p>`,
 * * block elements are left intact,
 * * leading and trailing whitespace in each block element is removed.
 *
 * The above steps transform an element tree such as
 * ```
 * <li>  to <em>be</em>, <ol/> not to <em>be</em>  </li>
 * ```
 * into another element tree such as
 * ```
 * <li><p>to <em>be</em>,</p><ol/><p>not to <em>be</em></p></li>
 * ```
 */
export function normalizeInline(elem: ElementType): void {
  if (!isBlockLike(elem)) {
    throw new Error(`expected: block element; got: ${tagName(elem)}`);
  }

  const contents: ElementType[] = [];

  let paragraph = createChild(elem, 'p');
  contents.push(paragraph);
  const text = textOf(elem);
  if (text) {
    setTextOf(paragraph, text);
    removeTextOf(elem);
  }

  for (const child of [...elem.children]) {
    if (isBlockLike(child)) {
      contents.push(child);
      paragraph = createChild(elem, 'p');
      contents.push(paragraph);
      const tail = tailOf(child);
      if (tail) {
        setTextOf(paragraph, tail);
        removeTailOf(child);
      }
    } else {
      moveNode(child, paragraph);
    }
  }

  for (const item of contents) {
    // remove lead whitespace in the block element
    const lead = textOf(item);
    if (lead) {
      setTextOf(item, lead.replace(/^\s+/, ''));
    }

    const last = [...item.children].pop();
    if (last !== undefined) {
      // remove tail whitespace in the last child of the block element
      const tail = tailOf(last);
      if (tail) {
        setTailOf(last, tail.replace(/\s+$/, ''));
      }
    } else {
      // remove tail whitespace directly in the block element content
      const only = textOf(item);
      if (only) {
        setTextOf(item, only.replace(/\s+$/, ''));
      }
    }

    // ignore empty elements
    if (tagName(item) !== 'p' || item.children.length > 0 || textOf(item)) {
      elem.appendChild(item);
    }
  }
}

// elements in which whitespace is normalized
const NORMALIZED_ELEMENTS = new Set([
  'a',
  'b',
  'blockquote',
  'code',
  'del',
  'details',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'li',
  'p',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'td',
  'th',
  'u',
  `{${NAMESPACES.ac}}link-body`,
  `{${NAMESPACES.ac}}rich-text-body`,
  `{${NAMESPACES.ac}}task-body`,
]);

// elements that are recursed into for whitespace normalization
const PASSTHROUGH_ELEMENTS = new Set([
  ...NORMALIZED_ELEMENTS,
  'ol',
  'table',
  'tbody',
  'tfoot',
  'thead',
  'tr',
  'ul',
  `{${NAMESPACES.ac}}link`,
  `{${NAMESPACES.ac}}structured-macro`,
  `{${NAMESPACES.ac}}task`,
  `{${NAMESPACES.ac}}task-list`,
]);

export function normalizeWhitespace(elem: ElementType): void {
  'Replaces linefeed with space in contexts where whitespace normalization is permitted.';

  if (!textOf(elem) && elem.children.length < 1) {
    // empty element
    return;
  }

  if (!PASSTHROUGH_ELEMENTS.has(tagName(elem))) {
    // element whose descendants are to be skipped
    return;
  }

  if (NORMALIZED_ELEMENTS.has(tagName(elem))) {
    const text = textOf(elem);
    if (text) {
      setTextOf(elem, text.replaceAll('\n', ' '));
    }
    for (const child of elem.children) {
      const tail = tailOf(child);
      if (tail) {
        setTailOf(child, tail.replaceAll('\n', ' '));
      }
    }
  }

  for (const child of elem.children) {
    normalizeWhitespace(child);
  }
}

/**
 * Converts a Confluence Storage Format (CSF) document to the normalized format.
 */
export function canonicalize(content: string): string {
  const root = elementsFromString(content);
  for (const child of root.children) {
    normalizeWhitespace(child);
  }
  return elementsToString(root);
}
