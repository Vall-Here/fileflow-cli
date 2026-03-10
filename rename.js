/**
 * rename.js - Bulk rename files using patterns and templates
 *
 * Usage:
 *   fileflow rename ./invoices --pattern "invoice_{date}_{index:3}"
 *   fileflow rename ./photos --find "IMG_" --replace "photo_"
 *   fileflow rename ./docs --case upper
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { getFileDate } from '../utils/fileHelpers.js';

/**
 * Build a new filename from a template string
 * Supported tokens:
 *   {name}       - original filename without extension
 *   {ext}        - file extension without dot
 *   {index}      - sequential number (1-based)
 *   {index:3}    - zero-padded number (e.g. 001)
 *   {date}       - file modification date YYYY-MM-DD
 *   {timestamp}  - Unix timestamp
 */
function applyTemplate(template, file, index) {
  const stats = fs.statSync(file);
  const ext = path.extname(file).slice(1);
  const name = path.basename(file, path.extname(file));
  const date = getFileDate(stats).toISOString().slice(0, 10);
  const timestamp = stats.mtimeMs.toFixed(0);

  return template
    .replace(/{name}/g, name)
    .replace(/{ext}/g, ext)
    .replace(/{date}/g, date)
    .replace(/{timestamp}/g, timestamp)
    .replace(/{index:(\d+)}/g, (_, pad) => String(index).padStart(parseInt(pad), '0'))
    .replace(/{index}/g, String(index));
}

/**
 * Apply case transformation to a filename
 */
function applyCase(filename, caseType) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  switch (caseType) {
    case 'upper':  return base.toUpperCase() + ext;
    case 'lower':  return base.toLowerCase() + ext;
    case 'kebab':  return base.replace(/[\s_]+/g, '-').toLowerCase() + ext;
    case 'snake':  return base.replace(/[\s-]+/g, '_').toLowerCase() + ext;
    case 'camel': {
      const words = base.split(/[\s_-]+/);
      return words.map((w, i) => i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join('') + ext;
    }
    default: return filename;
  }
}

/**
 * Main rename function
 */
async function renameFiles(targetDir, options) {
  const { pattern, find, replace, caseType, dryRun = false, ext: filterExt } = options;

  if (!fs.existsSync(targetDir)) {
    console.error(chalk.red(`✖ Directory not found: ${targetDir}`));
    process.exit(1);
  }

  // Validate that at least one rename strategy is provided
  if (!pattern && !find && !caseType) {
    console.error(chalk.red('✖ Provide at least one option: --pattern, --find, or --case'));
    process.exit(1);
  }

  const spinner = ora('Scanning files...').start();

  // Build glob pattern, optionally filtered by extension
  const globPattern = filterExt
    ? path.join(targetDir, `*.${filterExt.replace(/^\./, '')}`)
    : path.join(targetDir, '*');

  const files = await glob(globPattern, { nodir: true });
  spinner.succeed(`Found ${chalk.bold(files.length)} files`);

  if (files.length === 0) return;

  // Build rename plan
  const renames = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const dir = path.dirname(file);
    let newName = path.basename(file);

    if (pattern) {
      const ext = path.extname(file);
      newName = applyTemplate(pattern, file, i + 1) + (pattern.includes('{ext}') ? '' : ext);
    }

    if (find && replace !== undefined) {
      newName = newName.split(find).join(replace);
    }

    if (caseType) {
      newName = applyCase(newName, caseType);
    }

    if (newName !== path.basename(file)) {
      renames.push({
        from: file,
        to: path.join(dir, newName),
        oldName: path.basename(file),
        newName,
      });
    }
  }

  if (renames.length === 0) {
    console.log(chalk.green('\n✔ No files need renaming.'));
    return;
  }

  // Show preview table
  const table = new Table({
    head: [chalk.gray('Original'), chalk.cyan('New Name')],
    style: { head: [], border: [] },
  });
  renames.slice(0, 10).forEach(({ oldName, newName }) => table.push([oldName, newName]));
  if (renames.length > 10) table.push([chalk.gray(`... and ${renames.length - 10} more`), '']);

  console.log('\n' + table.toString());

  if (dryRun) {
    console.log(chalk.yellow(`\n📋 DRY RUN: ${renames.length} files would be renamed`));
    return;
  }

  // Execute renames
  const renameSpinner = ora(`Renaming ${renames.length} files...`).start();
  let success = 0;
  const errors = [];

  for (const { from, to } of renames) {
    try {
      await fs.rename(from, to);
      success++;
    } catch (err) {
      errors.push({ file: from, error: err.message });
    }
  }

  renameSpinner.succeed(`Renamed ${chalk.green(success)} files successfully!`);
  if (errors.length > 0) {
    console.log(chalk.red(`✖ ${errors.length} errors occurred`));
  }
}

/**
 * Register the rename command with Commander
 */
export function registerRenameCommand(program) {
  program
    .command('rename <directory>')
    .description('Bulk rename files using patterns, find/replace, or case conversion')
    .option('-p, --pattern <template>', 'Rename using template: {name}, {date}, {index}, {ext}')
    .option('-f, --find <string>', 'Find string to replace in filenames')
    .option('-r, --replace <string>', 'Replacement string (use with --find)')
    .option('-c, --case <type>', 'Change case: upper | lower | kebab | snake | camel')
    .option('-e, --ext <extension>', 'Only rename files with this extension')
    .option('-d, --dry-run', 'Preview renames without applying', false)
    .example('fileflow rename ./invoices --pattern "invoice_{date}_{index:3}"')
    .example('fileflow rename ./photos --find "IMG_" --replace "photo_"')
    .example('fileflow rename ./docs --case kebab')
    .action(renameFiles);
}
