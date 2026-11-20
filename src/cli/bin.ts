#!/usr/bin/env node
// The installed command (TODO 5.1): package.json's `bin` names this file's build, `dist/cli/bin.js`, as `ghostreach`; it runs
// `main` with the words typed after it and ends with its exit code. Nothing else: the command line is main.ts's (GR-003).
import { main } from './main.js';

process.exitCode = await main(process.argv.slice(2));
