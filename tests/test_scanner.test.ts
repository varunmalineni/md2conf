// Port of the upstream tests/test_scanner.py. Tests for post-MVP features (Confluence
// folders, Mermaid front-matter) are not ported; see ADR 0007.

import { describe, expect, it, vi } from 'vitest';
import { Scanner } from '../src/scanner.js';

const idOnly = `# Title

Text

<!-- confluence-page-id: 1234 -->
`;

const idSpaceTitle = `---
{ "title": "🏠 árvíztűrő tükörfúrógép" }
---

<!-- confluence-page-id: 1234567 -->
<!-- confluence-space-key: ~hunyadi -->

# Title

Text
`;

const blankDocumentFrontmatter = `---
title: "Blank document"
---`;

const folderFrontmatter = `---
title: Product Guides
content_type: folder
folder_id: "7654321"
---
`;

const folderComment = `---
title: Product Guides
content_type: folder
---
<!-- confluence-folder-id: FOLDER_7654321 -->
`;

const commentFrontmatter = `<!--
title: 🏠 árvíztűrő tükörfúrógép
-->

Text
`;

describe('Scanner tag', () => {
  it('extracts the page ID comment and nothing else', () => {
    const document = new Scanner().parse(idOnly);
    const props = document.properties;
    expect(props.pageId).toBe('1234');
    expect(props.spaceKey).toBeUndefined();
    expect(props.title).toBeUndefined();
    expect(document.startLineNumber).toBe(1);
  });
});

describe('Scanner front-matter', () => {
  it('reads JSON front-matter next to page ID and space key comments', () => {
    const document = new Scanner().parse(idSpaceTitle);
    const props = document.properties;
    expect(props.pageId).toBe('1234567');
    expect(props.spaceKey).toBe('~hunyadi');
    expect(props.title).toBe('🏠 árvíztűrő tükörfúrógép');
    expect(document.text).not.toContain('confluence-page-id');
    expect(document.text).not.toContain('confluence-space-key');
    expect(document.text.trim()).toBe('# Title\n\nText');
    expect(document.startLineNumber).toBe(4);
  });

  it('reads a blank document with front-matter only', () => {
    const document = new Scanner().parse(blankDocumentFrontmatter);
    const props = document.properties;
    expect(props.title).toBe('Blank document');
    expect(document.text).toBe('');
    expect(document.startLineNumber).toBe(4);
  });

  it('reads front-matter delimited by an HTML comment', () => {
    const document = new Scanner().parse(commentFrontmatter);
    const props = document.properties;
    expect(props.title).toBe('🏠 árvíztűrő tükörfúrógép');
    expect(document.text).toBe('\nText\n');
    expect(document.startLineNumber).toBe(4);
  });

  it('reads YAML front-matter from a file', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    try {
      const document = new Scanner().read(new URL('./scanner/frontmatter.md', import.meta.url));
      const props = document.properties;
      expect(props.pageId).toBe('19840101');
      expect(props.spaceKey).toBeUndefined();
      expect(props.generatedBy).toBe('This page has been generated with md2conf.');
      expect(props.title).toBe('Markdown example document');
      expect(props.tags).toEqual(['markdown', 'confluence', 'md', 'wiki']);
      expect(props.properties).toEqual({
        'content-appearance-published': 'full-width',
        'content-appearance-draft': 'full-width',
      });
      expect(document.text).not.toContain('generated-by');
      expect(document.text.trim()).toBe('# Title\n\nText');
      expect(document.startLineNumber).toBe(16);
    } finally {
      debug.mockRestore();
    }
  });

  it('reads the synchronized flag and page properties', () => {
    const document = new Scanner().parse(`---
title: Page
synchronized: true
properties:
  content-appearance-published: full-width
---
`);
    const props = document.properties;
    expect(props.synchronized).toBe(true);
    expect(props.properties).toEqual({ 'content-appearance-published': 'full-width' });
  });

  it('prefers the confluence_page_id and confluence_space_key aliases', () => {
    const document = new Scanner().parse(`---
page_id: "1"
confluence_page_id: "2"
space_key: ONE
confluence_space_key: TWO
---
`);
    const props = document.properties;
    expect(props.pageId).toBe('2');
    expect(props.spaceKey).toBe('TWO');
  });

  it('rejects a front-matter value of the wrong type', () => {
    expect(() => new Scanner().parse('---\ntags: markdown\n---\n')).toThrow(TypeError);
  });
});

describe('Scanner layout front-matter', () => {
  it('reads the default alignment (tests/source/alignment.md)', () => {
    const document = new Scanner().parse(`---
title: Alignment
layout:
  alignment: left
---
`);
    const layout = document.properties.layout;
    expect(layout?.alignment).toBe('left');
    expect(layout?.image.alignment).toBeUndefined();
    expect(layout?.table.displayMode).toBe('responsive');
    expect(layout?.getImageAlignment()).toBe('left');
  });

  it('reads the image alignment (tests/source/images.md)', () => {
    const document = new Scanner().parse(`---
title: Images
layout:
  image:
    alignment: left
---
`);
    const layout = document.properties.layout;
    expect(layout?.image.alignment).toBe('left');
    expect(layout?.getImageAlignment()).toBe('left');
  });

  it('reads the table width (tests/source/table.md)', () => {
    const document = new Scanner().parse(`---
title: Table
layout:
  table:
    width: 640
---
`);
    const layout = document.properties.layout;
    expect(layout?.table.width).toBe(640);
    expect(layout?.table.displayMode).toBe('responsive');
    expect(layout?.getImageAlignment()).toBe('center');
  });

  it('reads the table display mode', () => {
    const document = new Scanner().parse(`---
title: Table
layout:
  table:
    display_mode: fixed
---
`);
    expect(document.properties.layout?.table.displayMode).toBe('fixed');
  });

  it('rejects an unsupported alignment', () => {
    expect(() => new Scanner().parse('---\nlayout:\n  alignment: middle\n---\n')).toThrow(
      TypeError,
    );
  });
});

describe('Scanner post-MVP properties', () => {
  it('ignores Confluence folder front-matter keys and logs them', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    try {
      const document = new Scanner().parse(folderFrontmatter);
      const props = document.properties;
      expect(props.title).toBe('Product Guides');
      expect(document.text.trim()).toBe('');
      expect(debug).toHaveBeenCalledWith('ignoring front-matter key "content_type"');
      expect(debug).toHaveBeenCalledWith('ignoring front-matter key "folder_id"');
    } finally {
      debug.mockRestore();
    }
  });

  it('removes the Confluence folder ID comment and logs it', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    try {
      const document = new Scanner().parse(folderComment);
      expect(document.text.trim()).toBe('');
      expect(document.text).not.toContain('confluence-folder-id');
      expect(debug).toHaveBeenCalledWith(
        'ignoring Confluence folder ID comment; folders are not supported',
      );
    } finally {
      debug.mockRestore();
    }
  });

  it('ignores an unknown front-matter key and logs it', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    try {
      const document = new Scanner().parse(`---
title: Page
description: an abstract
---
`);
      expect(document.properties.title).toBe('Page');
      expect(debug).toHaveBeenCalledWith('ignoring front-matter key "description"');
    } finally {
      debug.mockRestore();
    }
  });
});
