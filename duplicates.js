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
 * Compute MD5 hash of a file (streaming for large files)
 */
async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Group files by their hash, return only groups with duplicates
 */
async function findDuplicateGroups(files, spinner) {
  const hashMap = new Map();

  for (let i = 0; i < files.length; i++) {
    spinner.text = `Hashing files... ${i + 1}/${files.length}`;
    try {
      const hash = await hashFile(files[i]);
      if (!hashMap.has(hash)) hashMap.set(hash, []);
      hashMap.get(hash).push(files[i]);
    } catch {
      // Skip unreadable files
    }
  }

  return [...hashMap.values()].filter(group => group.length > 1);
}

/**
 * Main duplicates function
 */
async function findDuplicates(targetDir, options) {
  const { recursive = false, delete: shouldDelete = false, dryRun = false } = options;

  if (!fs.existsSync(targetDir)) {
    console.error(chalk.red(`✖ Directory not found: ${targetDir}`));
    process.exit(1);
  }

  const pattern = recursive
    ? path.join(targetDir, '**', '*')
    : path.join(targetDir, '*');

  const spinner = ora('Scanning files...').start();
  const files = await glob(pattern, { nodir: true });
  spinner.text = `Found ${files.length} files, computing hashes...`;

  const groups = await findDuplicateGroups(files, spinner);
  spinner.succeed(`Scan complete — ${chalk.bold(groups.length)} duplicate group(s) found`);

  if (groups.length === 0) {
    console.log(chalk.green('✔ No duplicate files found!'));
    return;
  }

  // Calculate wasted space
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
 */
export function registerDuplicatesCommand(program) {
  program
    .command('duplicates <directory>')
    .description('Find (and optionally delete) duplicate files using MD5 hashing')
    .option('-r, --recursive', 'Search in subdirectories', false)
    .option('--delete', 'Delete duplicate files (keeps first copy)', false)
    .option('-d, --dry-run', 'Preview without deleting', false)
    .example('fileflow duplicates ./downloads')
    .example('fileflow duplicates ./downloads --delete --dry-run')
    .action(findDuplicates);
}
