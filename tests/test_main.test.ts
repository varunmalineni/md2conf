// Port of the command-line tests of md2conf/__main__.py and md2conf/environment.py
// from hunyadi/md2conf (MIT; see NOTICE.md). Upstream has no test module for
// either file, so these follow upstream's own `tests/test_clio.py` shape:
// drive the parser, then check what the command line did.

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OptionsType } from '../src/clio.js';
import {
  ArgumentError,
  ConfluenceError,
  ConfluenceSiteProperties,
  ConnectionProperties,
  PageError,
} from '../src/environment.js';
import { getHelp, logLevels, main, type CliOutput } from '../src/__main__.js';
import { ProcessorOptions } from '../src/options.js';
import {
  ConverterOptions,
  ImageLayoutOptions,
  LayoutOptions,
  TableLayoutOptions,
} from '../src/options_converter.js';

interface PackageManifest {
  readonly version: string;
}

interface CliRun {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageManifest;

const mdpath = 'sample/index.md';

function runMain(...args: readonly string[]): CliRun {
  return runArgv([mdpath, ...args]);
}

function runArgv(args: readonly string[]): CliRun {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const output: CliOutput = {
    writeOut: (chunk) => {
      stdout.push(chunk);
    },
    writeErr: (chunk) => {
      stderr.push(chunk);
    },
  };
  const exitCode = main(['node', 'md2conf', ...args], output);
  return { stdout: stdout.join(''), stderr: stderr.join(''), exitCode };
}

/** The options the command line produced, read back from the debug record. */
function parsedOptions(run: CliRun): Record<string, unknown> {
  const line = run.stderr.split('\n').find((entry) => entry.includes('Parsed options:'));
  if (line === undefined) {
    throw new Error(`no debug record of parsed options in: ${run.stderr}`);
  }
  return JSON.parse(
    line.slice(line.indexOf('Parsed options: ') + 'Parsed options: '.length),
  ) as Record<string, unknown>;
}

function resolvedSite(run: CliRun): string {
  const line = run.stderr.split('\n').find((entry) => entry.includes('Confluence site:'));
  if (line === undefined) {
    throw new Error(`no debug record of the Confluence site in: ${run.stderr}`);
  }
  return line.slice(line.indexOf('Confluence site: ') + 'Confluence site: '.length);
}

function readPath(options: Record<string, unknown>, path: readonly string[]): unknown {
  return path.reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], options);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('md2conf --version', () => {
  it('prints the version from package.json', () => {
    const run = runMain('--version');

    expect(run.stdout).toBe(`${manifest.version}\n`);
    expect(run.stderr).toBe('');
    expect(run.exitCode).toBe(0);
  });
});

describe('md2conf --help', () => {
  it('lists every MVP command-line option', () => {
    const help = getHelp();

    for (const flag of [
      '--domain',
      '--path',
      '--api-url',
      '--username',
      '--api-key',
      '--space',
      '--root-page',
      '--loglevel',
      '--keep-hierarchy',
      '--skip-hierarchy',
      '--title-prefix',
      '--no-title-prefix',
      '--generated-by',
      '--no-generated-by',
      '--attachment-sync',
      '--skip-update',
      '--keep-update',
      '--heading-anchors',
      '--force-valid-url',
      '--skip-title-heading',
      '--render-mermaid',
      '--no-render-mermaid',
      '--diagram-output-format',
      '--local',
    ]) {
      expect(help).toContain(flag);
    }
  });

  it('does not offer the flags of post-MVP features', () => {
    const help = getHelp();

    for (const flag of [
      '--api-version',
      '--webui-links',
      '--no-webui-links',
      '--comments',
      '--overwrite',
      '--no-overwrite',
      '--keep-state',
      '--skip-state',
      '--line-numbers',
      '--no-line-numbers',
      '--global-properties',
      '--notify',
      '--no-notify',
      '--render-drawio',
      '--no-render-drawio',
      '--render-plantuml',
      '--no-render-plantuml',
      '--render-latex',
      '--no-render-latex',
      '--render-other',
      '--no-render-other',
      '--user-mentions',
      '--no-user-mentions',
      '--ignore-invalid-url',
      '-r',
    ]) {
      expect(help).not.toContain(`${flag} `);
      expect(help).not.toContain(`${flag}\n`);
    }
  });

  it('registers --version without a short option, as upstream does', () => {
    expect(getHelp()).toContain('--version');
    expect(getHelp()).not.toContain('-V');
    expect(runMain('-V').exitCode).toBe(2);
  });
});

describe('MVP command-line options', () => {
  it('keeps the upstream defaults when no option is given', () => {
    const run = runMain(
      '--loglevel',
      'debug',
      '--domain',
      'markdown-to-confluence.atlassian.net',
      '--api-key',
      'key',
    );
    const options = parsedOptions(run);

    expect(options.rootPage).toBeUndefined();
    expect(options.titlePrefix).toBeUndefined();
    expect(options).toMatchObject({
      keepHierarchy: false,
      generatedBy: 'This page has been generated with a tool.',
      attachmentSync: 'full',
      skipUpdate: false,
      converter: {
        headingAnchors: false,
        forceValidUrl: true,
        skipTitleHeading: false,
        renderMermaid: true,
        diagramOutputFormat: 'png',
      },
    });
  });

  it.each([
    ['--root-page', '12345', ['rootPage'], '12345'],
    ['--title-prefix', 'API ', ['titlePrefix'], 'API '],
    ['--generated-by', 'Written by a bot.', ['generatedBy'], 'Written by a bot.'],
    ['--attachment-sync', 'create', ['attachmentSync'], 'create'],
    ['--diagram-output-format', 'svg', ['converter', 'diagramOutputFormat'], 'svg'],
  ])('maps %s onto %s', (flag, value, path, expected) => {
    const run = runMain(
      '--loglevel',
      'debug',
      '--domain',
      'markdown-to-confluence.atlassian.net',
      '--api-key',
      'key',
      flag,
      value,
    );
    const options = parsedOptions(run);

    expect(readPath(options, path)).toBe(expected);
  });

  it.each([
    ['--keep-hierarchy', ['keepHierarchy'], true],
    ['--heading-anchors', ['converter', 'headingAnchors'], true],
    ['--skip-title-heading', ['converter', 'skipTitleHeading'], true],
    ['--render-mermaid', ['converter', 'renderMermaid'], true],
    ['--skip-update', ['skipUpdate'], true],
    ['--skip-hierarchy', ['keepHierarchy'], false],
    ['--keep-update', ['skipUpdate'], false],
    ['--no-heading-anchors', ['converter', 'headingAnchors'], false],
    ['--no-force-valid-url', ['converter', 'forceValidUrl'], false],
    ['--keep-title-heading', ['converter', 'skipTitleHeading'], false],
    ['--no-render-mermaid', ['converter', 'renderMermaid'], false],
  ])('maps %s onto %s=%s', (flag, path, expected) => {
    const run = runMain(
      '--loglevel',
      'debug',
      '--domain',
      'markdown-to-confluence.atlassian.net',
      '--api-key',
      'key',
      flag,
    );

    expect(readPath(parsedOptions(run), path)).toBe(expected);
  });

  it('rejects a value outside the choices of a choice option', () => {
    const run = runMain(
      '--domain',
      'markdown-to-confluence.atlassian.net',
      '--api-key',
      'key',
      '--attachment-sync',
      'replace',
    );

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain('Allowed choices are full, upsert, create');
  });
});

describe('environment variables', () => {
  it.each([
    ['CONFLUENCE_DOMAIN', 'env.atlassian.net', 'env.atlassian.net/wiki/ (space: user space)'],
    ['CONFLUENCE_PATH', '/env/', 'env.atlassian.net/env/ (space: user space)'],
    ['CONFLUENCE_SPACE_KEY', 'ENVS', 'env.atlassian.net/wiki/ (space: ENVS)'],
  ])('%s supplies the site property', (name, value, expected) => {
    vi.stubEnv('CONFLUENCE_DOMAIN', 'env.atlassian.net');
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');
    vi.stubEnv(name, value);

    const run = runMain('--loglevel', 'debug');

    expect(resolvedSite(run)).toBe(expected);
    expect(run.exitCode).toBe(0);
  });

  it('takes the site from the API URL alone, as upstream does', () => {
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');
    vi.stubEnv('CONFLUENCE_API_URL', 'https://api.atlassian.com/ex/confluence/cloud-id/');

    const run = runMain('--loglevel', 'debug');

    expect(resolvedSite(run)).toBe(' (space: user space)');
    expect(run.exitCode).toBe(0);
  });

  it.each([
    ['--domain', 'flag.atlassian.net', 'CONFLUENCE_DOMAIN', 'env.atlassian.net'],
    ['--path', '/flag/', 'CONFLUENCE_PATH', '/env/'],
    ['--space', 'FLAG', 'CONFLUENCE_SPACE_KEY', 'ENVS'],
  ])('%s wins over %s', (flag, value, name, environmentValue) => {
    vi.stubEnv(name, environmentValue);
    vi.stubEnv('CONFLUENCE_DOMAIN', 'env.atlassian.net');
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');

    const run = runMain('--loglevel', 'debug', flag, value);

    expect(resolvedSite(run)).toContain(value);
  });

  it('takes the API key and user name from the environment', () => {
    vi.stubEnv('CONFLUENCE_DOMAIN', 'env.atlassian.net');
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');
    vi.stubEnv('CONFLUENCE_USER_NAME', 'env.user@example.com');

    expect(new ConnectionProperties().apiKey).toBe('env-key');
    expect(new ConnectionProperties().userName).toBe('env.user@example.com');
  });

  it('lets an argument win over the environment in the properties as well', () => {
    vi.stubEnv('CONFLUENCE_DOMAIN', 'env.atlassian.net');
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');

    const properties = new ConnectionProperties({
      domain: 'flag.atlassian.net',
      apiKey: 'flag-key',
    });

    expect(properties.domain).toBe('flag.atlassian.net');
    expect(properties.apiKey).toBe('flag-key');
  });

  it('takes every site property from the environment', () => {
    vi.stubEnv('CONFLUENCE_DOMAIN', 'env.atlassian.net');
    vi.stubEnv('CONFLUENCE_PATH', '/env/');
    vi.stubEnv('CONFLUENCE_SPACE_KEY', 'ENVS');

    const properties = new ConfluenceSiteProperties();

    expect(properties.domain).toBe('env.atlassian.net');
    expect(properties.basePath).toBe('/env/');
    expect(properties.spaceKey).toBe('ENVS');
  });

  it('supplies --root-page from CONFLUENCE_PAGE_ID, which upstream does not read', () => {
    vi.stubEnv('CONFLUENCE_DOMAIN', 'env.atlassian.net');
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');
    vi.stubEnv('CONFLUENCE_PAGE_ID', '19840101');

    const run = runMain('--loglevel', 'debug');

    expect(parsedOptions(run).rootPage).toBe('19840101');
    expect(runMain('--loglevel', 'debug', '--root-page', '42').stderr).toContain('"rootPage":"42"');
  });

  it('lets --root-page win over CONFLUENCE_PAGE_ID', () => {
    vi.stubEnv('CONFLUENCE_DOMAIN', 'env.atlassian.net');
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');
    vi.stubEnv('CONFLUENCE_PAGE_ID', '19840101');

    const run = runMain('--loglevel', 'debug', '--root-page', '42');

    expect(parsedOptions(run).rootPage).toBe('42');
  });

  it('leaves the root page unset when neither the flag nor the variable is given', () => {
    vi.stubEnv('CONFLUENCE_DOMAIN', 'env.atlassian.net');
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');

    expect(parsedOptions(runMain('--loglevel', 'debug')).rootPage).toBeUndefined();
  });

  it('defaults the base path to /wiki/ when only a domain is known', () => {
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');

    const properties = new ConnectionProperties({ domain: 'markdown-to-confluence.atlassian.net' });

    expect(properties.basePath).toBe('/wiki/');
    expect(properties.spaceKey).toBeUndefined();
  });
});

describe('debug output', () => {
  it('reports the parsed options at debug verbosity', () => {
    const run = runMain(
      '--loglevel',
      'debug',
      '--domain',
      'markdown-to-confluence.atlassian.net',
      '--api-key',
      'key',
    );

    expect(run.stderr).toContain(' - DEBUG - Parsed options: ');
    expect(run.exitCode).toBe(0);
  });

  it('stays quiet above debug verbosity', () => {
    const run = runMain(
      '--loglevel',
      'info',
      '--domain',
      'markdown-to-confluence.atlassian.net',
      '--api-key',
      'key',
    );

    expect(run.stderr).toBe('');
  });

  it('never writes the API key', () => {
    const run = runMain(
      '--loglevel',
      'debug',
      '--domain',
      'markdown-to-confluence.atlassian.net',
      '--api-key',
      'a-secret-api-key',
      '--username',
      'user@example.com',
    );

    expect(run.stderr).toContain(' - DEBUG - Parsed options: ');
    expect(run.stderr).not.toContain('a-secret-api-key');
    expect(run.stdout).not.toContain('a-secret-api-key');
  });
});

describe('log verbosity', () => {
  it('accepts every upstream level', () => {
    expect(logLevels).toEqual(['debug', 'info', 'warning', 'error', 'critical']);
  });

  it('rejects a level that is not one of them', () => {
    const run = runMain('--loglevel', 'verbose', '--domain', 'd.example.com', '--api-key', 'key');

    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain('Allowed choices are debug, info, warning, error, critical');
  });
});

describe('missing or wrong arguments', () => {
  it('fails when the API key is neither on the command line nor in the environment', () => {
    const run = runMain('--domain', 'markdown-to-confluence.atlassian.net');

    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain('Usage: md2conf');
    expect(run.stderr).toContain('error: Confluence API key not specified');
  });

  it('fails when neither an API URL nor a domain is known', () => {
    vi.stubEnv('CONFLUENCE_API_KEY', 'env-key');

    const run = runMain();

    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain('error: Confluence API URL or domain required');
  });

  it('fails when the domain looks like a URL', () => {
    const run = runMain(
      '--domain',
      'https://markdown-to-confluence.atlassian.net/',
      '--api-key',
      'key',
    );

    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain(
      'error: Confluence domain looks like a URL; only host name required',
    );
  });

  it('fails when the base path does not start and end with a slash', () => {
    const run = runMain('--domain', 'd.example.com', '--path', 'wiki', '--api-key', 'key');

    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain("error: Confluence base path must start and end with a '/'");
  });

  it('reports an unsupported command-line option', () => {
    const run = runMain('--no-such-option');

    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain("unknown option '--no-such-option'");
  });

  it.each<[string, readonly string[]]>([
    ['a missing path', []],
    ['an unknown option', ['--bogus']],
    ['an unknown log level', ['-l', 'bogus']],
    ['a value that is not an integer', ['--layout-image-max-width', 'abc']],
  ])('exits with 2 and prints the usage for %s, as argparse does', (_name, args) => {
    const run = runArgv(args);

    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain('Usage: md2conf');
  });

  it('leaves the short version option unregistered', () => {
    const run = runMain('-V');

    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain("unknown option '-V'");
  });
});

describe('the command-line fields the options classes declare', () => {
  const optionsClasses: readonly (readonly [string, OptionsType<unknown>])[] = [
    ['ProcessorOptions', ProcessorOptions],
    ['ConverterOptions', ConverterOptions],
    ['LayoutOptions', LayoutOptions],
    ['ImageLayoutOptions', ImageLayoutOptions],
    ['TableLayoutOptions', TableLayoutOptions],
  ];

  it.each(optionsClasses)('names only fields that %s has', (_name, optionsType) => {
    const defaults = Object.assign({}, new optionsType()) as Record<string, unknown>;

    for (const field of optionsType.fields) {
      expect(Object.hasOwn(defaults, field.name)).toBe(true);
    }
  });
});

describe('md2conf --local', () => {
  it('resolves the site without an API key', () => {
    vi.stubEnv('CONFLUENCE_DOMAIN', 'markdown-to-confluence.atlassian.net');

    const run = runMain('--loglevel', 'debug', '--local');

    expect(run.exitCode).toBe(0);
    expect(resolvedSite(run)).toBe(
      'markdown-to-confluence.atlassian.net/wiki/ (space: user space)',
    );
  });

  it('fails when the domain is unknown', () => {
    const run = runMain('--local');

    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain('error: Confluence domain not specified');
  });
});

describe('error classes', () => {
  it('names each class after the upstream exception it stands for', () => {
    expect(new ArgumentError('x').name).toBe('ArgumentError');
    expect(new PageError('x').name).toBe('PageError');
    expect(new ConfluenceError('x').name).toBe('ConfluenceError');
  });

  it('makes every error an Error', () => {
    expect(new ArgumentError('x')).toBeInstanceOf(Error);
    expect(new PageError('x')).toBeInstanceOf(Error);
    expect(new ConfluenceError('x')).toBeInstanceOf(Error);
  });
});
