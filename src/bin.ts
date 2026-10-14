#!/usr/bin/env node

// The console script pip generates from upstream's
// `md2conf = "md2conf.__main__:main"`: it hands `process.argv` to `main()` and
// uses its return value as the exit code.

import { main } from './__main__.js';

process.exitCode = main(process.argv);
