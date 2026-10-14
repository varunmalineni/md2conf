// Port of md2conf/environment.py from hunyadi/md2conf (MIT; see NOTICE.md).

/* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- upstream reads
   `argument or os.getenv(name)`, which is Python truthiness: an empty argument
   falls back to the environment. `??` would keep the empty string instead. */

// Upstream's `api_version` property and the `CONFLUENCE_API_VERSION` environment
// variable are left out: REST v1 is not part of the MVP. See ADR 0007.

/** Raised when wrong arguments are passed to a function call. */
export class ArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgumentError';
  }
}

/** Raised in case there is an issue with a Confluence page. */
export class PageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageError';
  }
}

/** Raised when a Confluence API call fails. */
export class ConfluenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfluenceError';
  }
}

function validateDomain(domain: string): string;
function validateDomain(domain: string | undefined): string | undefined;
function validateDomain(domain: string | undefined): string | undefined {
  if (domain === undefined) {
    return undefined;
  }

  if (domain.startsWith('http://') || domain.startsWith('https://') || domain.endsWith('/')) {
    throw new ArgumentError('Confluence domain looks like a URL; only host name required');
  }

  return domain;
}

function validateBasePath(basePath: string): string;
function validateBasePath(basePath: string | undefined): string | undefined;
function validateBasePath(basePath: string | undefined): string | undefined {
  if (basePath === undefined) {
    return undefined;
  }

  if (!basePath.startsWith('/') || !basePath.endsWith('/')) {
    throw new ArgumentError("Confluence base path must start and end with a '/'");
  }

  return basePath;
}

/**
 * Properties related to a Confluence site.
 *
 * @param domain Domain name for Confluence site, e.g. `markdown-to-confluence.atlassian.net`.
 * @param basePath Base path for Confluence site, e.g. `/wiki/`.
 * @param spaceKey Confluence space key for pages to be published.
 */
export class ConfluenceSiteProperties {
  readonly domain: string;
  readonly basePath: string;
  readonly spaceKey: string | undefined;

  constructor(domain?: string, basePath?: string, spaceKey?: string) {
    const optDomain = domain || process.env.CONFLUENCE_DOMAIN;
    const optBasePath = basePath || process.env.CONFLUENCE_PATH;
    const optSpaceKey = spaceKey || process.env.CONFLUENCE_SPACE_KEY;

    if (!optDomain) {
      throw new ArgumentError('Confluence domain not specified');
    }
    const resolvedBasePath = optBasePath || '/wiki/';

    this.domain = validateDomain(optDomain);
    this.basePath = validateBasePath(resolvedBasePath);
    this.spaceKey = optSpaceKey;
  }
}

/** Properties related to connecting to Confluence. */
export interface ConnectionPropertiesOptions {
  /** Confluence API URL. Required for scoped tokens. */
  readonly apiUrl?: string | undefined;
  /** Domain name for Confluence site, e.g. `markdown-to-confluence.atlassian.net`. */
  readonly domain?: string | undefined;
  /** Base path for Confluence site, e.g. `/wiki/`. */
  readonly basePath?: string | undefined;
  /** Confluence user name. */
  readonly userName?: string | undefined;
  /** Confluence API key. */
  readonly apiKey?: string | undefined;
  /** Confluence space key for pages to be published. */
  readonly spaceKey?: string | undefined;
}

/**
 * Properties related to connecting to Confluence.
 *
 * Every property falls back to the environment variable with the same meaning;
 * an argument that is given on the command line wins over the environment.
 */
export class ConnectionProperties {
  readonly apiUrl: string | undefined;
  readonly domain: string | undefined;
  readonly basePath: string | undefined;
  readonly spaceKey: string | undefined;
  readonly userName: string | undefined;
  readonly apiKey: string;

  constructor(options: ConnectionPropertiesOptions = {}) {
    const optApiUrl = options.apiUrl || process.env.CONFLUENCE_API_URL;
    const optDomain = options.domain || process.env.CONFLUENCE_DOMAIN;
    const optBasePath = options.basePath || process.env.CONFLUENCE_PATH;
    const optSpaceKey = options.spaceKey || process.env.CONFLUENCE_SPACE_KEY;
    const optUserName = options.userName || process.env.CONFLUENCE_USER_NAME;
    const optApiKey = options.apiKey || process.env.CONFLUENCE_API_KEY;

    if (!optApiKey) {
      throw new ArgumentError('Confluence API key not specified');
    }
    if (!optApiUrl && !optDomain) {
      throw new ArgumentError('Confluence API URL or domain required');
    }
    const resolvedBasePath = !optApiUrl && !optBasePath ? '/wiki/' : optBasePath;

    this.apiUrl = optApiUrl;
    this.domain = validateDomain(optDomain);
    this.basePath = validateBasePath(resolvedBasePath);
    this.spaceKey = optSpaceKey;
    this.userName = optUserName;
    this.apiKey = optApiKey;
  }
}
