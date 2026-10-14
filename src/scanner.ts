// Port of md2conf/scanner.py from hunyadi/md2conf (MIT; see NOTICE.md).

import { readFileSync, type PathLike } from 'node:fs';

import { coalesceDataclass } from './coalesce.js';
import {
  type JsonObject,
  type JsonValue,
  extractFrontmatterJson,
  extractValue,
} from './frontmatter.js';
import {
  ImageLayoutOptions,
  LayoutOptions,
  TableLayoutOptions,
  type ContentAlignment,
  type TableDisplayMode,
} from './options_converter.js';

/**
 * An object that holds properties extracted from the front-matter of a Markdown document.
 *
 * @param confluencePageId Confluence page ID. (Alternative name for JSON de-serialization.)
 * @param confluenceSpaceKey Confluence space key. (Alternative name for JSON de-serialization.)
 */
export class AliasProperties {
  confluencePageId: string | undefined = undefined;
  confluenceSpaceKey: string | undefined = undefined;
}

/**
 * An object that holds properties extracted from the front-matter of a Markdown document.
 *
 * @param pageId Confluence page ID.
 * @param spaceKey Confluence space key.
 * @param generatedBy Text identifying the tool that generated the document.
 * @param title The title extracted from front-matter.
 * @param tags A list of tags (content labels) extracted from front-matter.
 * @param synchronized True if the document content is parsed and synchronized with Confluence.
 * @param properties A dictionary of key-value pairs extracted from front-matter to apply as page properties.
 * @param layout Layout options for content on a Confluence page.
 */
export class DocumentProperties {
  pageId: string | undefined = undefined;
  spaceKey: string | undefined = undefined;
  generatedBy: string | undefined = undefined;
  title: string | undefined = undefined;
  tags: string[] | undefined = undefined;
  synchronized: boolean | undefined = undefined;
  properties: JsonObject | undefined = undefined;
  layout: LayoutOptions | undefined = undefined;
}

/**
 * An object that holds properties extracted from a Markdown document, including remaining source text.
 *
 * @param properties Properties extracted from the front-matter of a Markdown document.
 * @param text Text that remains after front-matter and inline properties have been extracted.
 * @param startLineNumber The first line of the Markdown document excluding front-matter, or 1 if there is no front-matter.
 */
export class ScannedDocument {
  constructor(
    readonly properties: DocumentProperties,
    readonly text: string,
    readonly startLineNumber: number,
  ) {}
}

const PAGE_ID_REGEXP = /<!--\s+confluence[-_]page[-_]id:\s*(\d+)\s+-->/;
const FOLDER_ID_REGEXP = /<!--\s+confluence[-_]folder[-_]id:\s*(\S+)\s+-->/;
const SPACE_KEY_REGEXP = /<!--\s+confluence[-_]space[-_]key:\s*(\S+)\s+-->/;
const GENERATED_BY_REGEXP = /<!--\s+generated[-_]by:\s*(.*)\s+-->/;

const DOCUMENT_PROPERTY_KEYS = new Set([
  'page_id',
  'space_key',
  'generated_by',
  'title',
  'tags',
  'synchronized',
  'properties',
  'layout',
  'confluence_page_id',
  'confluence_space_key',
]);

function asRecord(value: JsonValue, key: string): JsonObject {
  if (!isMapping(value)) {
    throw new TypeError(`front-matter key "${key}" must hold a set of key-value pairs`);
  }
  return value;
}

function isMapping(value: JsonValue): value is JsonObject {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

/** Formats a value the way Python's `str()` formats the date and datetime PyYAML resolves to. */
function formatDate(value: Date): string {
  const iso = value.toISOString();
  return iso.endsWith('T00:00:00.000Z')
    ? iso.slice(0, 10) // str(date)
    : `${iso.slice(0, 19).replace('T', ' ')}+00:00`; // str(datetime) at UTC
}

/**
 * Coerces a front-matter scalar to a string, as cattrs structures a `str` field: `page_id:
 * 12345` is the page ID 12345, not an error. Upstream builds the string with Python's
 * `str()`, which writes a boolean as `True`; a boolean reads as `true` here (ADR 0007).
 */
function scalarToString(value: JsonValue, key: string): string {
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new TypeError(`front-matter key "${key}" must be a string, a number or a boolean`);
}

function optionalString(source: JsonObject, key: string): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return scalarToString(value, key);
}

function optionalInteger(source: JsonObject, key: string): number | undefined {
  const value = source[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  // Python's `int()`: a float truncates towards zero and a boolean is 1 or 0
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string' && /^[+-]?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  throw new TypeError(`front-matter key "${key}" must be an integer`);
}

/** Python's `bool()`: an empty string, an empty collection, zero and NaN are false. */
function pythonBool(value: JsonValue): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0 && !Number.isNaN(value);
  }
  if (typeof value === 'string') {
    return value.length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value instanceof Date) {
    return true;
  }
  return value === null ? false : Object.keys(value).length > 0;
}

function optionalBoolean(source: JsonObject, key: string): boolean | undefined {
  const value = source[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return pythonBool(value);
}

function optionalTags(source: JsonObject, key: string): string[] | undefined {
  const value = source[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  // cattrs structures a list from a sequence, from the keys of a mapping, or from a single
  // string; anything else (a number, a date) is not a sequence and is an error
  if (Array.isArray(value)) {
    return value.map((tag) => scalarToString(tag, key));
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (isMapping(value)) {
    return Object.keys(value);
  }
  throw new TypeError(`front-matter key "${key}" must be a list of strings`);
}

function optionalAlignment(source: JsonObject, key: string): ContentAlignment | undefined {
  const value = source[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value !== 'center' && value !== 'left' && value !== 'right') {
    throw new TypeError(`front-matter key "${key}" must be one of center, left or right`);
  }
  return value;
}

function optionalDisplayMode(source: JsonObject, key: string): TableDisplayMode {
  const value = source[key];
  if (value === undefined || value === null) {
    return 'responsive';
  }
  if (value !== 'responsive' && value !== 'fixed') {
    throw new TypeError(`front-matter key "${key}" must be one of responsive or fixed`);
  }
  return value;
}

function imageLayoutOptionsFromJson(value: JsonValue): ImageLayoutOptions {
  const source = asRecord(value, 'image');
  return new ImageLayoutOptions(
    optionalAlignment(source, 'alignment'),
    optionalInteger(source, 'max_width'),
  );
}

function tableLayoutOptionsFromJson(value: JsonValue): TableLayoutOptions {
  const source = asRecord(value, 'table');
  return new TableLayoutOptions(
    optionalInteger(source, 'width'),
    optionalDisplayMode(source, 'display_mode'),
  );
}

function layoutOptionsFromJson(value: JsonValue): LayoutOptions {
  const source = asRecord(value, 'layout');
  const image = source.image;
  const table = source.table;
  return new LayoutOptions(
    image === undefined || image === null
      ? new ImageLayoutOptions()
      : imageLayoutOptionsFromJson(image),
    table === undefined || table === null
      ? new TableLayoutOptions()
      : tableLayoutOptionsFromJson(table),
    optionalAlignment(source, 'alignment'),
  );
}

function aliasPropertiesFromJson(data: JsonObject): AliasProperties {
  const props = new AliasProperties();
  props.confluencePageId = optionalString(data, 'confluence_page_id');
  props.confluenceSpaceKey = optionalString(data, 'confluence_space_key');
  return props;
}

function documentPropertiesFromJson(data: JsonObject): DocumentProperties {
  const props = new DocumentProperties();
  props.pageId = optionalString(data, 'page_id');
  props.spaceKey = optionalString(data, 'space_key');
  props.generatedBy = optionalString(data, 'generated_by');
  props.title = optionalString(data, 'title');
  props.tags = optionalTags(data, 'tags');
  props.synchronized = optionalBoolean(data, 'synchronized');
  props.properties =
    data.properties === undefined || data.properties === null
      ? undefined
      : asRecord(data.properties, 'properties');
  props.layout =
    data.layout === undefined || data.layout === null
      ? undefined
      : layoutOptionsFromJson(data.layout);

  for (const key of Object.keys(data)) {
    if (!DOCUMENT_PROPERTY_KEYS.has(key)) {
      // Keys of post-MVP features (`folder_id` and `content_type` for Confluence folders, for
      // one) and keys we do not know are ignored: a document that is not fully supported yet
      // still scans.
      console.debug(`ignoring front-matter key "${key}"`);
    }
  }

  return props;
}

export class Scanner {
  /** Extracts essential properties from a Markdown document. */
  read(absolutePath: PathLike): ScannedDocument {
    const text = readFileSync(absolutePath, 'utf8');
    return this.parse(text);
  }

  /** Extracts essential properties from a Markdown document. */
  parse(text: string): ScannedDocument {
    // extract Confluence page ID
    const [pageId, afterPageId] = extractValue(PAGE_ID_REGEXP, text);

    // extract Confluence folder ID; Confluence folders are post-MVP, so the comment is taken
    // out of the document but no property is set
    const [folderId, afterFolderId] = extractValue(FOLDER_ID_REGEXP, afterPageId);
    if (folderId !== null) {
      console.debug('ignoring Confluence folder ID comment; folders are not supported');
    }

    // extract Confluence space key
    const [spaceKey, afterSpaceKey] = extractValue(SPACE_KEY_REGEXP, afterFolderId);

    // extract 'generated-by' tag text
    const [generatedBy, body] = extractValue(GENERATED_BY_REGEXP, afterSpaceKey);

    const bodyProps = new DocumentProperties();
    bodyProps.pageId = pageId ?? undefined;
    bodyProps.spaceKey = spaceKey ?? undefined;
    bodyProps.generatedBy = generatedBy ?? undefined;

    // extract front-matter; a block that is not a mapping is dropped from the document and
    // yields no properties, as upstream does
    const [frontmatter, remaining] = extractFrontmatterJson(body);
    if (frontmatter === null) {
      return new ScannedDocument(bodyProps, remaining, 1);
    }

    const frontmatterProps = documentPropertiesFromJson(frontmatter.data);
    const aliasProps = aliasPropertiesFromJson(frontmatter.data);
    if (aliasProps.confluencePageId !== undefined) {
      frontmatterProps.pageId = aliasProps.confluencePageId;
    }
    if (aliasProps.confluenceSpaceKey !== undefined) {
      frontmatterProps.spaceKey = aliasProps.confluenceSpaceKey;
    }

    return new ScannedDocument(
      coalesceDataclass(bodyProps, frontmatterProps),
      remaining,
      frontmatter.outerLineCount + 1,
    );
  }
}
