# ADR 0007: Alerts, task lists and footnotes render in upstream's element vocabulary

- Status: Accepted (Tech Lead ruling on ZER-53, 2026-10-14)
- Context issues: ZER-31, ZER-53; review of PR #4 (finding 5)
- Amends: ADR 0002, ADR 0005

## Context

ADR 0002 §1 picked `@mdit/plugin-alert`, `@mdit/plugin-tasklist` and `@mdit/plugin-footnote` for three extensions in our dialect (ADR 0003 §1). ADR 0002 §2 also requires the renderer to emit the element vocabulary Python-Markdown emits, so that `converter.ts` can follow `converter.py`. ADR 0006 requires the same behaviour as upstream. The review of PR #4 showed that two of the three plugins break §2.

Upstream (`70aa709`) has no alert or task-list extension. `converter.py` reads both from plain text:

| construct | what `converter.py` reads | plain markdown-it | `@mdit` plugin |
|---|---|---|---|
| GitHub alert | `<blockquote><p>[!NOTE] …` (`_split_github_alert_groups`, `_transform_github_alert`) | same | `<div class="markdown-alert …"><p class="markdown-alert-title">` |
| GitLab alert | `<blockquote><p>FLAG: …` (`_transform_gitlab_alert`) | same | not handled |
| task list | `<li>` whose text starts `[x]` or `[ ]` (`_transform_tasklist`) | same | `<li class="task-list-item"><input …><label …>` |
| footnote ref | `<sup id="fnref:NAME"><a class="footnote-ref" href="#fn:NAME">N</a></sup>`, repeats `fnref2:NAME`, `fnref3:NAME` | not supported | `<sup class="footnote-ref"><a href="#footnote1">[1]</a>…` |
| footnote def | `<div class="footnote"><hr /><ol><li id="fn:NAME">…<a class="footnote-backref" href="#fnref:NAME">` | not supported | `<section class="footnotes"><ol class="footnotes-list"><li id="footnote1" …>` |

For footnotes the plugin's default output loses information as well as shape. Upstream builds Confluence anchors from the footnote **label** (`footnote-ref-string`, `footnote-ref-multi-2`, `footnote-def-multi`; see `tests/target/footnote.xml`). The plugin's ids are numbers, so a converter written against its HTML would produce different anchor names. Links to those anchors would break when a page moves from upstream to us. The plugin's tokens still carry the label (`meta.label`, plus `meta.id` and `meta.subId` for numbering and repeated references), so only its render rules are a problem. Its parser is not.

## Decision

1. **Alerts: no plugin.** Drop `@mdit/plugin-alert`. markdown-it's own block quote output is what `converter.py` reads, for GitHub and GitLab alerts alike.
2. **Task lists: no plugin.** Drop `@mdit/plugin-tasklist`. markdown-it's own list output is what `converter.py` reads.
3. **Footnotes: keep `@mdit/plugin-footnote` for parsing and replace its render rules** in `src/markdown.ts`. The rules are `footnote_ref`, `footnote_block_open`, `footnote_block_close`, `footnote_open`, `footnote_close` and `footnote_anchor`. They emit the HTML of Python-Markdown's `footnotes` extension with `BACKLINK_TITLE: ""`, keyed by `meta.label`:
   - reference: `<sup id="fnref:LABEL">`, or `fnref{subId+1}:LABEL` for a repeated reference, wrapping `<a class="footnote-ref" href="#fn:LABEL">N</a>`;
   - definitions: `<div class="footnote"><hr /><ol><li id="fn:LABEL">…</li></ol></div>`, with one `<a class="footnote-backref" href="#fnref…:LABEL" title="">↩</a>` per reference.
   The exact attribute set and whitespace come from running upstream's Python-Markdown configuration on `tests/source/footnote.md`, not from this ADR.
4. **Inline footnotes (`^[text]`) are disabled** (`footnoteInline` rule). Python-Markdown has no such syntax, and ADR 0006 adds no behaviour.
5. **Result:** the `alert`, `tasklist` and `footnote` golden fixtures are `match` in `tests/fixtures/manifest.json`, and `docs/dialect.md` gets no rows for these constructs. If a fixture can't match, the Engineer raises it on the issue before adding an `override`. One known case is footnote numbering when references come in a different order from definitions, if the plugin and Python-Markdown disagree there.

## Amendments to earlier ADRs

- **ADR 0002 §1:** the `@mdit/plugin-*` list becomes footnotes only, plus sub/sup/ins/mark if those are accepted. Alerts and task lists need no rule of ours.
- **ADR 0005:** the runtime dependency row loses `@mdit/plugin-alert` and `@mdit/plugin-tasklist`.
- ADR 0003 §1 is unchanged. Alerts, task lists and footnotes stay in the dialect. Only their implementation changes.

## Alternatives considered

- **Keep all three plugins and adapt the converter (option b on ZER-53).** No renderer code, but `_transform_github_alert`, `_transform_tasklist` and both footnote transforms would diverge from `converter.py`. The GitLab alert path would need writing anyway. Every fixture for these constructs would become an `override`, and footnote anchor names would differ from upstream's in published pages. Rejected under ADR 0006.
- **Write our own footnote parser that mimics Python-Markdown.** Gives the same HTML as decision 3, but it also reimplements definition parsing, label normalisation, numbering and repeated-reference tracking that the plugin already does correctly. More code to test for no difference in output. Rejected.
- **Keep the plugin's footnote output and map numeric ids back to labels in the converter.** The label isn't in the HTML, so the converter can't recover it without a side channel from the renderer. That is an abstraction upstream doesn't have. Rejected.

## Consequences

- C8 and C9 port `_transform_github_alert`, `_transform_gitlab_alert`, `_transform_tasklist`, `_transform_footnote_ref` and `_transform_footnote_def` from `converter.py` as they are.
- `src/markdown.ts` owns about six small render rules for footnotes. They are tested against Python-Markdown's HTML for the footnote fixture.
- Two fewer runtime dependencies.
- If a later `@mdit/plugin-footnote` release renames its tokens or `meta` fields, our render rules break loudly in the footnote fixture test, not silently.
