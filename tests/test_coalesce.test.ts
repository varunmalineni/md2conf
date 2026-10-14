// Port of md2conf/coalesce.py (`coalesce_dataclass`).

import { describe, expect, it } from 'vitest';

import { coalesceDataclass } from '../src/coalesce.js';
import { ImageLayoutOptions, LayoutOptions, TableLayoutOptions } from '../src/options_converter.js';

class Properties {
  title: string | undefined;
  tags: string[] | undefined;
  properties: Record<string, string> | undefined;
  layout: LayoutOptions | undefined;

  constructor(init?: {
    title?: string;
    tags?: string[];
    properties?: Record<string, string>;
    layout?: LayoutOptions;
  }) {
    this.title = init?.title;
    this.tags = init?.tags;
    this.properties = init?.properties;
    this.layout = init?.layout;
  }
}

describe('coalesceDataclass', () => {
  it('takes the value of a field the target has not set', () => {
    const target = new Properties({ title: 'Target' });
    const source = new Properties({ title: 'Source', tags: ['a'] });

    const result = coalesceDataclass(target, source);

    expect(result.title).toBe('Target');
    expect(result.tags).toEqual(['a']);
  });

  it('leaves a field unset when neither class sets it', () => {
    const result = coalesceDataclass(new Properties(), new Properties({ tags: ['a'] }));

    expect(result.title).toBeUndefined();
  });

  it('merges data-class fields recursively', () => {
    const target = new Properties({
      layout: new LayoutOptions(undefined, new TableLayoutOptions(640)),
    });
    const source = new Properties({
      layout: new LayoutOptions(new ImageLayoutOptions('left'), undefined, 'right'),
    });

    const result = coalesceDataclass(target, source);

    expect(result.layout?.table.width).toBe(640);
    expect(result.layout?.image.alignment).toBe('left');
    expect(result.layout?.alignment).toBe('right');
  });

  it('returns an instance of the same class, with its methods', () => {
    const result = coalesceDataclass(
      new Properties({ layout: new LayoutOptions() }),
      new Properties({ layout: new LayoutOptions(undefined, undefined, 'left') }),
    );

    expect(result).toBeInstanceOf(Properties);
    expect(result.layout).toBeInstanceOf(LayoutOptions);
    expect(result.layout?.getImageAlignment()).toBe('left');
  });

  it('copies a value taken from the source, so the result shares nothing with it', () => {
    const target = new Properties();
    const source = new Properties({
      tags: ['a'],
      properties: { 'content-appearance-published': 'full-width' },
      layout: new LayoutOptions(new ImageLayoutOptions('left')),
    });

    const result = coalesceDataclass(target, source);

    expect(result.tags).not.toBe(source.tags);
    expect(result.properties).not.toBe(source.properties);
    expect(result.layout).not.toBe(source.layout);
    expect(result.layout?.image).not.toBe(source.layout?.image);
    expect(result.properties).toEqual({ 'content-appearance-published': 'full-width' });
  });

  it('replaces a mapping field rather than merging it key by key', () => {
    const target = new Properties({ properties: { kept: 'target' } });
    const source = new Properties({ properties: { kept: 'source', added: 'source' } });

    const result = coalesceDataclass(target, source);

    expect(result.properties).toEqual({ kept: 'target' });
  });

  it('leaves the arguments unchanged', () => {
    const target = new Properties();
    const source = new Properties({ title: 'Source' });

    coalesceDataclass(target, source);

    expect(target.title).toBeUndefined();
    expect(source.title).toBe('Source');
  });
});
