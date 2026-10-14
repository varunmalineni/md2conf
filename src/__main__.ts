// Port of md2conf/__main__.py from hunyadi/md2conf (MIT; see NOTICE.md).
//
// Argument parsing and logging setup only: the `--local` converter arrives with
// C16 and publishing with C18. Upstream's deprecated `-r` and
// `--ignore-invalid-url` flags are left out with the rest of the post-MVP
// surface (ADR 0007); plan §3 keeps flags we do not implement out of `--help`.

import { CommanderError, Command, Option } from 'commander';

import { addArguments, getOptions } from './clio.js';
import { ArgumentError, ConfluenceSiteProperties, ConnectionProperties } from './environment.js';
import { version } from './index.js';
import { ProcessorOptions } from './options.js';

/** Where the CLI writes. Tests pass their own sinks so they never touch the real streams. */
export interface CliOutput {
  readonly writeOut: (chunk: string) => void;
  readonly writeErr: (chunk: string) => void;
}

/** Log verbosity levels, in the order `--loglevel` accepts them. */
export const logLevels = ['debug', 'info', 'warning', 'error', 'critical'] as const;

export type LogLevel = (typeof logLevels)[number];

/** Upstream passes `logging.INFO` as the `--loglevel` default. */
const defaultLogLevel: LogLevel = 'info';

const logLevelValues: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warning: 30,
  error: 40,
  critical: 50,
};

const processOutput: CliOutput = {
  writeOut: (chunk) => {
    process.stdout.write(chunk);
  },
  writeErr: (chunk) => {
    process.stderr.write(chunk);
  },
};

/** Command-line arguments, as upstream's `Arguments` namespace collects them. */
export interface CliArguments {
  /** Path to Markdown file or directory to convert and publish. */
  readonly mdpath: readonly string[];
  readonly domain?: string;
  readonly path?: string;
  readonly apiUrl?: string;
  readonly username?: string;
  readonly apiKey?: string;
  readonly space?: string;
  readonly loglevel?: string;
  readonly local?: boolean;
  /** One entry per command-line option declared by an options class. */
  readonly [option: string]: unknown;
}

let logLevel: LogLevel = defaultLogLevel;
let logOutput: CliOutput = processOutput;

/**
 * Python's `logging.basicConfig` sets the verbosity and the record format in one
 * place; here the level gates the records and the format mirrors upstream's
 * `%(asctime)s - %(levelname)s - %(message)s`, without the Python-only
 * `%(funcName)s [%(lineno)d]` part. Records go to standard error, as Python's
 * default handler does.
 */
function configureLogging(level: LogLevel, output: CliOutput): void {
  logLevel = level;
  logOutput = output;
}

function log(level: LogLevel, message: string): void {
  if (logLevelValues[level] >= logLevelValues[logLevel]) {
    logOutput.writeErr(`${new Date().toISOString()} - ${level.toUpperCase()} - ${message}\n`);
  }
}

export function getParser(output: CliOutput = processOutput): Command {
  const command = new Command()
    .name('md2conf')
    .description('Publish Markdown files to a Confluence wiki')
    .version(version)
    .configureOutput({ writeOut: output.writeOut, writeErr: output.writeErr });

  command.argument('<mdpath...>', 'Path to Markdown file or directory to convert and publish.');
  command.option(
    '-d, --domain <domain>',
    'Confluence organization domain. (env: CONFLUENCE_DOMAIN)',
  );
  command.option(
    '-p, --path <path>',
    "Base path for Confluence. (env: CONFLUENCE_PATH; default: '/wiki/')",
  );
  command.option(
    '--api-url <api-url>',
    'Confluence API URL. Required for scoped tokens. Refer to documentation how to obtain one. (env: CONFLUENCE_API_URL)',
  );
  command.option('-u, --username <username>', 'Confluence user name. (env: CONFLUENCE_USER_NAME)');
  command.option(
    '-a, --api-key <api-key>',
    'Confluence API key. Refer to documentation how to obtain one. (env: CONFLUENCE_API_KEY)',
  );
  command.option(
    '-s, --space <space>',
    'Confluence space key for pages to be published. If omitted, will default to user space. (env: CONFLUENCE_SPACE_KEY)',
  );
  command.addOption(
    new Option('-l, --loglevel <level>', 'Use this option to set the log verbosity.').choices(
      logLevels,
    ),
  );

  addArguments(command, ProcessorOptions);

  command.option(
    '--local',
    'Write XHTML-based Confluence Storage Format files locally without invoking Confluence API.',
  );
  return command;
}

export function getHelp(): string {
  return getParser().helpInformation();
}

/**
 * Parses the command line, sets logging up and resolves the Confluence site.
 *
 * @param argv Command line arguments, `process.argv` for the `md2conf` bin.
 * @param output Where the command writes; tests pass their own sinks.
 * @returns The process exit code, the way pip's generated console script uses
 *   `sys.exit(main())`.
 */
export function main(argv: readonly string[], output: CliOutput = processOutput): number {
  const command = getParser(output);
  command.exitOverride();
  try {
    command.parse(argv);
    const args: CliArguments = { ...command.opts<CliArguments>(), mdpath: command.args };

    configureLogging((args.loglevel as LogLevel | undefined) ?? defaultLogLevel, output);

    const publisherOptions = getOptions(args, ProcessorOptions);
    log('debug', `Parsed options: ${JSON.stringify(publisherOptions)}`);

    const properties = args.local
      ? new ConfluenceSiteProperties(args.domain, args.path, args.space)
      : new ConnectionProperties({
          apiUrl: args.apiUrl,
          domain: args.domain,
          basePath: args.path,
          userName: args.username,
          apiKey: args.apiKey,
          spaceKey: args.space,
        });
    log(
      'debug',
      `Confluence site: ${properties.domain ?? ''}${properties.basePath ?? ''} (space: ${properties.spaceKey ?? 'user space'})`,
    );
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }
    if (error instanceof ArgumentError) {
      // Upstream calls `parser.error()`, which prints the usage and fails.
      output.writeErr(`${command.helpInformation()}error: ${error.message}\n`);
      return 2;
    }
    throw error;
  }
  return 0;
}
