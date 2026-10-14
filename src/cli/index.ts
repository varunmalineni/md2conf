import { readFileSync } from 'node:fs';
import { Command } from 'commander';

/** Where the CLI writes. Tests pass their own sinks so they never touch the real streams. */
export interface CliOutput {
  readonly writeOut: (chunk: string) => void;
  readonly writeErr: (chunk: string) => void;
}

interface PackageManifest {
  readonly version: string;
}

const processOutput: CliOutput = {
  writeOut: (chunk) => {
    process.stdout.write(chunk);
  },
  writeErr: (chunk) => {
    process.stderr.write(chunk);
  },
};

function readVersion(): string {
  // `src/cli/index.ts` and the built `dist/cli/index.js` both sit two levels
  // below the package root, so one relative lookup works before and after build.
  const manifest = new URL('../../package.json', import.meta.url);
  return (JSON.parse(readFileSync(manifest, 'utf8')) as PackageManifest).version;
}

export function createProgram(output: CliOutput = processOutput): Command {
  return new Command()
    .name('md2conf')
    .description('Publish Markdown files to a Confluence wiki')
    .version(readVersion())
    .configureOutput({ writeOut: output.writeOut, writeErr: output.writeErr });
}

export function run(argv: readonly string[], output: CliOutput = processOutput): void {
  createProgram(output).parse(argv);
}
