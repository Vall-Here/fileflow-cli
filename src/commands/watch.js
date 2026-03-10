/**
 * watch.js - Monitor a folder and auto-organize new files
 *
 * Usage:
 *   fileflow watch ./downloads
 *   fileflow watch ./inbox --action organize --by date
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { watch as fsWatch } from 'fs';
import { organizeFiles } from './organize.js';

/**
 * Register the watch command
 * @param {import('commander').Command} program
 */
export function registerWatchCommand(program) {
  program
    .command('watch <directory>')
    .description('Monitor a folder and auto-organize files as they are added')
    .option('-a, --action <action>', 'Action to apply: organize | rename', 'organize')
    .option('-b, --by <strategy>', 'Organize strategy: extension | date | size', 'extension')
    .addHelpText('after', `
Examples:
  $ fileflow watch ./downloads
  $ fileflow watch ./inbox --by date`)
    .action(async (targetDir, options) => {
      if (!fs.existsSync(targetDir)) {
        console.error(chalk.red(`✖ Directory not found: ${targetDir}`));
        process.exit(1);
      }

      const resolvedDir = path.resolve(targetDir);

      console.log(chalk.cyan(`👁  Watching ${chalk.bold(resolvedDir)} for new files...`));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));

      // Debounce map to avoid duplicate events per file
      const debounce = new Map();

      fsWatch(resolvedDir, async (eventType, filename) => {
        if (!filename || eventType !== 'rename') return;

        const filePath = path.join(resolvedDir, filename);

        // Debounce rapid events for the same file (500ms window)
        if (debounce.has(filename)) return;
        debounce.set(filename, true);
        setTimeout(() => debounce.delete(filename), 500);

        // Wait briefly to ensure the file write is complete
        await new Promise(r => setTimeout(r, 300));

        try {
          if (!fs.existsSync(filePath)) return;
          const stats = await fs.stat(filePath);
          if (!stats.isFile()) return;

          const timestamp = new Date().toLocaleTimeString();
          console.log(`${chalk.gray(timestamp)} ${chalk.green('+')} ${chalk.bold(filename)}`);

          if (options.action === 'organize') {
            await organizeFiles(resolvedDir, { by: options.by, dryRun: false, recursive: false, verbose: false });
            console.log(chalk.cyan(`  ✔ Organized: ${filename}\n`));
          }
        } catch (err) {
          console.error(chalk.red(`  ✖ Error processing ${filename}: ${err.message}`));
        }
      });

      // Keep process alive and handle graceful exit
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nWatch stopped. Goodbye! 👋'));
        process.exit(0);
      });
    });
}
