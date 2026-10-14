// Port of md2conf/clio.py from hunyadi/md2conf (MIT; see NOTICE.md).
//
// Upstream reads command-line metadata from the data-class fields that carry
// `metadata=boolean_option(...)` and friends. TypeScript has no equivalent
// runtime metadata on a class field, so each options class lists its fields in a
// static `fields` array built with the same four helpers. Everything else — the
// walk over the fields, the flag names, the help text, the defaults and the
// mapping back onto an options instance — follows upstream. commander takes the
// place of argparse (ADR 0006).

import { InvalidArgumentError, Option, type Command } from 'commander';

/** The type of a value an option carries; upstream reads it off the field annotation. */
export type OptionValueType =
  | { readonly type: 'text'; readonly metavar?: string }
  | { readonly type: 'integer' }
  | { readonly type: 'choice'; readonly choices: readonly string[] };

/** Identifies a command-line argument as a boolean (on/off) flag. */
export interface BooleanOption {
  readonly kind: 'boolean';
  readonly name: string;
  readonly trueText: string;
  readonly falseText: string;
}

/** Identifies a command-line argument as an option that assigns a value. */
export interface ValueOption {
  readonly kind: 'value';
  readonly name: string;
  readonly valueType: OptionValueType;
  readonly text: string;
}

/** Identifies a command-line argument as an option that sets or un-sets a value. */
export interface NullableOption {
  readonly kind: 'nullable';
  readonly name: string;
  readonly valueType: OptionValueType;
  readonly valueText: string;
  readonly omitText: string;
}

/**
 * Determines how a data-class populates command-line arguments.
 *
 * @param flatten True if members of the data-class are populated as if they were defined in the encapsulating class.
 */
export interface CompositeOption {
  readonly kind: 'composite';
  readonly name: string;
  readonly options: OptionsType<unknown>;
  readonly flatten: boolean;
}

export type ArgumentOption = BooleanOption | ValueOption | NullableOption | CompositeOption;

/** A data-class that populates command-line arguments, with the fields that are tracked. */
export interface OptionsType<T> {
  readonly fields: readonly ArgumentOption[];
  new (): T;
}

export function booleanOption(name: string, trueText: string, falseText: string): BooleanOption {
  return { kind: 'boolean', name, trueText, falseText };
}

export function valueOption(name: string, valueType: OptionValueType, text: string): ValueOption {
  return { kind: 'value', name, valueType, text };
}

export function nullableOption(
  name: string,
  valueType: OptionValueType,
  valueText: string,
  omitText: string,
): NullableOption {
  return { kind: 'nullable', name, valueType, valueText, omitText };
}

export function compositeOption(
  name: string,
  options: OptionsType<unknown>,
  flatten = false,
): CompositeOption {
  return { kind: 'composite', name, options, flatten };
}

/** Values a command-line argument parser acquired; one entry per command-line option. */
export type OptionValues = Readonly<Record<string, unknown>>;

/** Upstream derives the flag name from the field name by replacing `_` with `-`. */
function toArgName(fieldName: string): string {
  return fieldName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** The flag that turns a boolean option the other way round. */
function toInverseArgName(argName: string): string {
  if (argName.startsWith('skip-')) {
    return `keep-${argName.slice('skip-'.length)}`;
  }
  if (argName.startsWith('keep-')) {
    return `skip-${argName.slice('keep-'.length)}`;
  }
  return `no-${argName}`;
}

/**
 * commander derives the key of a value in `opts()` from the long flag; ask it
 * rather than restate its rule, so the two cannot drift apart.
 */
function attributeNameOf(flag: string): string {
  return new Option(flag).attributeName();
}

/**
 * The value a command-line option carries, narrowed to what a help text can
 * render. Every default that reaches the help text is a scalar, upstream's
 * `str()` included.
 */
function scalarDefault(value: unknown): string | number | boolean | undefined {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return value;
    default:
      return undefined;
  }
}

function metavarOf(valueType: OptionValueType, argName: string): string {
  switch (valueType.type) {
    case 'text':
      return valueType.metavar ?? 'STR';
    case 'integer':
      return 'INT';
    case 'choice':
      // argparse falls back to the destination in upper case for a value whose
      // type carries no name of its own.
      return argName.toUpperCase().replace(/-/g, '_');
  }
}

/**
 * Both flags of a boolean pair fill the same key, which is what upstream's shared
 * argparse `dest` does: the flag that comes last on the command line wins.
 */
class BooleanFlag extends Option {
  constructor(flags: string, description: string, dest: string) {
    super(flags, description);
    this.dest = dest;
  }

  private readonly dest: string;

  override attributeName(): string {
    return this.dest;
  }
}

/** Adds arguments to a command-line argument parser by recursively visiting fields of a composite type. */
class OptionTreeVisitor {
  private readonly prefixes: string[] = [];

  constructor(private readonly command: Command) {}

  private getArgName(argName: string): string {
    return `--${[...this.prefixes, argName].join('-')}`;
  }

  private addBooleanField(field: BooleanOption, defaults: Record<string, unknown>): void {
    const argName = toArgName(field.name);
    const flag = this.getArgName(argName);
    const trueText = defaults[field.name] === true ? `${field.trueText} (default)` : field.trueText;
    this.command.addOption(new BooleanFlag(flag, trueText, attributeNameOf(flag)));

    const inverseFlag = this.getArgName(toInverseArgName(argName));
    const falseText =
      defaults[field.name] === false ? `${field.falseText} (default)` : field.falseText;
    // commander writes `false` for a `--no-` flag on its own; `preset` gives the
    // `--keep-`/`--skip-` pair the same value.
    this.command.addOption(
      new BooleanFlag(inverseFlag, falseText, attributeNameOf(flag)).preset(false),
    );
  }

  private addValueField(field: ValueOption | NullableOption, helpText: string): void {
    const argName = toArgName(field.name);
    const flag = `${this.getArgName(argName)} <${metavarOf(field.valueType, argName)}>`;
    const option = new Option(flag, helpText);
    if (field.valueType.type === 'integer') {
      option.argParser((value: string) => {
        if (!/^[+-]?\d+$/.test(value)) {
          throw new InvalidArgumentError(`invalid integer value: '${value}'`);
        }
        return Number(value);
      });
    }
    if (field.valueType.type === 'choice') {
      option.choices(field.valueType.choices);
    }
    this.command.addOption(option);
  }

  private addNullableField(field: NullableOption, defaults: Record<string, unknown>): void {
    const valueDefault = scalarDefault(defaults[field.name]);
    const valueHelpText =
      valueDefault === undefined
        ? field.valueText
        : `${field.valueText} (default: ${String(valueDefault)})`;
    this.addValueField(field, valueHelpText);

    const argName = toArgName(field.name);
    const omitHelpText =
      valueDefault === undefined ? `${field.omitText} (default)` : field.omitText;
    this.command.addOption(new Option(this.getArgName(`no-${argName}`), omitHelpText));
  }

  private addCompositeField(field: CompositeOption): void {
    const flattened = field.flatten;
    if (!flattened) {
      this.prefixes.push(toArgName(field.name));
    }
    this.addArguments(field.options);
    if (!flattened) {
      this.prefixes.pop();
    }
  }

  addArguments(optionsType: OptionsType<unknown>): void {
    const defaults: Record<string, unknown> = Object.assign({}, new optionsType());
    for (const field of optionsType.fields) {
      switch (field.kind) {
        case 'boolean':
          this.addBooleanField(field, defaults);
          break;
        case 'value': {
          const valueDefault = scalarDefault(defaults[field.name]);
          const helpText =
            valueDefault === undefined
              ? field.text
              : `${field.text} (default: ${String(valueDefault)})`;
          this.addValueField(field, helpText);
          break;
        }
        case 'nullable':
          this.addNullableField(field, defaults);
          break;
        case 'composite':
          this.addCompositeField(field);
          break;
      }
    }
  }
}

/**
 * Adds arguments to a command-line argument parser.
 *
 * @param command A command-line argument parser.
 * @param optionsType A data-class type that encapsulates configuration options.
 */
export function addArguments(command: Command, optionsType: OptionsType<unknown>): void {
  new OptionTreeVisitor(command).addArguments(optionsType);
}

function getParameters(
  values: OptionValues,
  optionsType: OptionsType<unknown>,
  prefixes: readonly string[],
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const field of optionsType.fields) {
    const argName = toArgName(field.name);
    const flag = `--${[...prefixes, argName].join('-')}`;
    switch (field.kind) {
      case 'boolean': {
        // Both flags of the pair fill this one key, so the last one wins.
        const value = values[attributeNameOf(flag)];
        if (value !== undefined) {
          params[field.name] = value;
        }
        break;
      }
      case 'value': {
        const value = values[attributeNameOf(flag)];
        if (value !== undefined) {
          params[field.name] = value;
        }
        break;
      }
      case 'nullable': {
        const value = values[attributeNameOf(flag)];
        if (value === false) {
          params[field.name] = undefined;
        } else if (value !== undefined) {
          params[field.name] = value;
        }
        break;
      }
      case 'composite':
        params[field.name] = buildOptions(
          values,
          field.options,
          field.flatten ? prefixes : [...prefixes, argName],
        );
        break;
    }
  }
  return params;
}

function buildOptions<T>(
  values: OptionValues,
  optionsType: OptionsType<T>,
  prefixes: readonly string[],
): T {
  const params = getParameters(values, optionsType, prefixes);
  return Object.assign(new optionsType() as object, params) as T;
}

/**
 * Extracts configuration options from command-line arguments acquired by an argument parser.
 *
 * A field that the command line left alone keeps the default of the options
 * class, the way a data-class does when a keyword argument is missing.
 *
 * @param values Arguments acquired by a command-line argument parser.
 * @param optionsType A data-class type that encapsulates configuration options.
 * @returns Configuration options as a data-class instance.
 */
export function getOptions<T>(values: OptionValues, optionsType: OptionsType<T>): T {
  return buildOptions(values, optionsType, []);
}
