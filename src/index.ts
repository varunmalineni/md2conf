// Port of md2conf/__init__.py from hunyadi/md2conf (MIT; see NOTICE.md).
//
// Upstream hard-codes `__version__` in `__init__.py` and lets its build read it
// from there. This package keeps `package.json` as the single source of truth
// for the version (ADR 0005), so the constant reads it at run time. The lookup
// is relative to this module rather than to `process.argv[1]`, which keeps it
// correct when the `md2conf` bin is reached through a symlink.

import { readFileSync } from 'node:fs';

interface PackageManifest {
  readonly version: string;
}

/** `src/index.ts` and the built `dist/index.js` both sit one level below the package root. */
const manifest = new URL('../package.json', import.meta.url);

/** Program version, as upstream's `__version__`. */
export const version: string = (JSON.parse(readFileSync(manifest, 'utf8')) as PackageManifest)
  .version;
