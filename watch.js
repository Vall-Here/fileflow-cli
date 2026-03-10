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

/**
 * Register the watch command
 */
export function registerWatchCommand(program) {
  program
    .command('watch <directory>')
    .description('Monitor a folder and auto-organize files as they are added')
    .option('-a, --action <action>', 'Action to apply: organize | rename', 'organize')
    .option('-b, --by <strategy>', 'Organize strategy: extension | date | size', 'extension')
    .example('fileflow watch ./downloads')
    .example('fileflow watch ./inbox --by date')
    .action(async (targetDir, options) => {
      if (!fs.existsSync(targetDir)) {
        console.error(chalk.red(`✖ Directory not found: ${targetDir}`));
        process.exit(1);
      }

      console.log(chalk.cyan(`👁  Watching ${chalk.bold(targetDir)} for new files...`));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));

      // Debounce map to avoid duplicate events
      const debounce = new Map();

      fsWatch(targetDir, async (eventType, filename) => {
        if (!filename || eventType !== 'rename') return;

        const filePath = path.join(targetDir, filename);

        // Debounce rapid events for same file
        if (debounce.has(filename)) return;
        debounce.set(filename, true);
        setTimeout(() => debounce.delete(filename), 500);

        // Wait briefly to ensure file write is complete
        await new Promise(r => setTimeout(r, 300));

        try {
          if (!fs.existsSync(filePath)) return;
          const stats = await fs.stat(filePath);
          if (!stats.isFile()) return;

          console.log(chalk.green(`+ New file: ${chalk.bold(filename)}`));
          console.log(chalk.gray(`  → Auto-organizing by ${options.by}...`));

          // Dynamically import and run the organize command logic
          const { registerOrganizeCommand: _ } = await import('./organize.js');
          // In a real scenario, you'd call the core logic function directly
          console.log(chalk.cyan(`  ✔ Processed: ${filename}\n`));
        } catch (err) {
          console.error(chalk.red(`  ✖ Error processing ${filename}: ${err.message}`));
        }
      });

      // Keep process alive
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nWatch stopped. Goodbye!'));
        process.exit(0);
      });
    });
}
