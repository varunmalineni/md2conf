# ADR 0001: TypeScript on Node.js LTS

- Status: Accepted (board decision on ZER-25, 2026-10-14)
- Context issues: ZER-25, ZER-27 (language analysis), ZER-28 (MVP plan)

## Context

This project rewrites [hunyadi/md2conf](https://github.com/hunyadi/md2conf) v0.6.4 (Python, MIT) from scratch. ZER-27 compared TypeScript, Rust and Go. Things that hold in any language:

- Mermaid needs a JavaScript runtime and a headless browser.
- PlantUML and draw.io run as subprocesses.
- Nobody outside Python implements upstream's Python-Markdown dialect.
- The workload waits on I/O (Confluence REST calls and diagram subprocesses), so CPU speed doesn't decide anything.

## Decision

Write md2conf in **TypeScript** (`strict` mode) on **Node.js LTS**. Ship it as an npm package with an `md2conf` executable and as Docker images. The first version supports only **Confluence Cloud** (REST v2, plus the v1 endpoints that upstream's v2 mode still calls).

## Alternatives considered

- **Rust.** It produces a small static binary and has strong compile-time guarantees. But there is no mature mutable XML DOM, no LaTeX renderer, and the parser can't be extended for `!!!` admonitions. ZER-27 estimates about 1.5× the effort of TypeScript.
- **Go.** It also produces a single binary, but its XML DOM is weak and it has the same LaTeX gap as Rust. It doesn't beat TypeScript on ecosystem fit or Rust on guarantees.

## Consequences

- Users need Node.js or Docker. A single-binary release is post-MVP.
- Responses from the Confluence API are validated at runtime with schemas, because the compiler can't check what the API returns.
- npm brings supply-chain exposure. We keep the dependency set small and pinned (ADR 0005).
- Confluence Data Center/Server (REST v1 mode) is out of scope for the MVP. Adding it later needs a test instance.
