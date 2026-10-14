# ADR 0007: Post-MVP trimming and deferrals when porting a module

- Status: Accepted (Engineer 3 on ZER-32, 2026-10-14)
- Context issues: ZER-32 (C4), ZER-28 plan revision 3 §3
- Amends: ADR 0006

## Context

ADR 0006 asks for one TypeScript module per upstream module, with the same classes and
functions, so a reviewer can diff the two side by side. The MVP is smaller than upstream
v0.6.4: plan §3 lists Confluence folders, PlantUML, draw.io, LaTeX, user mentions,
Marketplace extensions and Confluence Web UI links as non-goals, and STANDARDS.md §2
forbids code that nothing calls. Both rules pull in opposite directions on a module that
carries options and properties for features that have not landed.

## Decision

1. **Options and properties for post-MVP features are left out, not stubbed.** They are added
   when the feature lands. `ConverterOptions` therefore has no `renderDrawio`, `renderPlantuml`,
   `renderLatex`, `renderOther`, `webuiLinks`, `userMentions` or `extensions`, and
   `DocumentProperties` has no `folderId` or `contentType`. Defaults and field names of the
   fields that stay match upstream exactly.
2. **Functions with no caller in the MVP are left out until their first caller.** Upstream's
   `extract_frontmatter_object` is only used by the Mermaid and PlantUML scanners, and
   `coalesce_json` only by the publisher and the API client. They arrive with those modules.
3. **Front-matter keys and comments the scanner does not know are ignored, not rejected, and
   are logged at debug.** Upstream ignores extra front-matter keys silently (cattrs runs with
   `forbid_extra_keys=False`); the debug line is what makes an unsupported key visible instead
   of mysterious.
4. **Where upstream relies on a library we do not port, the module owns the equivalent code.**
   Upstream validates front-matter with `cattrs`, and ADR 0006 replaces `serializer.py` with
   zod schemas in `api_types.ts`, so `scanner.ts` reads each front-matter key itself and throws
   a `TypeError` on a value of the wrong type. The upstream JSON value type (`serializer.JsonType`)
   is declared as `JsonValue` in `frontmatter.ts`, the first module that needs it.
5. **Front-matter structure stays in the scanner.** `DocumentProperties`, `AliasProperties` and
   `LayoutOptions` are built from raw front-matter data in `scanner.ts`, next to the only caller,
   rather than through a generic de-serializer no other module would use.

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

## Consequences

- A reviewer diffing a module against upstream finds the post-MVP parts missing by design, and
  this record says where they will come back.
- Ported tests cover only MVP behaviour, so a later issue that adds a feature also has to add
  its test.
- An unsupported key or comment in a document is silently dropped from the result and shows up
  in debug logs only.
