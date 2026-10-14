# ADR 0007: Post-MVP trimming and deferrals when porting a module

- Status: Proposed (raised by Engineer 3 on ZER-32, 2026-10-14; needs the Tech Lead)
- Context issues: ZER-32 (C4), ZER-28 plan revision 3 §3
- Read with: ADR 0006 (mirror upstream's module structure)

## Context

ADR 0006 asks for one TypeScript module per upstream module, with the same classes and
functions, so a reviewer can diff the two side by side. The MVP is smaller than upstream
v0.6.4: plan §3 lists Confluence folders, PlantUML, draw.io, LaTeX, user mentions,
Marketplace extensions and Confluence Web UI links as non-goals, and STANDARDS.md §2
forbids code that nothing calls. Both rules pull in opposite directions on a module that
carries options and properties for features that have not landed.

Two more differences need a decision. Upstream validates front-matter with cattrs over the
data PyYAML's `safe_load` returns, and ADR 0006 does not port `serializer.py`. And upstream's
logger is Python's `logging`; we have no logging setup yet, because C7 ports `__main__.py`.

## Decision

1. **Options and properties for post-MVP features are left out, not stubbed.** They are added
   when the feature lands. `ConverterOptions` therefore has no `renderDrawio`, `renderPlantuml`,
   `renderLatex`, `renderOther`, `webuiLinks`, `userMentions` or `extensions`, and
   `DocumentProperties` has no `folderId` or `contentType`. Defaults and field names of the
   fields that stay match upstream exactly.
2. **Functions with no caller in the MVP are left out until their first caller.** Upstream's
   `extract_frontmatter_object` is only used by the Mermaid and PlantUML scanners, and
   `coalesce_json` only by the publisher. They arrive with those modules.
3. **Front-matter keys and comments the scanner does not know are ignored, not rejected, and
   are logged at debug.** Upstream ignores extra front-matter keys silently (cattrs runs with
   `forbid_extra_keys=False`); the debug line is what makes an unsupported key visible instead
   of mysterious. The scanner writes it with `console.debug` for now; C7 (`__main__.ts`) owns
   the logging setup and may route it through the project's logger, which is a change inside
   `scanner.ts` only.
4. **Front-matter is read with PyYAML's YAML 1.1 dialect, and scalars are coerced the way cattrs
   coerces them.** `yaml` parses the front-matter with `version: '1.1'` and `stringKeys`, so
   `yes` is a boolean, `007` is octal, `1_000` is one thousand and a mapping key is the text the
   author wrote, as PyYAML reads them. The scanner then coerces a scalar to the type of the field
   it fills, the way cattrs does: a number or a date becomes a string (`page_id: 12345` is the
   page ID 12345), a float truncates to an integer, `0` and the empty string are false, and a
   single scalar becomes a one-element list. Two Python artefacts are deliberately not copied:
   - a boolean reads as `true` in a string field, where Python's `str(True)` is `True`;
   - `tags: markdown` is one tag, where cattrs iterates the string and produces one tag per
     character.

   Neither is a behaviour anyone wants, and both only show up in a document that is already
   wrong. A YAML 1.1 `y` or `n` is a boolean here and a string in PyYAML, which makes
   `synchronized: n` false here and true upstream.

5. **Where upstream relies on a library we do not port, the module owns the equivalent code.**
   Upstream validates front-matter with `json_to_object` (cattrs), and ADR 0006 replaces
   `serializer.py` with zod schemas in `api_types.ts`, so `scanner.ts` reads each front-matter key
   itself and throws a `TypeError` on a value it cannot coerce. The upstream JSON value type
   (`serializer.JsonType`) is declared as `JsonValue` in `frontmatter.ts`, the first module that
   needs it.
6. **Front-matter structure stays in the scanner.** `DocumentProperties`, `AliasProperties` and
   `LayoutOptions` are built from raw front-matter data in `scanner.ts`, next to the only caller,
   rather than through a generic de-serializer no other module would use.
7. **`coalesceDataclass` follows upstream exactly.** It recurses into a field only when the value
   is a class instance (upstream tests the declared field type with `dataclasses.is_dataclass`),
   never into a plain mapping such as `properties`, and it copies a value it takes from the source
   so the result shares nothing with the source, as `deepcopy` does.

## Alternatives considered

- **Port everything and disable post-MVP features with flags.** Rejected: it adds code for
  features the plan rules out, and STANDARDS.md §2 forbids dead code paths.
- **Keep the fields but mark them as unused placeholders.** Rejected for the same reason, and
  the option defaults would then be copied twice.
- **Use zod for front-matter as well as for API responses.** Rejected: ADR 0006 scopes zod to
  `api_types.ts`, and front-matter parsing would then depend on a schema library upstream does
  not use.
- **Reject unknown front-matter keys with an error.** Rejected: upstream is permissive here, and
  a document that uses a key from a later release should still scan.
- **Parse with YAML 1.2 and coerce what needs coercing.** Rejected: it reads `synchronized: no`
  as the string `no`, which is true, where upstream reads false. The dialect is PyYAML's, not the
  package's default.
- **Copy Python's `True` and its one-tag-per-character list.** Rejected as deliberate
  divergences, recorded above; either is a one-line change if a later decision says otherwise.

## Consequences

- A reviewer diffing a module against upstream finds the post-MVP parts missing by design, and
  this record says where they will come back.
- The front-matter dialect is PyYAML's, not `yaml`'s default. A front-matter file that relies on
  a YAML 1.1 reading keeps that reading; one that relies on a YAML 1.2 reading (an unquoted
  `2024-01-01` staying a string) may differ, and the test suite pins the cases.
- Ported tests cover only MVP behaviour, so a later issue that adds a feature also has to add
  its test.
- An unsupported key or comment in a document is silently dropped from the result and shows up
  in debug logs only.
