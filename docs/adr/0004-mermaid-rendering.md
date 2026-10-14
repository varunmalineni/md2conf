# ADR 0004: Mermaid rendering through the `mmdc` subprocess

- Status: Accepted (board accepted the ZER-28 plan, 2026-10-14); amended by ADR 0006
- Context issues: ZER-27 §3.4.1, ZER-28

## Context

Mermaid diagrams can be published in two ways:

- **Rendered:** turned into a PNG or SVG image that is uploaded as an attachment.
- **Not rendered:** kept as source inside a Confluence marketplace macro (`--no-render-mermaid`).

Mermaid measures text with `getBBox()`, so rendering it needs a real browser. Upstream runs `mmdc` (`@mermaid-js/mermaid-cli`, which runs Chromium through Puppeteer) as a subprocess:

- It sends the diagram source on stdin and reads the image from stdout.
- It passes `--outputFormat png|svg`, `--backgroundColor transparent` and `--scale <n>` (default 2).
- The `MERMAID_CMD` environment variable overrides the command.
- Its `mermaid` Docker image installs `mmdc` and a system Chromium.

## Decision

1. Put rendering behind a small `MermaidRenderer` interface: `render(source, format, config)` returns the image bytes.
2. The MVP implementation runs **`mmdc` as a subprocess** with the same arguments, discovery order (`MERMAID_CMD`, then `mmdc` on `PATH`) and error messages as upstream.
3. `@mermaid-js/mermaid-cli` is **not** a dependency of our npm package. Only the `mermaid` Docker image installs it.
4. Marketplace-macro mode (`--no-render-mermaid`) needs no renderer and works in the base install.
5. Unit tests use a fake `MERMAID_CMD` script. One CI job renders a real diagram inside the `mermaid` Docker image.

## Alternatives considered

- **Calling mermaid-cli in-process (`renderMermaid` with one shared Puppeteer browser).**
  - Faster when there are many diagrams, because Chromium starts once instead of once per diagram.
  - Rejected for the MVP: it would pull Puppeteer and a Chromium download into every npm install, including installs that never render Mermaid.
  - The `MermaidRenderer` interface keeps this open as a post-MVP optimisation.
- **mmdr / mermaid-rs-renderer (no browser).** It covers fewer diagram types, its output differs visually from Mermaid, and it's young. Rejected.
- **Remote renderers (Kroki, mermaid.ink).** They would send document content to a third-party service and add a new external dependency. Rejected.

## Consequences

- Upstream users keep their setup: same `MERMAID_CMD`, same Docker pattern, same output flags.
- Each diagram costs one Chromium start (about 1–3 s), the same as upstream.
- The base Docker image and the npm package stay small. Only the `mermaid` image carries Node, Chromium and fonts.
