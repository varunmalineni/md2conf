# ADR 0006: Mirror upstream's module structure, one module per module

- Status: Accepted (board direction on ZER-28, 2026-10-14)
- Context issues: ZER-25, ZER-28
- Amends: ADR 0002, ADR 0004, ADR 0005

## Context

After the board accepted the ZER-28 plan, it added this direction: keep the whole architecture and behaviour exactly as in upstream md2conf, and add no new options. The task is to rewrite the same tool in another language.

The accepted plan already ruled out new options and kept upstream's pipeline. Its source layout, though, was our own: feature folders such as `src/converter/` and `src/publish/`. It also added a few internal abstractions upstream doesn't have, such as a `MermaidRenderer` interface and a `PageIndex` type. A reviewer comparing our code with upstream would need a map from one structure to the other.

## Decision

1. **One TypeScript module per upstream module, with the same name.**
   - `md2conf/X.py` becomes `src/X.ts`.
   - Subpackages become folders, e.g. `md2conf/mermaid/render.py` becomes `src/mermaid/render.ts`.
   - `md2conf/__main__.py` becomes `src/__main__.ts` (the CLI entry point), and `md2conf/__init__.py` becomes `src/index.ts`.
2. **Same classes and functions, in the same module.**
   - Each upstream class or function becomes the TS class or function with the same name and responsibility. Class names stay PascalCase. Functions, methods and fields are translated mechanically from snake_case to camelCase (`elements_from_string` becomes `elementsFromString`).
   - Data classes become TS classes or interfaces with the same fields.
   - We add no abstraction layer upstream doesn't have.
3. **Tests mirror upstream.**
   - `tests/test_X.py` becomes `tests/test_X.test.ts`, and `tests/utility.py` becomes `tests/utility.ts`.
   - Fixtures keep their upstream paths (`tests/source`, `tests/target`, `tests/scanner`) and are copied verbatim.
4. **Modules for post-MVP features are not ported yet.** These include `api_v1.py`, `comment.py`, `order.py`, `latex.py`, `emoticon.py`, `plantuml/` and `drawio/`. When those features are scheduled, they follow the same rule.
5. **Where Python and TS need different mechanisms, the swap stays inside the module that owns it.** The public shape of that module doesn't change.
   - `csf.ts` turns named entities into numeric ones (`entities`), where upstream loads an entities DTD into lxml. See ADR 0002.
   - `api_types.ts` validates JSON with zod schemas, where upstream uses dataclass deserialisation (`serializer.py`, `reflection.py`). Those two upstream modules are not ported.
   - `api.ts` ports `RetryAdapter`'s policy on top of `fetch`, where upstream uses requests/urllib3.
   - `matcher.ts` uses `ignore` as the equivalent of `pathspec.GitIgnoreSpec`.
   - `__main__.ts` and `clio.ts` use commander in place of argparse.

## Amendments to earlier ADRs

- **ADR 0002:** the DOM boundary is `src/csf.ts` plus `src/xml.ts`, not a `src/csf/` folder. The pipeline itself is unchanged.
- **ADR 0004:** there is no `MermaidRenderer` interface. Port `mermaid/render.py` (`get_mmdc`, `has_mmdc`, `render_diagram`) and upstream's extension path (`extension.py`, `diagram.py`, `mermaid/extension.py`, `mermaid/scanner.py`, `mermaid/config.py`) as they are. The `mmdc` subprocess decision is unchanged. An in-process renderer would be a future change to `render.ts` alone.
- **ADR 0005:** drop `image-size`. Image dimensions come from ports of upstream's own `png.py`, `svg.py` and `jpeg.py`.

## Alternatives considered

- **Keep the feature-folder layout from the plan.** It's more idiomatic for TS, but every review would need an upstream-to-ours map, and it goes against the board's direction. Rejected.
- **Mirror the structure but split `converter.py` (about 2,100 lines) into several files.** That would ease parallel work. Rejected: it breaks the one-to-one mapping. The parallel-work cost is handled below.

## Consequences

- A reviewer can diff each TS module against its Python counterpart, function by function.
- Upstream fixes can be carried over file by file.
- `src/converter.ts` becomes one large module that several MVP issues edit, often at the same time. Each issue adds its own methods plus the matching branches in the visitor's dispatch, and rebases on `main` before review. The conflicts that remain are small and confined to the dispatch.
- Some TS reads less idiomatically, such as `__main__.ts` and snake_case file names. We accept that in exchange for traceability.
