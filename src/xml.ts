/**
 * Publish Markdown files to Confluence wiki.
 *
 * Copyright 2022-2026, Levente Hunyadi
 *
 * :see: https://github.com/hunyadi/md2conf
 *
 * Port of `md2conf/xml.py` from hunyadi/md2conf (MIT).
 */

import type { Attr, Element, NamedNodeMap, Node, Text } from '@xmldom/xmldom';

export type ElementType = Element;
export type AttribType = Attr;

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const COMMENT_NODE = 8;

function isElement(node: Node): node is Element {
  return node.nodeType === ELEMENT_NODE;
}

function isText(node: Node): node is Text {
  return node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE;
}

/** The name of an element or attribute in `{namespace}name` notation, as lxml reports it. */
function qname(namespaceUri: string | null, name: string | null): string {
  const localName = name ?? '';
  return namespaceUri === null ? localName : `{${namespaceUri}}${localName}`;
}

function tagOf(elem: ElementType): string {
  return qname(elem.namespaceURI, elem.localName ?? elem.tagName);
}

function attrOf(attr: AttribType): string {
  return qname(attr.namespaceURI, attr.localName);
}

/** The text held directly by an element, the equivalent of lxml's `elem.text`. */
function textOf(elem: ElementType): string | null {
  const first = elem.firstChild;
  return first !== null && isText(first) ? first.data : null;
}

function setTextOf(elem: ElementType, value: string): void {
  const first = elem.firstChild;
  if (first !== null && isText(first)) {
    first.data = value;
  } else {
    const document = elem.ownerDocument;
    if (document === null) {
      throw new Error(`expected: element with an owner document; got: ${elem.tagName}`);
    }
    elem.insertBefore(document.createTextNode(value), first);
  }
}

/** The text that follows an element inside its parent, the equivalent of lxml's `elem.tail`. */
function tailOf(elem: ElementType): string | null {
  const next = elem.nextSibling;
  return next !== null && isText(next) ? next.data : null;
}

function setTailOf(elem: ElementType, value: string): void {
  const next = elem.nextSibling;
  if (next !== null && isText(next)) {
    next.data = value;
  } else {
    const document = elem.ownerDocument;
    if (document === null) {
      throw new Error(`expected: element with an owner document; got: ${elem.tagName}`);
    }
    elem.parentNode?.insertBefore(document.createTextNode(value), next);
  }
}

/** The element sibling that precedes an element, the equivalent of lxml's `elem.getprevious()`. */
function previousElement(elem: ElementType): ElementType | null {
  for (let sibling = elem.previousSibling; sibling !== null; sibling = sibling.previousSibling) {
    if (isElement(sibling)) {
      return sibling;
    }
  }
  return null;
}

/**
 * Removes an element from its parent. The DOM keeps tail text in a sibling node,
 * while lxml keeps it on the element itself, so the tail has to go as well.
 */
function detachElement(elem: ElementType): void {
  const next = elem.nextSibling;
  if (next !== null && isText(next)) {
    elem.parentNode?.removeChild(next);
  }
  elem.parentNode?.removeChild(elem);
}

/**
 * Inserts an element where lxml's `elem.insert(0, ...)` puts it: after the text of the
 * parent element and before its first child element.
 */
function insertFirstChild(parent: ElementType, elem: ElementType): void {
  parent.insertBefore(elem, [...parent.children][0] ?? null);
}

/**
 * Inserts an element where lxml's `elem.addnext(...)` puts it: after the element and the
 * tail text that belongs to it.
 */
function insertAfter(elem: ElementType, next: ElementType): void {
  const tail = elem.nextSibling;
  elem.parentNode?.insertBefore(next, tail !== null && isText(tail) ? tail.nextSibling : tail);
}

/**
 * Puts the text that follows a wrapped range in the tree. lxml keeps that text on the
 * element itself, which a detached element cannot do in the DOM, so a visitor that
 * creates the element is the only party able to place it.
 */
function insertTailAfter(elem: ElementType, tail: string | null): void {
  if (tail === null) {
    return;
  }
  const document = elem.ownerDocument;
  if (document === null) {
    throw new Error(`expected: element with an owner document; got: ${elem.tagName}`);
  }
  elem.parentNode?.insertBefore(document.createTextNode(tail), elem.nextSibling);
}

/** Moves a node into another parent; the tail text node travels with the node, as in lxml. */
function moveNode(node: Node, parent: ElementType, before: Node | null): void {
  const tail = node.nextSibling;
  if (tail !== null && isText(tail)) {
    node.parentNode?.removeChild(tail);
  }
  parent.insertBefore(node, before);
  if (tail !== null) {
    node.parentNode?.insertBefore(tail, node.nextSibling);
  }
}

/**
 * Splits text into characters. Python string positions count code points, while a
 * JavaScript string counts UTF-16 code units; positions in an element tree must count
 * the same way Python does.
 */
function chars(text: string): string[] {
  return Array.from(text);
}

/** The concatenation of all text in an element, the equivalent of lxml's `elem.itertext()`. */
function iterText(elem: ElementType): string {
  const parts: string[] = [];
  const collect = (node: Node): void => {
    if (isText(node)) {
      parts.push(node.data);
    } else if (node.nodeType !== COMMENT_NODE) {
      for (const child of node.childNodes) {
        collect(child);
      }
    }
  };
  collect(elem);
  return parts.join('');
}

/** The descendants of an element with a given name, the equivalent of lxml's `elem.iterdescendants(name)`. */
function descendants(elem: ElementType, name: string): ElementType[] {
  const found: ElementType[] = [];
  const collect = (node: ElementType): void => {
    for (const child of node.children) {
      if (tagOf(child) === name) {
        found.push(child);
      }
      collect(child);
    }
  };
  collect(elem);
  return found;
}

/**
 * Compares two dictionary objects, excluding keys in the skip set.
 *
 * @param exclude - Attributes to exclude, in `{namespace}name` notation.
 */
function attrsEqualExcluding(
  attrs1: NamedNodeMap,
  attrs2: NamedNodeMap,
  exclude: ReadonlySet<string>,
): boolean {
  // create key sets to compare, excluding keys to be skipped
  const entries1 = [...attrs1]
    .filter((attr) => !exclude.has(attrOf(attr)))
    .map((attr): [string, string] => [attrOf(attr), attr.value]);
  const entries2 = [...attrs2]
    .filter((attr) => !exclude.has(attrOf(attr)))
    .map((attr): [string, string] => [attrOf(attr), attr.value]);
  if (entries1.length !== entries2.length) {
    return false;
  }

  // compare values for each key
  return entries1.every(([key, value]) =>
    entries2.some((entry) => entry[0] === key && entry[1] === value),
  );
}

/**
 * Helps sort children of order-insensitive elements.
 *
 * Order-insensitive elements are typically configuration option containers (e.g. `<param>` in an `<object>`).
 * This function helps arrange children in a well-defined order to emulate set equality with an order-sensitive comparison.
 */
function elemSortKey(elem: ElementType): string {
  return JSON.stringify([
    tagOf(elem),
    [...elem.attributes]
      .map((attr): [string, string] => [attrOf(attr), attr.value])
      .sort((first, second) => compareStrings(first[0], second[0])),
  ]);
}

function compareStrings(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

export class ElementComparatorOptions {
  skipAttributes: Set<string>;
  skipElements: Set<string>;
  orderlessElements: Set<string>;

  /**
   * Sets options for the element tree comparator.
   *
   * @param skipAttributes - Attributes to exclude, in `{namespace}name` notation.
   * @param skipElements - Elements to exclude, in `{namespace}name` notation.
   * @param orderlessElements - Elements in which the order of children does not matter, in `{namespace}name` notation.
   */

  constructor(
    skipAttributes?: Iterable<string>,
    skipElements?: Iterable<string>,
    orderlessElements?: Iterable<string>,
  ) {
    this.skipAttributes = new Set(skipAttributes ?? []);
    this.skipElements = new Set(skipElements ?? []);
    this.orderlessElements = new Set(orderlessElements ?? []);
  }
}

export class ElementComparator {
  options: ElementComparatorOptions;

  /**
   * Initializes a new element tree comparator.
   */

  constructor(options?: ElementComparatorOptions) {
    this.options = options ?? new ElementComparatorOptions();
  }

  /**
   * Recursively check if two XML elements are equal.
   */
  isEqual(e1: ElementType, e2: ElementType): boolean {
    if (tagOf(e1) !== tagOf(e2)) {
      return false;
    }

    // compare tail first, which is outside of element
    const e1Tail = tailOf(e1)?.trim() ?? '';
    const e2Tail = tailOf(e2)?.trim() ?? '';
    if (e1Tail !== e2Tail) {
      return false;
    }

    // skip element (and content) if on ignore list
    if (this.options.skipElements.has(tagOf(e1))) {
      return true;
    }

    // compare text second, which is encapsulated by element
    const e1Text = textOf(e1)?.trim() ?? '';
    const e2Text = textOf(e2)?.trim() ?? '';
    if (e1Text !== e2Text) {
      return false;
    }

    // compare attributes, disregarding definition order
    if (!attrsEqualExcluding(e1.attributes, e2.attributes, this.options.skipAttributes)) {
      return false;
    }

    // compare children recursively
    const children1 = [...e1.children];
    const children2 = [...e2.children];
    if (children1.length !== children2.length) {
      return false;
    }
    if (
      children1.every((child1, index) => {
        const child2 = children2[index];
        return child2 !== undefined && this.isEqual(child1, child2);
      })
    ) {
      return true;
    }

    if (this.options.orderlessElements.has(tagOf(e1))) {
      const sorted1 = children1.toSorted((first, second) =>
        compareStrings(elemSortKey(first), elemSortKey(second)),
      );
      const sorted2 = children2.toSorted((first, second) =>
        compareStrings(elemSortKey(first), elemSortKey(second)),
      );
      return sorted1.every((child1, index) => {
        const child2 = sorted2[index];
        return child2 !== undefined && this.isEqual(child1, child2);
      });
    }

    return false;
  }
}

/**
 * Compare two XML documents for equivalence, ignoring leading/trailing whitespace differences and attribute definition order.
 *
 * Elements may be excluded, in which case they compare equal to any element of the same type that has the same tail text.
 *
 * @param tree1 - XML document as an element tree.
 * @param tree2 - XML document as an element tree.
 * @param options - Options to control how XML elements are compared.
 * @returns True if equivalent, False otherwise.
 */
export function isXmlEqual(
  tree1: ElementType,
  tree2: ElementType,
  options?: ElementComparatorOptions,
): boolean {
  return new ElementComparator(options).isEqual(tree1, tree2);
}

/**
 * Returns all text contained in an element as a concatenated string.
 */
export function elementToText(node: ElementType): string {
  return iterText(node).trim();
}

/**
 * Removes a child element, taking care of its tail text.
 *
 * This function may be unsafe when called in the body of a loop of a live collection iterator, i.e. use
 *
 * ```
 * for (const child of [...node.children]) ...
 * ```
 *
 * instead of
 *
 * ```
 * for (const child of node.children) ...
 * ```
 */
export function removeElement(child: ElementType): void {
  const parent = child.parentNode;
  if (parent === null) {
    return;
  }

  // preserve any text that comes after the heading (tail text)
  const tail = tailOf(child);

  // if there was tail text, attach it to the previous sibling's tail or to the parent's text if this was the first child
  if (tail !== null && isElement(parent)) {
    const siblings = [...parent.children];
    const index = siblings.indexOf(child);
    const prevSibling = index > 0 ? siblings[index - 1] : undefined;
    if (prevSibling !== undefined) {
      // append to previous sibling's tail
      setTailOf(prevSibling, `${tailOf(prevSibling) ?? ''}${tail}`);
    } else {
      // no previous sibling, append to parent's text
      setTextOf(parent, `${textOf(parent) ?? ''}${tail}`);
    }
  }

  // remove the element
  detachElement(child);
}

export class ElementSpan {
  readonly element: ElementType;
  readonly start: number;
  readonly end: number;

  constructor(element: ElementType, start: number, end: number) {
    this.element = element;
    this.start = start;
    this.end = end;
  }
}

class SpanVisitor {
  /**
   * Returns the start and end positions of all occurrences of a given tag in an XML tree w.r.t. the inner text of the root element.
   */

  readonly tagName: string;
  start = 0;
  spans: ElementSpan[];

  /**
   * Initializes a new visitor to find all occurrences of a tag among the descendants of an element.
   *
   * @param tagName - Tag name to find.
   */

  constructor(tagName: string) {
    this.tagName = tagName;
    this.spans = [];
  }

  /**
   * Finds all occurrences of a tag among the descendants of an element.
   *
   * @param root - Root element to start the search from.
   * @returns List of {@link ElementSpan} instances containing the element, start, and end positions.
   */
  visit(root: ElementType): ElementSpan[] {
    this.start = chars(textOf(root) ?? '').length;
    this.spans = [];
    this.visitChildren(root);
    const spans = this.spans;
    this.spans = [];
    return spans;
  }

  private visitChildren(node: ElementType): void {
    for (const child of node.children) {
      if (tagOf(child) === this.tagName) {
        const end = this.start + chars(iterText(child)).length;
        this.spans.push(new ElementSpan(child, this.start, end));
        this.start = end;
      } else {
        this.start += chars(textOf(child) ?? '').length;
        this.visitChildren(child);
      }
      this.start += chars(tailOf(child) ?? '').length;
    }
  }
}

export function getElementSpans(tagName: string, root: ElementType): ElementSpan[] {
  return new SpanVisitor(tagName).visit(root);
}

/**
 * Substitutes all occurrences of an element with its contents.
 *
 * @param name - Element tag name to find and replace.
 * @param root - Top-most element at which to start.
 */
export function unwrapSubstitute(name: string, root: ElementType): void {
  for (const node of descendants(root, name)) {
    const text = textOf(node);
    if (text) {
      // append first piece of text in this element at the end of previous sibling, or text contained by parent
      const prevNode = previousElement(node);
      const parentNode = node.parentElement;
      if (prevNode !== null) {
        setTailOf(prevNode, `${tailOf(prevNode) ?? ''}${text}`);
      } else if (parentNode !== null) {
        // always true except for root
        setTextOf(parentNode, `${textOf(parentNode) ?? ''}${text}`);
      } else {
        throw new Error('must always have a previous sibling or a parent');
      }
    }
    const tail = tailOf(node);
    if (tail !== null && tail.length > 0) {
      const lastNode = [...node.children].pop();
      if (lastNode !== undefined) {
        // append text immediately following the closing tag of this element to the last child element of this element
        setTailOf(lastNode, `${tailOf(lastNode) ?? ''}${tail}`);
      } else {
        // node has no child elements, only text
        const prevNode = previousElement(node);
        const parentNode = node.parentElement;
        if (prevNode !== null) {
          setTailOf(prevNode, `${tailOf(prevNode) ?? ''}${tail}`);
        } else if (parentNode !== null) {
          // always true except for root
          setTextOf(parentNode, `${textOf(parentNode) ?? ''}${tail}`);
        } else {
          throw new Error('must always have a previous sibling or a parent');
        }
      }
    }
    // the tail text node goes before the children move out, or it would end up between them
    const tailNode = node.nextSibling;
    if (tailNode !== null && isText(tailNode)) {
      node.parentNode?.removeChild(tailNode);
    }
    for (const child of [...node.children].reverse()) {
      const parentNode = node.parentElement;
      if (parentNode === null) {
        throw new Error('must always have a parent');
      }
      moveNode(child, parentNode, node.nextSibling);
    }
    node.parentNode?.removeChild(node);
  }
}

export class WrapVisitor {
  /**
   * Wraps a specified range of text in an element, mutating the tree in place.
   */

  spanStart: number;
  spanEnd: number;
  readonly factory: (text: string, tail: string | null) => ElementType;
  position = 0;

  constructor(
    start: number,
    end: number,
    factory: (text: string, tail: string | null) => ElementType,
  ) {
    this.spanStart = start;
    this.spanEnd = end;
    this.factory = factory;
  }

  visit(root: ElementType): boolean {
    this.position = 0;
    return this.visitChildren(root);
  }

  private visitChildren(node: ElementType): boolean {
    let inserted = false;
    const text = textOf(node);
    if (text) {
      const content = chars(text);
      const length = content.length;
      if (this.spanStart < this.position + length) {
        const wrapsAll = this.spanEnd <= this.position + length;
        const elem = wrapsAll
          ? this.factory(
              content.slice(this.spanStart - this.position, this.spanEnd - this.position).join(''),
              content.slice(this.spanEnd - this.position).join(''),
            )
          : this.factory(content.slice(this.spanStart - this.position).join(''), null);
        // the text is truncated before the element is inserted: the DOM stores it in the
        // first child, which the new element would otherwise take over
        setTextOf(node, content.slice(0, this.spanStart - this.position).join(''));
        insertFirstChild(node, elem);
        insertTailAfter(
          elem,
          wrapsAll ? content.slice(this.spanEnd - this.position).join('') : null,
        );
        if (wrapsAll) {
          return true;
        }
        this.position += length;
        this.spanStart = this.position;
        inserted = true;
      } else {
        this.position += length;
      }
    }

    const children = [...node.children];
    for (let index = inserted ? 1 : 0; index < children.length; index += 1) {
      const child = children[index];
      if (child !== undefined && this.visitChildren(child)) {
        return true;
      }
    }

    const tail = tailOf(node);
    if (tail !== null && tail.length > 0) {
      const content = chars(tail);
      const length = content.length;
      if (this.spanStart < this.position + length) {
        const wrapsAll = this.spanEnd <= this.position + length;
        const elem = wrapsAll
          ? this.factory(
              content.slice(this.spanStart - this.position, this.spanEnd - this.position).join(''),
              content.slice(this.spanEnd - this.position).join(''),
            )
          : this.factory(content.slice(this.spanStart - this.position).join(''), null);
        setTailOf(node, content.slice(0, this.spanStart - this.position).join(''));
        insertAfter(node, elem);
        insertTailAfter(
          elem,
          wrapsAll ? content.slice(this.spanEnd - this.position).join('') : null,
        );
        if (wrapsAll) {
          return true;
        }
        this.position += length;
        this.spanStart = this.position;
      } else {
        this.position += length;
      }
    }

    return false;
  }
}
