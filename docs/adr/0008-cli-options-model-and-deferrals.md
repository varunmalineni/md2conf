# ADR 0008: The CLI options model, and what the port of `__main__.py` leaves out

- Status: Proposed (raised by Engineer 3 on ZER-35, 2026-10-14; needs the Tech Lead)
- Context issues: ZER-35 (C7), ZER-28 plan revision 3 §3, ZER-25 board direction
- Read with: ADR 0006 (mirror upstream's module structure), ADR 0007 (post-MVP trimming)

## Context

ADR 0006 asks for one TypeScript module per upstream module with the same classes and
functions, and the board's direction is to keep upstream's architecture and behaviour
exactly and add no new options. Porting `__main__.py` needs four modules —
`__main__.py`, `clio.py`, `options.py` and `environment.py` — and three of the decisions
below are visible in the code a reviewer diffs against upstream, so they are recorded
here rather than left to be rediscovered.

Upstream's `clio.py` is the interesting one. It builds a command-line argument parser by
walking the fields of a data class: each field carries `metadata=boolean_option(...)`,
`value_option(...)`, `nullable_option(...)` or `composite_option(flatten=...)`, and the
walker dispatches on the field's declared _type_ as well — `bool` becomes a pair of
`store_true`/`store_false` arguments sharing one `dest`, `Literal[...]` becomes a choice,
`T | None` becomes a value or a nullable option, and a data class becomes a nested
`--prefix-` group. `options.py` and `options_converter.py` are then pure declarations.

## Decision

1. **Each options class declares its command-line fields in a static `fields` array.**
   TypeScript has no runtime field metadata and no runtime type on a class field, so the
   four upstream helpers take the field name and the field's type as arguments and the
   walker reads that array:

   ```ts
   static readonly fields: readonly ArgumentOption[] = [
     valueOption('attachmentSync', { type: 'choice', choices: ['full', 'upsert', 'create'] }, '…'),
     booleanOption('skipUpdate', 'Skip saving Confluence page ID in Markdown files.', 'Inject …'),
     compositeOption('converter', ConverterOptions, true),
   ];
   ```

   Defaults still come from the class instance, which stays the single source of truth, as a
   Python data-class default is: the array carries only the name, the type and the help
   text, which are the three things a Python annotation plus `metadata=` carry that
   TypeScript cannot see. A field with no entry in the array is upstream's "untracked"
   field and keeps its default. A test walks every `fields` array and asserts that each
   name exists on a default instance, because the array duplicates the field names as
   strings.

2. **Both flags of a boolean pair fill one key.** A `BooleanFlag` is a `commander`
   `Option` whose `attributeName()` returns the field's key, and the inverse flag carries
   `preset(false)`. That is upstream's shared `dest`: the flag that comes last on the
   command line wins, for the `skip-`/`keep-` pair as well as the `no-` pair.

3. **`__main__.ts` ports argument parsing and logging setup, and nothing else.** The
   `--local` converter arrives with C16 and publishing with C18. Upstream's
   `_exception_hook` (which prints a cause chain) has no caller until publishing exists, and
   `ConfluenceAPIVersionMismatch` is REST v1, which is post-MVP.

4. **Upstream's deprecated `-r` and `--ignore-invalid-url` are not registered.** Both are
   marked deprecated upstream, neither is in the MVP flag list, and this package is at
   `0.0.0` with no users to break. Plan §3 keeps flags we do not implement out of
   `--help`; these two are out of the parser entirely rather than hidden.

5. **`src/options_api.ts` is not ported.** Upstream's `ConfluenceSessionOptions` has one
   field, `notify`, and plan §3 lists `--notify` as post-MVP, so the module would have no
   fields and STANDARDS.md §2 forbids it. It arrives with the session client in C11. The
   Tech Lead confirmed this on ZER-35.

6. **`CONFLUENCE_PAGE_ID` is an environment fallback for `--root-page`.** Upstream never
   reads it: `__main__.py` uses the name only as the argparse metavar of `--root-page`,
   and it is absent from upstream's README environment-variable list. The board answered
   on ZER-35 that the fallback is wanted, so `environment.ts` reads it with the same
   precedence as every other property and the flag wins. This is the one place the port
   deliberately departs from upstream, and it is recorded here because ADR 0006 and the
   board's "add no new options" direction both point the other way.

7. **A wrong argument exits with 2, as argparse does.** commander exits with 1, so `main`
   maps every non-zero exit code to 2 and leaves `--help` and `--version` at 0. The usage
   text follows the message on standard error, which is what `parser.error()` does.

8. **Logging is a level gate and a record format, not a framework.** `__main__.ts` sets
   both at start-up and writes records to standard error, as Python's default handler
   does. The format is upstream's minus `%(funcName)s [%(lineno)d]`, which has no
   TypeScript equivalent. No module shares the logger yet, because no other module logs
   through `main()`; `scanner.ts` still uses `console.debug`, which ADR 0007 rule 3
   anticipated.

## Alternatives considered

- **TypeScript decorators with `emitDecoratorMetadata`.** Rejected: it needs
  `experimentalDecorators` (or the legacy decorator transform), a `reflect-metadata`
  runtime dependency, and it hides the field order that fixes the order of `--help`. The
  static array is visible in the same file as the class.
- **A schema object separate from the class.** Rejected for the same reason ADR 0007 rule
  6 rejects a generic front-matter deserializer for `scanner.ts`: a second declaration of
  the same fields can drift from the class. `ProcessorOptions` would end up with its
  defaults in two places.
- **Hand-written `addOption` calls in `__main__.ts` instead of walking the classes.**
  Rejected: it is how upstream chose _not_ to write `clio.py`, and it would make
  `options_converter.ts`'s converter options a second hand-maintained list.
- **Two commander keys for a `skip-`/`keep-` pair, resolving by "positive wins".**
  Rejected: it was what the first cut of this port did, and it loses upstream's
  last-flag-wins behaviour (`--keep-update --skip-update` came out as `skipUpdate: true`).
- **Accepting `-r` and `--ignore-invalid-url` for compatibility.** Rejected: there are no
  users to be compatible with, and a flag that is accepted and ignored is what plan §3
  rules out.

## Consequences

- A reviewer can diff `clio.ts` against `clio.py` function by function, with the one
  documented difference being where the metadata comes from (decision 1).
- Every options class grows a static `fields` array. A later issue that adds a field to
  `ConverterOptions` or `ProcessorOptions` has to add the entry in the same change; the
  test in `tests/test_main.test.ts` fails when only one of the two happens.
- `--root-page` reads an environment variable upstream does not, so a deployment that sets
  `CONFLUENCE_PAGE_ID` for another tool gets a parent page it did not ask for. Decision 6
  says so; this is the accepted cost of the board's ruling.
- No module shares the logger, so `--loglevel` does not reach `scanner.ts`. A follow-up
  should give the modules a shared logger before C11 needs one.
