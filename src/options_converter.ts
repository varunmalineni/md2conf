// Port of md2conf/options_converter.py from hunyadi/md2conf (MIT; see NOTICE.md).
//
// Options for post-MVP features (draw.io, PlantUML and LaTeX rendering, Marketplace
// extensions, Confluence Web UI links, user mentions) are added when those features
// land; see ADR 0007.
//
// Upstream declares these as mutable data classes: the converter replaces
// `converter_options.layout` with the one from front-matter.

import {
  booleanOption,
  compositeOption,
  type ArgumentOption,
  type OptionValueType,
  valueOption,
} from './clio.js';

/** Alignment for block-level content. */
export type ContentAlignment = 'center' | 'left' | 'right';

/** Whether to use fixed or responsive column widths. */
export type TableDisplayMode = 'responsive' | 'fixed';

/** Target image format for diagrams. */
export type DiagramOutputFormat = 'png' | 'svg';

/**
 * Upstream declares `Literal["center", "left", "right", None]`; the `None` member
 * is the absence of a value and cannot be spelled on a command line, so the
 * command line offers the three alignment names, as it does upstream in practice.
 */
const contentAlignment: OptionValueType = {
  type: 'choice',
  choices: ['center', 'left', 'right'],
};

/**
 * Image layout options on a Confluence page.
 *
 * @param alignment Alignment for block-level images and formulas.
 * @param maxWidth Maximum display width for images [px]. Wider images are scaled down for page display. Original size kept for full-size viewing.
 */
export class ImageLayoutOptions {
  static readonly fields: readonly ArgumentOption[] = [
    valueOption('alignment', contentAlignment, 'Alignment for block-level images and formulas.'),
    valueOption(
      'maxWidth',
      { type: 'integer' },
      'Maximum display width for images [px]. Wider images are scaled down for page display.',
    ),
  ];

  constructor(
    public alignment?: ContentAlignment,
    public maxWidth?: number,
  ) {}
}

/**
 * Table layout options on a Confluence page.
 *
 * @param width Maximum table width in pixels.
 * @param displayMode Whether to use fixed or responsive column widths.
 */
export class TableLayoutOptions {
  static readonly fields: readonly ArgumentOption[] = [
    valueOption('width', { type: 'integer' }, 'Maximum table width in pixels.'),
    valueOption(
      'displayMode',
      {
        type: 'choice',
        choices: ['responsive', 'fixed'],
      },
      'Set table display mode.',
    ),
  ];

  constructor(
    public width?: number,
    public displayMode: TableDisplayMode = 'responsive',
  ) {}
}

/**
 * Layout options for content on a Confluence page.
 *
 * Layout options can be overridden in Markdown front-matter.
 *
 * @param image Image layout options.
 * @param table Table layout options.
 * @param alignment Default alignment (unless overridden with more specific setting).
 */
export class LayoutOptions {
  static readonly fields: readonly ArgumentOption[] = [
    compositeOption('image', ImageLayoutOptions),
    compositeOption('table', TableLayoutOptions),
    valueOption('alignment', contentAlignment, 'Default alignment for block-level content.'),
  ];

  constructor(
    public image: ImageLayoutOptions = new ImageLayoutOptions(),
    public table: TableLayoutOptions = new TableLayoutOptions(),
    public alignment?: ContentAlignment,
  ) {}

  getImageAlignment(): ContentAlignment {
    return this.image.alignment ?? this.alignment ?? 'center';
  }
}

/**
 * Options for converting an HTML tree into Confluence Storage Format.
 *
 * @param headingAnchors When true, emit a structured macro *anchor* for each section heading using GitHub conversion rules for the identifier.
 * @param forceValidUrl If enabled, raise an exception when relative URLs point to an invalid location. If disabled, ignore invalid URLs, emit a warning and replace the anchor with plain text.
 * @param skipTitleHeading Whether to remove the first heading from document body when used as page title.
 * @param preferRaster Whether to choose PNG files over SVG files when available.
 * @param renderMermaid Whether to pre-render Mermaid diagrams into PNG/SVG images.
 * @param diagramOutputFormat Target image format for diagrams.
 * @param taskLists When true, convert GitHub/GitLab-style task lists into Confluence task list objects.
 * @param usePanel Whether to transform admonitions and alerts into a Confluence custom panel.
 * @param forceValidLanguage When true, only allow supported languages in code blocks (unsupported languages are ignored); if disabled, use unknown language names as-is (Confluence may still highlight code).
 * @param layout Layout options for content on a Confluence page.
 */
export class ConverterOptions {
  static readonly fields: readonly ArgumentOption[] = [
    booleanOption(
      'headingAnchors',
      'Place an anchor at each section heading with GitHub-style same-page identifiers.',
      'Omit the extra anchor from section headings. (May break manually placed same-page references.)',
    ),
    booleanOption(
      'forceValidUrl',
      'Raise an error when relative URLs point to an invalid location.',
      'Emit a warning but otherwise ignore relative URLs that point to an invalid location.',
    ),
    booleanOption(
      'skipTitleHeading',
      'Remove the first heading from document body when it is used as the page title (does not apply if title comes from front-matter).',
      'Keep the first heading in document body even when used as page title.',
    ),
    booleanOption(
      'preferRaster',
      'Prefer PNG over SVG when both exist.',
      'Use SVG files directly instead of preferring PNG equivalents.',
    ),
    booleanOption(
      'renderMermaid',
      'Render Mermaid diagrams as image files. (Installed utility required to convert.)',
      'Upload Mermaid diagram sources as Confluence page attachments. (Marketplace app required to display.)',
    ),
    valueOption(
      'diagramOutputFormat',
      { type: 'choice', choices: ['png', 'svg'] },
      'Format for rendering Mermaid and draw.io diagrams.',
    ),
    booleanOption(
      'taskLists',
      'Transform GitHub/GitLab-style task lists into Confluence task list objects.',
      'Keep task lists as regular itemized lists.',
    ),
    booleanOption(
      'usePanel',
      'Transform admonitions and alerts into a Confluence custom panel.',
      'Use standard Confluence macro types for admonitions and alerts (info, tip, note and warning).',
    ),
    booleanOption(
      'forceValidLanguage',
      'Only allow supported languages in code blocks (unsupported languages are ignored)',
      'Use unknown language names as-is (Confluence may still highlight code).',
    ),
    compositeOption('layout', LayoutOptions),
  ];

  constructor(
    public headingAnchors = false,
    public forceValidUrl = true,
    public skipTitleHeading = false,
    public preferRaster = true,
    public renderMermaid = true,
    public diagramOutputFormat: DiagramOutputFormat = 'png',
    public taskLists = true,
    public usePanel = false,
    public forceValidLanguage = true,
    public layout: LayoutOptions = new LayoutOptions(),
  ) {}
}
