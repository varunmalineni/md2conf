// Port of md2conf/frontmatter.py from hunyadi/md2conf (MIT; see NOTICE.md).

import { parse as parseYaml } from 'yaml';

/**
 * A JSON value. Upstream declares this type in `serializer.py`, which ADR 0006
 * replaces with zod schemas in `api_types.ts`; it lives here because the
 * front-matter parser is its first user.
 *
 * A date is included because PyYAML's YAML 1.1 dialect resolves a bare date to a date object,
 * and upstream passes such a value through unchanged.
 */
export type JsonValue = null | boolean | number | string | Date | JsonValue[] | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

/**
 * Extracts the value captured by the first group in a regular expression.
 *
 * @returns A tuple of (1) the value extracted and (2) remaining text without the captured text.
 */
export function extractValue(expr: RegExp, text: string): [string | null, string] {
  let value: string | null = null;
  const remaining = text.replace(expr, (_match: string, captured: string | undefined) => {
    // JavaScript has no equivalent of Python's `re.Pattern.groups`, so a regular
    // expression without a capturing group is caught here instead.
    if (captured === undefined) {
      throw new Error('expected: a single group whose value to extract');
    }
    value = captured;
    return '';
  });
  return [value, remaining];
}

export class FrontMatterProperties {
  constructor(
    readonly data: JsonObject,
    readonly innerLineCount: number,
  ) {}

  get outerLineCount(): number {
    return this.innerLineCount + 2; // account for enclosing `--` (double dash)
  }
}

// No `m` flag: the leading `^` then anchors to the start of the text, as Python's `\A` does,
// and the end of the text matches only at the very end (Python's `\Z`). The closing delimiter
// is matched as the line `\n---` (Python's MULTILINE `^---`, whose `^` sits after the newline),
// so the captured block keeps that newline, which `inner_line_count` counts; `.*?` stays lazy so
// the block ends at the first closing delimiter, as Python's `.+?` does, and may be empty so a
// block whose content is a single newline still matches.
const FRONTMATTER_REGEXP = /^---\n(.*?\n)---(?:\n|$)/s;
const FRONTMATTER_COMMENT_REGEXP = /^<!--\n(.*?\n)-->(?:\n|$)/s;

// PyYAML's `safe_load` reads YAML 1.1, where `yes` is a boolean, `007` is octal and `1_000`
// is one thousand; YAML 1.2 would read all three as something else. Mapping keys stay the
// text the author wrote, because PyYAML leaves a key such as `n` alone while the `yaml`
// package reads it as a boolean.
const YAML_OPTIONS = { version: '1.1', stringKeys: true } as const;

/** Extracts the front-matter from a blob of unparsed text into a structured object. */
function extractFrontmatterBlock(
  expr: RegExp,
  text: string,
): [FrontMatterProperties | null, string] {
  const [block, remaining] = extractValue(expr, text);

  let properties: FrontMatterProperties | null = null;
  if (block !== null) {
    const data: unknown = parseYaml(block, YAML_OPTIONS);
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      properties = new FrontMatterProperties(data as JsonObject, block.split('\n').length - 1);
    }
  }

  return [properties, remaining];
}

/** Extracts the front-matter from a Markdown document into a structured object. */
export function extractFrontmatterJson(text: string): [FrontMatterProperties | null, string] {
  let [block, remaining] = extractFrontmatterBlock(FRONTMATTER_REGEXP, text);
  if (block === null) {
    [block, remaining] = extractFrontmatterBlock(FRONTMATTER_COMMENT_REGEXP, remaining);
  }
  return [block, remaining];
}
