// Port of md2conf/tests/test_clio.py from hunyadi/md2conf (MIT; see NOTICE.md).
//
// Upstream drives `add_arguments`/`get_options` with data classes declared in the
// test; the same four option classes are declared here. The two cases upstream
// covers (`NestedOptions` and `FlatOptions`) are kept as they are, and the
// nullable option and the integer type, which upstream only reaches through
// `options.py`, are covered as well.

import { CommanderError, Command } from 'commander';
import { describe, expect, it } from 'vitest';

import {
  addArguments,
  booleanOption,
  compositeOption,
  getOptions,
  type ArgumentOption,
  type OptionsType,
  nullableOption,
  valueOption,
} from '../src/clio.js';

type Choice = 'one' | 'two' | 'three';

class CompositeOptions {
  static readonly fields: readonly ArgumentOption[] = [
    valueOption('intVal', { type: 'integer' }, 'Help text for integer option.'),
    valueOption('optionalIntVal', { type: 'integer' }, 'Help text for integer option.'),
    valueOption('strVal', { type: 'text' }, 'Help text for string option.'),
    valueOption(
      'literalVal',
      { type: 'choice', choices: ['one', 'two', 'three'] },
      'Help text for choice option.',
    ),
  ];

  intVal = 12;
  optionalIntVal?: number;
  strVal = 'string';
  literalVal: Choice = 'two';
  untrackedVal = 'untracked';
}

class Options {
  static readonly fields: readonly ArgumentOption[] = [
    booleanOption(
      'boolFlag',
      'Help text for the case when flag is enabled.',
      'Help text for the case when flag is disabled.',
    ),
  ];

  boolFlag = false;
  untrackedValue = 'untracked';
  untrackedClass = new CompositeOptions();
}

class NestedOptions extends Options {
  static readonly fields: readonly ArgumentOption[] = [
    ...Options.fields,
    compositeOption('nested', CompositeOptions),
  ];

  nested = new CompositeOptions();
}

class FlatOptions extends Options {
  static readonly fields: readonly ArgumentOption[] = [
    ...Options.fields,
    compositeOption('flat', CompositeOptions, true),
  ];

  flat = new CompositeOptions();
}

class NullableOptions {
  static readonly fields: readonly ArgumentOption[] = [
    nullableOption('strVal', { type: 'text' }, 'Set the value.', 'Un-set the value.'),
    nullableOption(
      'omittedVal',
      { type: 'text' },
      'Set the omitted value.',
      'Un-set the omitted value.',
    ),
    booleanOption('enabled', 'Turn the option on.', 'Turn the option off.'),
  ];

  strVal: string | undefined = 'string';
  omittedVal?: string;
  enabled = true;
}

class SkipOptions {
  static readonly fields: readonly ArgumentOption[] = [
    booleanOption('skipUpdate', 'Skip the update.', 'Do not skip the update.'),
    booleanOption('enabled', 'Turn the option on.', 'Turn the option off.'),
  ];

  skipUpdate = false;
  enabled = true;
}

interface CliRun<T> {
  readonly help: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly options: T;
}

function runCli<T>(optionsType: OptionsType<T>, args: readonly string[]): CliRun<T> {
  const stderr: string[] = [];
  const command = new Command().configureOutput({
    writeOut: (chunk) => {
      stderr.push(chunk);
    },
    writeErr: (chunk) => {
      stderr.push(chunk);
    },
  });
  command.exitOverride();
  addArguments(command, optionsType);

  const help = command.helpInformation();
  let exitCode = 0;
  try {
    command.parse(['node', 'md2conf', ...args]);
  } catch (error) {
    if (!(error instanceof CommanderError)) {
      throw error;
    }
    exitCode = error.exitCode;
  }
  return {
    help,
    stderr: stderr.join(''),
    exitCode,
    options: getOptions(command.opts(), optionsType),
  };
}

describe('hierarchical command-line options', () => {
  it('registers the composite fields under the field name as a prefix', () => {
    const { help } = runCli(NestedOptions, []);

    expect(help).toContain('Usage:');
    expect(help).toContain('Options:');
    expect(help).toContain('--bool-flag');
    expect(help).toContain('--no-bool-flag');
    expect(help).toContain('--nested-int-val <INT>');
    expect(help).toContain('--nested-literal-val <LITERAL_VAL>');
  });

  it('maps every option onto the options instance', () => {
    const { options } = runCli(NestedOptions, [
      '--nested-int-val=23',
      '--nested-optional-int-val=45',
      '--nested-str-val=text',
      '--nested-literal-val=three',
      '--bool-flag',
    ]);

    expect(options.boolFlag).toBe(true);
    expect(options.nested.intVal).toBe(23);
    expect(options.nested.optionalIntVal).toBe(45);
    expect(options.nested.strVal).toBe('text');
    expect(options.nested.literalVal).toBe('three');
  });

  it('leaves a field without command-line metadata at its default', () => {
    const { options } = runCli(NestedOptions, ['--nested-int-val=23']);

    expect(options.nested.untrackedVal).toBe('untracked');
    expect(options.untrackedValue).toBe('untracked');
    expect(options.untrackedClass.intVal).toBe(12);
    expect(options.nested.optionalIntVal).toBeUndefined();
  });

  it('keeps the defaults when no option is given', () => {
    const { options } = runCli(NestedOptions, []);

    expect(options.boolFlag).toBe(false);
    expect(options.nested.intVal).toBe(12);
    expect(options.nested.strVal).toBe('string');
    expect(options.nested.literalVal).toBe('two');
  });
});

describe('flattened command-line options', () => {
  it('registers the composite fields without a prefix', () => {
    const { help } = runCli(FlatOptions, []);

    expect(help).toContain('--bool-flag');
    expect(help).toContain('--no-bool-flag');
    expect(help).toContain('--int-val <INT>');
    expect(help).not.toContain('--flat-int-val');
  });

  it('maps every option onto the flattened options instance', () => {
    const { options } = runCli(FlatOptions, [
      '--int-val=23',
      '--optional-int-val=45',
      '--str-val=text',
      '--literal-val=three',
      '--bool-flag',
    ]);

    expect(options.boolFlag).toBe(true);
    expect(options.flat.intVal).toBe(23);
    expect(options.flat.optionalIntVal).toBe(45);
    expect(options.flat.strVal).toBe('text');
    expect(options.flat.literalVal).toBe('three');
    expect(options.flat.untrackedVal).toBe('untracked');
  });
});

describe('nullable command-line options', () => {
  it('assigns and un-sets the value', () => {
    const assigned = runCli(NullableOptions, ['--str-val=text']).options;
    expect(assigned.strVal).toBe('text');

    const unassigned = runCli(NullableOptions, ['--no-str-val']).options;
    expect(unassigned.strVal).toBeUndefined();

    const omitted = runCli(NullableOptions, ['--omitted-val=text']).options;
    expect(omitted.omittedVal).toBe('text');
  });

  it('marks the default side in the help text', () => {
    const { help } = runCli(NullableOptions, []);

    expect(help).toContain('--str-val <STR>');
    expect(help).toContain('Set the value. (default: string)');
    expect(help).toContain('Un-set the value.');
    expect(help).toContain('--omitted-val <STR>');
    expect(help).toContain('Set the omitted value.');
    expect(help).toContain('Un-set the omitted value. (default)');
    expect(help).toContain('Turn the option on. (default)');
    expect(help).toContain('Turn the option off.');
  });
});

describe('boolean command-line options', () => {
  it('turns a default-true flag off with its inverse flag', () => {
    expect(runCli(NullableOptions, ['--no-enabled']).options.enabled).toBe(false);
    expect(runCli(NullableOptions, ['--enabled']).options.enabled).toBe(true);
  });

  it('uses keep/skip as the inverse pair for a skip- field', () => {
    const { help } = runCli(SkipOptions, []);

    expect(help).toContain('--skip-update');
    expect(help).toContain('--keep-update');
  });

  it('maps a skip- field onto the field, whichever flag is given', () => {
    expect(runCli(SkipOptions, ['--skip-update']).options.skipUpdate).toBe(true);
    expect(runCli(SkipOptions, ['--keep-update']).options.skipUpdate).toBe(false);
  });

  it('lets the last flag of a skip-/keep- pair win, as the shared argparse dest does', () => {
    expect(runCli(SkipOptions, ['--skip-update', '--keep-update']).options.skipUpdate).toBe(false);
    expect(runCli(SkipOptions, ['--keep-update', '--skip-update']).options.skipUpdate).toBe(true);
  });

  it('lets the last flag of a no- pair win too', () => {
    expect(runCli(SkipOptions, ['--enabled', '--no-enabled']).options.enabled).toBe(false);
    expect(runCli(SkipOptions, ['--no-enabled', '--enabled']).options.enabled).toBe(true);
  });
});

describe('integer command-line options', () => {
  it('rejects a value that is not an integer', () => {
    const run = runCli(NestedOptions, ['--nested-int-val=abc']);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain("invalid integer value: 'abc'");
  });
});

describe('choice command-line options', () => {
  it('rejects a value outside the choices', () => {
    const run = runCli(NestedOptions, ['--nested-literal-val=four']);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain('Allowed choices are one, two, three');
  });
});
