// Port of md2conf/metadata.py from hunyadi/md2conf (MIT; see NOTICE.md).

/**
 * Data associated with a Confluence wiki site.
 *
 * @param domain Confluence organization domain (e.g. `levente-hunyadi.atlassian.net`).
 * @param basePath Base path for Confluence (default: `/wiki/`).
 * @param spaceKey Confluence space key for new pages (e.g. `~hunyadi` or `INST`).
 */
export class ConfluenceSiteMetadata {
  constructor(
    readonly domain: string,
    readonly basePath: string,
    readonly spaceKey: string | undefined,
  ) {}
}

/**
 * Data associated with a Confluence page.
 *
 * @param pageId Confluence page ID.
 * @param spaceKey Confluence space key.
 * @param title Document title.
 * @param synchronized True if the document content is parsed and synchronized with Confluence.
 */
export class ConfluencePageMetadata {
  constructor(
    readonly pageId: string,
    readonly spaceKey: string,
    readonly title: string,
    readonly synchronized: boolean,
  ) {}
}
