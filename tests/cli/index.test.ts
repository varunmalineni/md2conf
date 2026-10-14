import { readFileSync } from 'node:fs';
import { CommanderError } from 'commander';
import { describe, expect, it } from 'vitest';
import { type CliOutput, createProgram } from '../../src/cli/index.js';

interface PackageManifest {
  readonly version: string;
}

interface CliRun {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

const manifest = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as PackageManifest;

function runCli(...args: readonly string[]): CliRun {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode = 0;
  const output: CliOutput = {
    writeOut: (chunk) => {
      stdout.push(chunk);
    },
    writeErr: (chunk) => {
      stderr.push(chunk);
    },
  };
  const program = createProgram(output);
  // commander exits the process on `--help` and on usage errors; the callback
  // turns those exits into a thrown CommanderError we can assert on.
  program.exitOverride((error: CommanderError) => {
    exitCode = error.exitCode;
    throw error;
  });
  try {
    program.parse(['node', 'md2conf', ...args]);
  } catch (error) {
    if (!(error instanceof CommanderError)) {
      throw error;
    }
  }
  return { stdout: stdout.join(''), stderr: stderr.join(''), exitCode };
}

describe('md2conf --version', () => {
  it('prints the version from package.json', () => {
    const result = runCli('--version');

    expect(result.stdout).toBe(`${manifest.version}\n`);
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });
});

describe('md2conf --help', () => {
  it('prints the usage text and exits successfully', () => {
    const result = runCli('--help');

    expect(result.stdout).toContain('Usage: md2conf [options]');
    expect(result.stdout).toContain('-V, --version');
    expect(result.stdout).toContain('-h, --help');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });
});

describe('md2conf with an unsupported option', () => {
  it('reports the error on stderr and fails', () => {
    const result = runCli('--no-such-option');

    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("unknown option '--no-such-option'");
    expect(result.exitCode).toBe(1);
  });
});
