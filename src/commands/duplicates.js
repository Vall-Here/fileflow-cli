/**
 * duplicates.js - Find and optionally remove duplicate files
 *
 * Uses MD5 hashing to detect exact duplicates, regardless of filename.
 *
 * Usage:
 *   fileflow duplicates ./downloads
 *   fileflow duplicates ./downloads --delete
 *   fileflow duplicates ./downloads --recursive
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { formatBytes } from '../utils/fileHelpers.js';

/**
 * Compute MD5 hash of a file (streaming, suitable for large files)
 * @param {string} filePath
 * @returns {Promise<string>} hex digest
 */
export async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Group files by their hash, returning only groups with 2+ identical files.
 * Skips hashing if file sizes differ (optimization).
 * @param {string[]} files
 * @param {import('ora').Ora} spinner
 * @returns {Promise<string[][]>}
 */
export async function findDuplicateGroups(files, spinner) {
  // First pass: group by file size to avoid unnecessary hashing
  const sizeMap = new Map();
  for (const file of files) {
    try {
      const { size } = fs.statSync(file);
      if (!sizeMap.has(size)) sizeMap.set(size, []);
      sizeMap.get(size).push(file);
    } catch {
      // Skip inaccessible files
    }
  }

  // Only hash files that share the same size
  const candidates = [...sizeMap.values()].filter(g => g.length > 1).flat();

  const hashMap = new Map();

  for (let i = 0; i < candidates.length; i++) {
    spinner.text = `Hashing files... ${i + 1}/${candidates.length}`;
    try {
      const hash = await hashFile(candidates[i]);
      if (!hashMap.has(hash)) hashMap.set(hash, []);
      hashMap.get(hash).push(candidates[i]);
    } catch {
      // Skip unreadable files
    }
  }

  return [...hashMap.values()].filter(group => group.length > 1);
}

/**
 * Main duplicates function
 * @param {string} targetDir
 * @param {{ recursive: boolean, delete: boolean, dryRun: boolean }} options
 */
async function findDuplicates(targetDir, options) {
  const { recursive = false, delete: shouldDelete = false, dryRun = false } = options;

  if (!fs.existsSync(targetDir)) {
    console.error(chalk.red(`✖ Directory not found: ${targetDir}`));
    process.exit(1);
  }

  const resolvedTarget = path.resolve(targetDir).replace(/\\/g, '/');
  const pattern = recursive
    ? `${resolvedTarget}/**/*`
    : `${resolvedTarget}/*`;

  const spinner = ora('Scanning files...').start();
  const files = await glob(pattern, { nodir: true });
  spinner.text = `Found ${files.length} files, computing hashes...`;

  const groups = await findDuplicateGroups(files, spinner);
  spinner.succeed(`Scan complete — ${chalk.bold(groups.length)} duplicate group(s) found`);

  if (groups.length === 0) {
    console.log(chalk.green('✔ No duplicate files found!'));
    return;
  }

  // Calculate wasted space and render table
  let wastedBytes = 0;
  const table = new Table({
    head: [chalk.gray('File'), chalk.gray('Size'), chalk.gray('Copies')],
    style: { head: [], border: [] },
  });

  groups.forEach(group => {
    const stats = fs.statSync(group[0]);
    const waste = stats.size * (group.length - 1);
    wastedBytes += waste;

    group.forEach((file, i) => {
      table.push([
        (i === 0 ? chalk.green('✔ ') : chalk.red('✖ ')) + path.relative(targetDir, file),
        i === 0 ? formatBytes(stats.size) : '',
        i === 0 ? String(group.length) : '',
      ]);
    });
    table.push([chalk.gray('---'), '', '']);
  });

  console.log('\n' + table.toString());
  console.log(chalk.yellow(`\n⚠ Wasted space: ${formatBytes(wastedBytes)}`));

  if (!shouldDelete) {
    console.log(chalk.gray('\nRun with --delete to remove duplicates (keeps the first file in each group)'));
    return;
  }

  // Delete duplicates (keep first in each group)
  const toDelete = groups.flatMap(group => group.slice(1));

  if (dryRun) {
    console.log(chalk.yellow(`\n📋 DRY RUN: Would delete ${toDelete.length} files, saving ${formatBytes(wastedBytes)}`));
    return;
  }

  const deleteSpinner = ora(`Deleting ${toDelete.length} duplicate files...`).start();
  let deleted = 0;

  for (const file of toDelete) {
    try {
      await fs.remove(file);
      deleted++;
    } catch (err) {
      console.error(chalk.red(`\n  Failed to delete ${file}: ${err.message}`));
    }
  }

  deleteSpinner.succeed(`Deleted ${chalk.green(deleted)} duplicate files, freed ${chalk.bold(formatBytes(wastedBytes))}`);
}

/**
 * Register duplicates command with Commander
 * @param {import('commander').Command} program
 */
export function registerDuplicatesCommand(program) {
  program
    .command('duplicates <directory>')
    .description('Find (and optionally delete) duplicate files using MD5 hashing')
    .option('-r, --recursive', 'Search in subdirectories', false)
    .option('--delete', 'Delete duplicate files (keeps first copy)', false)
    .option('-d, --dry-run', 'Preview without deleting', false)
    .addHelpText('after', `
Examples:
  $ fileflow duplicates ./downloads
  $ fileflow duplicates ./downloads --recursive
  $ fileflow duplicates ./downloads --delete --dry-run`)
    .action(findDuplicates);
}
