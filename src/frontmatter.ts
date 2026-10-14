// Port of md2conf/frontmatter.py from hunyadi/md2conf (MIT; see NOTICE.md).

import { parse as parseYaml } from 'yaml';

/**
 * A JSON value. Upstream declares this type in `serializer.py`, which ADR 0006
 * replaces with zod schemas in `api_types.ts`; it lives here because the
 * front-matter parser is its first user.
 */
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;

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

const FRONTMATTER_REGEXP = /^---\n(.+?)^---(?:\n|$)/ms;
const FRONTMATTER_COMMENT_REGEXP = /^<!--\n(.+?)^-->(?:\n|$)/ms;

/** Extracts the front-matter from a blob of unparsed text into a structured object. */
function extractFrontmatterBlock(
  expr: RegExp,
  text: string,
): [FrontMatterProperties | null, string] {
  const [block, remaining] = extractValue(expr, text);

  let properties: FrontMatterProperties | null = null;
  if (block !== null) {
    const data: unknown = parseYaml(block);
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
