/**
 * Publish Markdown files to Confluence wiki.
 *
 * Copyright 2022-2026, Levente Hunyadi
 *
 * :see: https://github.com/hunyadi/md2conf
 *
 * Port of `tests/test_xml.py` from hunyadi/md2conf (MIT).
 */

import { XMLSerializer, type Document } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

import {
  ParseError,
  acAttr,
  canonicalize,
  contentToString,
  elementsFromString,
  elementsToString,
  normalizeInline,
} from '../src/csf.js';
import {
  ElementComparatorOptions,
  WrapVisitor,
  elementToText,
  getElementSpans,
  isXmlEqual,
  removeElement,
  unwrapSubstitute,
} from '../src/xml.js';
import type { ElementType } from '../src/xml.js';

function serialize(tree: ElementType): string {
  return new XMLSerializer().serializeToString(tree);
}

/** The document an element belongs to; the fragments below are always part of one. */
function ownerDocument(elem: ElementType): Document {
  const document = elem.ownerDocument;
  if (document === null) {
    throw new Error(`expected: ${elem.tagName} to have an owner document`);
  }
  return document;
}

/** The child element at a given index; the fragments below always have one. */
function childAt(parent: ElementType, index: number): ElementType {
  const child = [...parent.children][index];
  if (child === undefined) {
    throw new Error(`expected: a child element at index ${index.toString()}`);
  }
  return child;
}

/**
 * Parses an XML fragment. `elementsFromString` returns the `<root>` element it wraps
 * fragments in; tests that work on a single element, as the Python tests do with
 * `ET.fromstring`, take that element here.
 */
function fragment(xml: string): ElementType {
  const root = elementsFromString(xml);
  const first = root.firstChild;
  if (first === null) {
    throw new Error(`expected: an element in ${xml}`);
  }
  return first as ElementType;
}

/** On mismatch the serialized trees are compared, which reports where the trees differ. */
function assertXmlEqual(
  tree1: ElementType,
  tree2: ElementType,
  options?: ElementComparatorOptions,
): void {
  if (!isXmlEqual(tree1, tree2, options)) {
    expect(serialize(tree1)).toBe(serialize(tree2));
  }
}

function assertXmlNotEqual(tree1: ElementType, tree2: ElementType): void {
  if (isXmlEqual(tree1, tree2)) {
    expect(serialize(tree1)).not.toBe(serialize(tree2));
  }
}

describe('isXmlEqual', () => {
  it('considers character entities and numeric references equivalent', () => {
    const tree1 = elementsFromString('<body><p>to be, or "not" to be 😉</p></body>');
    const tree2 = elementsFromString(
      '<body><p>to be, or &quot;not&quot; to be &#128521;</p></body>',
    );

    assertXmlEqual(tree1, tree2);
  });

  it('honours attributes to skip', () => {
    const tree1 = elementsFromString(
      '<body><p class="paragraph" data-skip="..." style="display: none;">to be, or not to be</p></body>',
    );
    const tree2 = elementsFromString(
      '<body><p style="display: none;" class="paragraph">to be, or not to be</p></body>',
    );

    assertXmlNotEqual(tree1, tree2);
    assertXmlEqual(tree1, tree2, new ElementComparatorOptions(['data-skip']));
  });

  it('ignores the order of children in orderless elements', () => {
    const tree1 = elementsFromString(
      '<ac:structured-macro ac:name="toc"><ac:parameter ac:name="a"/><ac:parameter ac:name="b"/></ac:structured-macro>',
    );
    const tree2 = elementsFromString(
      '<ac:structured-macro ac:name="toc"><ac:parameter ac:name="b"/><ac:parameter ac:name="a"/></ac:structured-macro>',
    );

    assertXmlNotEqual(tree1, tree2);
    assertXmlEqual(
      tree1,
      tree2,
      new ElementComparatorOptions(undefined, undefined, [acAttr('structured-macro')]),
    );
  });

  it('ignores the content of skipped elements', () => {
    const tree1 = elementsFromString('<body><ac:task-uuid>1</ac:task-uuid></body>');
    const tree2 = elementsFromString('<body><ac:task-uuid>2</ac:task-uuid></body>');

    assertXmlNotEqual(tree1, tree2);
    assertXmlEqual(tree1, tree2, new ElementComparatorOptions(undefined, [acAttr('task-uuid')]));
  });

  it('distinguishes namespaced elements from elements of the same local name', () => {
    const tree1 = elementsFromString('<ac:link>text</ac:link>');
    const tree2 = elementsFromString('<link>text</link>');

    assertXmlNotEqual(tree1, tree2);
  });
});

describe('normalizeInline', () => {
  it('leaves an empty block element alone', () => {
    const tree1 = fragment('<li>  </li>');
    const tree2 = fragment('<li></li>');

    normalizeInline(tree1);

    assertXmlEqual(tree1, tree2);
  });

  it('wraps text in a paragraph', () => {
    const tree1 = fragment('<li>to be, or not to be</li>');
    const tree2 = fragment('<li><p>to be, or not to be</p></li>');

    normalizeInline(tree1);

    assertXmlEqual(tree1, tree2);
  });

  it('keeps inline elements inside the paragraph', () => {
    const tree1 = fragment('<li>to <em>be</em>, or not to <em>be</em></li>');
    const tree2 = fragment('<li><p>to <em>be</em>, or not to <em>be</em></p></li>');

    normalizeInline(tree1);

    assertXmlEqual(tree1, tree2);
  });

  it('keeps block elements outside the paragraph', () => {
    const tree1 = fragment('<li>to be, <ol/> not to be</li>');
    const tree2 = fragment('<li><p>to be,</p><ol/><p>not to be</p></li>');

    normalizeInline(tree1);

    assertXmlEqual(tree1, tree2);
  });

  it('puts the tail of a block element in a new paragraph', () => {
    const tree1 = fragment('<li>to <em>be</em>, <ol/> not to <em>be</em></li>');
    const tree2 = fragment('<li><p>to <em>be</em>,</p><ol/><p>not to <em>be</em></p></li>');

    normalizeInline(tree1);

    assertXmlEqual(tree1, tree2);
  });

  it('removes leading and trailing whitespace', () => {
    const tree1 = fragment('<li>  to <em>be</em>, <ol/> not to <em>be</em>  </li>');
    const tree2 = fragment('<li><p>to <em>be</em>,</p><ol/><p>not to <em>be</em></p></li>');

    normalizeInline(tree1);

    assertXmlEqual(tree1, tree2);
  });

  it('keeps whitespace inside a block element', () => {
    const tree1 = fragment('<li>  to <em>be</em>, <pre>  or  </pre> not to <em>be</em>  </li>');
    const tree2 = fragment(
      '<li><p>to <em>be</em>,</p><pre>  or  </pre><p>not to <em>be</em></p></li>',
    );

    normalizeInline(tree1);

    assertXmlEqual(tree1, tree2);
  });

  it('rejects an element that is not block-like', () => {
    const tree = fragment('<span>text</span>');

    expect(() => {
      normalizeInline(tree);
    }).toThrow('expected: block element; got: span');
  });
});

describe('unwrapSubstitute', () => {
  it('substitutes elements with their contents', () => {
    const xml1 =
      '<root xmlns:ac="http://atlassian.com/content"><p>' +
      'Lorem <mark>ipsum</mark> dolor sit amet, ' +
      '<mark><em>consectetur</em> adipiscing elit</mark>, ' +
      'sed do eiusmod tempor incididunt ut <mark><b>labore</b> et <b>dolore</b></mark> ' +
      '<mark>magna <em>aliqua</em></mark>.' +
      '</p></root>';
    const xml2 =
      '<root xmlns:ac="http://atlassian.com/content"><p>' +
      'Lorem ipsum dolor sit amet, <em>consectetur</em> adipiscing elit, ' +
      'sed do eiusmod tempor incididunt ut <b>labore</b> et <b>dolore</b> magna <em>aliqua</em>.' +
      '</p></root>';

    const tree1 = elementsFromString(xml1);
    unwrapSubstitute('mark', tree1);
    const tree2 = elementsFromString(xml2);

    assertXmlEqual(tree1, tree2);
  });
});

describe('entities', () => {
  it('resolves named entities', () => {
    const paragraph = fragment('<p>a&nbsp;b &copy; c</p>');

    expect(paragraph.textContent).toBe('a\u00a0b \u00a9 c');
  });

  it('keeps the entity definitions of XML itself untouched', () => {
    const paragraph = fragment('<p>&amp;&lt;&gt;&quot;&apos;</p>');

    expect(paragraph.textContent).toBe('&<>"\'');
  });

  it('rejects an undefined entity', () => {
    expect(() => {
      elementsFromString('<p>&nbspx;</p>');
    }).toThrow(ParseError);
  });

  it('rejects an ampersand that starts no reference', () => {
    expect(() => {
      elementsFromString('<p>a & b</p>');
    }).toThrow(ParseError);
  });

  it('takes an ampersand inside a comment or a CDATA section literally', () => {
    expect(fragment('<p>a &amp; b<!-- c & d --></p>').textContent).toBe('a & b');
    expect(fragment('<p><![CDATA[a & b]]></p>').textContent).toBe('a & b');
  });
});

describe('parse errors', () => {
  it('rejects an element that is not closed', () => {
    expect(() => {
      elementsFromString('<p>to be<br>or not to be</p>');
    }).toThrow(ParseError);
  });

  it('rejects mismatched tags', () => {
    expect(() => {
      elementsFromString('<p><b>to be</p></b>');
    }).toThrow(ParseError);
  });

  it('rejects an undeclared namespace prefix', () => {
    expect(() => {
      elementsFromString('<p><ns:name>to be</ns:name></p>');
    }).toThrow(ParseError);
  });
});

describe('elementsToString', () => {
  it('returns the content of the root element', () => {
    expect(elementsToString(elementsFromString('<p>to be</p><p>or not</p>'))).toBe(
      '<p>to be</p><p>or not</p>',
    );
  });

  it('keeps the namespace prefixes of Confluence elements', () => {
    expect(
      elementsToString(elementsFromString('<ac:link ac:card-appearance="block">x</ac:link>')),
    ).toBe('<ac:link ac:card-appearance="block">x</ac:link>');
  });
});

describe('contentToString', () => {
  it('returns a Confluence Storage Format document as XML', () => {
    expect(contentToString('<p>to be</p>')).toBe(
      `<root xmlns:ac="http://atlassian.com/content" xmlns:ri="http://atlassian.com/resource/identifier"><p>to be</p></root>`,
    );
  });
});

describe('elementToText', () => {
  it('concatenates the text of an element and its descendants', () => {
    expect(elementToText(fragment('<p>a<b>x</b>tail<i>y</i></p>'))).toBe('axtaily');
  });

  it('counts characters outside the basic multilingual plane once', () => {
    const root = elementsFromString('<p><mark>a😀b</mark></p>');

    expect(getElementSpans('mark', root).map((span) => [span.start, span.end])).toEqual([[0, 3]]);
  });
});

describe('removeElement', () => {
  it('keeps the text that follows the element', () => {
    const tree = elementsFromString('<p>one</p><p>two</p>three');
    const second = childAt(tree, 1);

    removeElement(second);

    expect(elementsToString(tree)).toBe('<p>one</p>three');
  });

  it('keeps the text that follows the first element', () => {
    const tree = elementsFromString('zero<p>one</p>two');
    const first = childAt(tree, 0);

    removeElement(first);

    expect(elementsToString(tree)).toBe('zerotwo');
  });
});

describe('WrapVisitor', () => {
  it('wraps a range of text in an element', () => {
    const tree = elementsFromString('<p>to be, or not to be</p>');
    const document = ownerDocument(tree);
    const visitor = new WrapVisitor(3, 7, (text) => {
      const elem = document.createElement('mark');
      elem.appendChild(document.createTextNode(text));
      return elem;
    });

    expect(visitor.visit(tree)).toBe(true);
    expect(elementsToString(tree)).toBe('<p>to <mark>be, </mark>or not to be</p>');
  });

  it('reports that nothing was wrapped when the range is empty', () => {
    const tree = elementsFromString('<p>to be</p>');
    const document = ownerDocument(tree);
    const visitor = new WrapVisitor(10, 12, (text) => {
      const elem = document.createElement('mark');
      elem.appendChild(document.createTextNode(text));
      return elem;
    });

    expect(visitor.visit(tree)).toBe(false);
    expect(elementsToString(tree)).toBe('<p>to be</p>');
  });
});

describe('getElementSpans', () => {
  it('locates the occurrences of a tag among the descendants of an element', () => {
    const root = elementsFromString('<p>Lorem <mark>ipsum</mark> dolor <mark>dolor</mark> sit</p>');

    expect(getElementSpans('mark', root).map((span) => [span.start, span.end])).toEqual([
      [6, 11],
      [18, 23],
    ]);
  });
});

describe('canonicalize', () => {
  it('normalizes whitespace between elements', () => {
    expect(canonicalize('<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>')).toBe(
      '<ul><li>one</li><li>two</li></ul>',
    );
  });

  it('replaces a linefeed with a space inside a paragraph', () => {
    expect(canonicalize('<p>to\nbe</p>')).toBe('<p>to be</p>');
  });

  it('keeps the linefeed inside a preformatted element', () => {
    expect(canonicalize('<pre>to\nbe</pre>')).toBe('<pre>to\nbe</pre>');
  });

  it('is idempotent', () => {
    const content =
      '<p>to be, or not to be</p>\n<ac:structured-macro ac:name="info">\n  <ac:rich-text-body>\n    <p>to be</p>\n  </ac:rich-text-body>\n</ac:structured-macro>\n<pre>  keep  </pre>';
    const once = canonicalize(content);

    expect(canonicalize(once)).toBe(once);
  });
});
