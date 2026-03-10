#!/usr/bin/env node

/**
 * FileFlow CLI - Smart File Organizer & Bulk Processor
 * Entry point for the CLI application
 */

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

// Import commands
import { registerOrganizeCommand } from '../src/commands/organize.js';
import { registerRenameCommand } from '../src/commands/rename.js';
import { registerConvertCommand } from '../src/commands/convert.js';
import { registerDuplicatesCommand } from '../src/commands/duplicates.js';
import { registerWatchCommand } from '../src/commands/watch.js';

// CLI setup
program
  .name('fileflow')
  .description('🚀 Smart file organizer, bulk renamer, and data converter')
  .version(version, '-v, --version', 'Show current version');

// Register all commands
registerOrganizeCommand(program);
registerRenameCommand(program);
registerConvertCommand(program);
registerDuplicatesCommand(program);
registerWatchCommand(program);

// Show help if no command given
if (process.argv.length === 2) {
  program.outputHelp();
}

program.parse(process.argv);
