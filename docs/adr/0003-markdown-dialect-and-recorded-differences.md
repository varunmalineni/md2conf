# ADR 0003: Markdown dialect and how differences from upstream are recorded

- Status: Accepted (board accepted the ZER-28 plan, 2026-10-14)
- Context issues: ZER-27 §3.4.3, ZER-28

## Context

Upstream parses Python-Markdown with `admonition`, `footnotes`, `tables`, `md_in_html`, `sane_lists` and several pymdownx extensions. Python-Markdown is not CommonMark. For example, it needs 4-space indentation for nested lists, and it parses Markdown inside HTML tagged `markdown="1"`. No TypeScript parser reproduces this dialect (ADR 0002). Some documents will convert differently from upstream. Users need to know exactly where, and reviewers need a rule for when a difference is acceptable.

## Decision

1. **Dialect.** We use CommonMark as implemented by markdown-it, with GFM tables and strikethrough, plus these extensions:
   - autolinks (linkify)
   - GitHub/GitLab alerts
   - task lists
   - footnotes
   - `!!!` admonitions (Python-Markdown syntax)
   - `csf` and `mermaid` fences
   - `[[_TOC_]]` and `[[_LISTING_]]`

   We add more extensions only through an issue.
2. **One list of differences.** `docs/dialect.md` holds a table with one row per known difference: the construct, upstream output, our output, the reason, and the fixture that shows it.
3. **Fixture manifest.** Every upstream golden fixture appears in `tests/fixtures/manifest.json` with exactly one status:
   - `match`: our canonicalised output must equal upstream's `tests/target/<name>.xml`.
   - `override`: a **permanent** dialect difference. The expected output lives in `tests/fixtures/overrides/<name>.xml`, and a test fails if the fixture has no matching row in `docs/dialect.md`.
   - `pending`: the feature is post-MVP. The test is skipped, and the manifest entry names the follow-up issue.
4. **Who decides.** An Engineer may propose an `override` in a PR. The Reviewer accepts it only if the difference comes from the parser and not from a converter bug. The Tech Lead settles disputes.

## Alternatives considered

- **Emulating Python-Markdown quirks (4-space lists, `md_in_html` everywhere).** Rejected. It means fighting CommonMark in every list rule, and it leaves users with a dialect no editor previews correctly.
- **Free-form notes in PRs.** Rejected. They can't be checked, and users would never find them.

## Consequences

- Moving from upstream is predictable. Users read one page (`docs/dialect.md`) to see what changes.
- The manifest makes MVP coverage visible: the `pending` count goes down as features land.
- Some existing documents need small edits, mostly list indentation and Markdown inside HTML without blank lines. These are listed in `docs/dialect.md`.
