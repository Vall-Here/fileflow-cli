/**
 * organize.js - Auto-sort files into folders by extension, date, or size
 *
 * Usage:
 *   fileflow organize ./downloads
 *   fileflow organize ./downloads --by date
 *   fileflow organize ./downloads --by size --dry-run
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import ora from 'ora';
import chalk from 'chalk';
import { formatBytes, getFileDate } from '../utils/fileHelpers.js';
import { logSummary } from '../utils/logger.js';

// File type categories mapping extensions to folder names
export const FILE_CATEGORIES = {
  images:      ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp'],
  videos:      ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'],
  audio:       ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
  documents:   ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md'],
  data:        ['.csv', '.json', '.xml', '.yaml', '.yml', '.sql'],
  archives:    ['.zip', '.rar', '.tar', '.gz', '.7z', '.bz2'],
  code:        ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.php', '.rb'],
  executables: ['.exe', '.msi', '.dmg', '.deb', '.rpm', '.sh'],
};

/**
 * Determine category folder for a file based on its extension
 * @param {string} ext - File extension (e.g. '.jpg')
 * @returns {string} - Category name (e.g. 'images') or 'others'
 */
export function getCategoryByExtension(ext) {
  const lowerExt = ext.toLowerCase();
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(lowerExt)) return category;
  }
  return 'others';
}

/**
 * Determine destination folder based on organize strategy
 * @param {string} filePath - Full path to file
 * @param {'extension'|'date'|'size'} strategy - How to organize
 * @returns {string} - Subfolder name
 */
export function getDestinationFolder(filePath, strategy) {
  const ext = path.extname(filePath);
  const stats = fs.statSync(filePath);

  switch (strategy) {
    case 'date': {
      const date = getFileDate(stats);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    case 'size': {
      const bytes = stats.size;
      if (bytes < 1024 * 1024)       return 'small (< 1MB)';
      if (bytes < 10 * 1024 * 1024)  return 'medium (1-10MB)';
      if (bytes < 100 * 1024 * 1024) return 'large (10-100MB)';
      return 'huge (> 100MB)';
    }
    case 'extension':
    default:
      return getCategoryByExtension(ext);
  }
}

/**
 * Main organize function
 * @param {string} targetDir - Directory to organize
 * @param {{ by: string, dryRun: boolean, recursive: boolean, verbose: boolean }} options
 */
export async function organizeFiles(targetDir, options) {
  const { by: strategy = 'extension', dryRun = false, verbose = false } = options;

  // Validate target directory
  if (!fs.existsSync(targetDir)) {
    console.error(chalk.red(`✖ Directory not found: ${targetDir}`));
    process.exit(1);
  }

  const spinner = ora(`Scanning files in ${chalk.cyan(targetDir)}...`).start();

  // Get all files (non-recursive by default)
  const resolvedTarget = path.resolve(targetDir).replace(/\\/g, '/');
  const pattern = options.recursive
    ? `${resolvedTarget}/**/*`
    : `${resolvedTarget}/*`;

  const files = await glob(pattern, { nodir: true });
  spinner.succeed(`Found ${chalk.bold(files.length)} files`);

  if (files.length === 0) {
    console.log(chalk.yellow('No files to organize.'));
    return;
  }

  // Plan moves
  const moves = [];
  for (const filePath of files) {
    const folder = getDestinationFolder(filePath, strategy);
    const destDir = path.join(targetDir, folder);
    const destPath = path.join(destDir, path.basename(filePath));

    // Skip if file is already in correct location
    if (path.dirname(path.resolve(filePath)) === path.resolve(destDir)) continue;

    moves.push({ from: filePath, to: destPath, folder });
  }

  if (moves.length === 0) {
    console.log(chalk.green('✔ All files are already organized!'));
    return;
  }

  // Preview or execute
  if (dryRun) {
    console.log(chalk.yellow('\n📋 DRY RUN — No files will be moved:\n'));
    moves.forEach(({ from, to }) => {
      console.log(`  ${chalk.gray(path.basename(from))} → ${chalk.cyan(path.relative(targetDir, to))}`);
    });
    console.log(chalk.yellow(`\n  Total: ${moves.length} files would be moved`));
    return;
  }

  // Execute moves with progress
  const moveSpinner = ora('Organizing files...').start();
  const results = { success: 0, skipped: 0, errors: [] };

  for (const { from, to, folder } of moves) {
    try {
      await fs.ensureDir(path.dirname(to));

      // Handle filename conflicts by appending a timestamp
      let finalDest = to;
      if (await fs.pathExists(to)) {
        const ext = path.extname(to);
        const base = path.basename(to, ext);
        finalDest = path.join(path.dirname(to), `${base}_${Date.now()}${ext}`);
        results.skipped++;
      }

      await fs.move(from, finalDest);
      results.success++;

      if (verbose) {
        moveSpinner.text = `Moving: ${chalk.gray(path.basename(from))} → ${chalk.cyan(folder)}`;
      }
    } catch (err) {
      results.errors.push({ file: from, error: err.message });
    }
  }

  moveSpinner.succeed('Files organized!');

  // Summary
  logSummary([
    { label: '✔ Moved',   value: results.success,        color: 'green' },
    { label: '⚠ Renamed', value: results.skipped,        color: 'yellow' },
    { label: '✖ Errors',  value: results.errors.length,  color: 'red' },
  ]);

  if (results.errors.length > 0 && verbose) {
    console.log(chalk.red('\nErrors:'));
    results.errors.forEach(({ file, error }) => {
      console.log(`  ${file}: ${error}`);
    });
  }
}

/**
 * Register the organize command with Commander
 * @param {import('commander').Command} program
 */
export function registerOrganizeCommand(program) {
  program
    .command('organize <directory>')
    .description('Auto-sort files into subfolders by type, date, or size')
    .option('-b, --by <strategy>', 'Organize by: extension | date | size', 'extension')
    .option('-r, --recursive', 'Include files in subdirectories', false)
    .option('-d, --dry-run', 'Preview changes without moving files', false)
    .option('--verbose', 'Show detailed output', false)
    .addHelpText('after', `
Examples:
  $ fileflow organize ./downloads
  $ fileflow organize ./downloads --by date
  $ fileflow organize ./downloads --by size --dry-run
  $ fileflow organize ./downloads --recursive`)
    .action(organizeFiles);
}
