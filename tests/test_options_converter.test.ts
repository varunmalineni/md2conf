// Port of md2conf/options_converter.py. Upstream has no tests of its own for this module;
// these cover the MVP defaults and the layout precedence its users rely on.

import { describe, expect, it } from 'vitest';

import {
  ConverterOptions,
  ImageLayoutOptions,
  LayoutOptions,
  TableLayoutOptions,
} from '../src/options_converter.js';

describe('ConverterOptions defaults', () => {
  it('matches the defaults upstream declares for MVP features', () => {
    const options = new ConverterOptions();

    expect(options.headingAnchors).toBe(false);
    expect(options.forceValidUrl).toBe(true);
    expect(options.skipTitleHeading).toBe(false);
    expect(options.preferRaster).toBe(true);
    expect(options.renderMermaid).toBe(true);
    expect(options.diagramOutputFormat).toBe('png');
    expect(options.taskLists).toBe(true);
    expect(options.usePanel).toBe(false);
    expect(options.forceValidLanguage).toBe(true);
    expect(options.layout).toBeInstanceOf(LayoutOptions);
    expect(options.layout.image.alignment).toBeUndefined();
    expect(options.layout.image.maxWidth).toBeUndefined();
    expect(options.layout.table.width).toBeUndefined();
    expect(options.layout.table.displayMode).toBe('responsive');
    expect(options.layout.alignment).toBeUndefined();
  });
});

describe('LayoutOptions.getImageAlignment', () => {
  it('falls back to center', () => {
    expect(new LayoutOptions().getImageAlignment()).toBe('center');
  });

  it('uses the default alignment when no image alignment is set', () => {
    const layout = new LayoutOptions(new ImageLayoutOptions(), new TableLayoutOptions(), 'right');

    expect(layout.getImageAlignment()).toBe('right');
  });

  it('prefers the image alignment over the default alignment', () => {
    const layout = new LayoutOptions(
      new ImageLayoutOptions('left'),
      new TableLayoutOptions(),
      'right',
    );

    expect(layout.getImageAlignment()).toBe('left');
  });
});
