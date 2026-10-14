// Port of md2conf/coalesce.py (`coalesce_dataclass`).

import { describe, expect, it } from 'vitest';

import { coalesceDataclass } from '../src/coalesce.js';
import { ImageLayoutOptions, LayoutOptions, TableLayoutOptions } from '../src/options_converter.js';

class Properties {
  title: string | undefined;
  tags: string[] | undefined;
  layout: LayoutOptions | undefined;

  constructor(init?: { title?: string; tags?: string[]; layout?: LayoutOptions }) {
    this.title = init?.title;
    this.tags = init?.tags;
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

  it('leaves the arguments unchanged', () => {
    const target = new Properties();
    const source = new Properties({ title: 'Source' });

    coalesceDataclass(target, source);

    expect(target.title).toBeUndefined();
    expect(source.title).toBe('Source');
  });
});
