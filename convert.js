/**
 * convert.js - Convert data files between CSV, JSON, and Excel formats
 *
 * Usage:
 *   fileflow convert data.csv --to json
 *   fileflow convert data.json --to csv
 *   fileflow convert data.xlsx --to json --sheet "Sheet1"
 *   fileflow convert ./data-dir --to json  (batch mode)
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const SUPPORTED_FORMATS = ['csv', 'json', 'xlsx', 'xls'];

/**
 * Read a file and parse it based on its extension
 * @returns {Array<Object>} - Array of row objects
 */
async function readFile(filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase().slice(1);

  switch (ext) {
    case 'csv': {
      const content = await fs.readFile(filePath, 'utf-8');
      const result = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });
      if (result.errors.length > 0) {
        throw new Error(`CSV parse error: ${result.errors[0].message}`);
      }
      return result.data;
    }

    case 'json': {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      // Support both array and { data: [...] } shapes
      return Array.isArray(parsed) ? parsed : parsed.data || [parsed];
    }

    case 'xlsx':
    case 'xls': {
      const workbook = XLSX.readFile(filePath);
      const sheetName = options.sheet || workbook.SheetNames[0];
      if (!workbook.SheetNames.includes(sheetName)) {
        throw new Error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
      }
      const sheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }

    default:
      throw new Error(`Unsupported format: .${ext}`);
  }
}

/**
 * Write data to a file in the target format
 */
async function writeFile(data, outputPath, options = {}) {
  const ext = path.extname(outputPath).toLowerCase().slice(1);

  switch (ext) {
    case 'json': {
      const content = JSON.stringify(data, null, options.minify ? 0 : 2);
      await fs.writeFile(outputPath, content, 'utf-8');
      break;
    }

    case 'csv': {
      const csv = Papa.unparse(data, {
        quotes: options.quotes || false,
        delimiter: options.delimiter || ',',
      });
      await fs.writeFile(outputPath, csv, 'utf-8');
      break;
    }

    case 'xlsx': {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, options.sheet || 'Sheet1');
      XLSX.writeFile(workbook, outputPath);
      break;
    }

    default:
      throw new Error(`Unsupported output format: .${ext}`);
  }
}

/**
 * Convert a single file
 */
async function convertFile(inputPath, targetFormat, options) {
  const inputExt = path.extname(inputPath).toLowerCase().slice(1);

  if (!SUPPORTED_FORMATS.includes(inputExt)) {
    throw new Error(`Unsupported input format: .${inputExt}`);
  }
  if (!SUPPORTED_FORMATS.includes(targetFormat)) {
    throw new Error(`Unsupported output format: .${targetFormat}`);
  }
  if (inputExt === targetFormat) {
    throw new Error('Input and output formats are the same');
  }

  const data = await readFile(inputPath, options);

  const outputDir = options.output || path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputDir, `${baseName}.${targetFormat}`);

  await fs.ensureDir(outputDir);
  await writeFile(data, outputPath, options);

  return { outputPath, rowCount: data.length };
}

/**
 * Main convert function (handles single file or directory batch)
 */
async function convert(input, options) {
  const { to: targetFormat, output, sheet, minify, delimiter, dryRun } = options;

  if (!targetFormat) {
    console.error(chalk.red('✖ Specify output format with --to (csv | json | xlsx)'));
    process.exit(1);
  }

  const isDir = fs.existsSync(input) && fs.statSync(input).isDirectory();

  if (isDir) {
    // Batch mode: convert all supported files in directory
    const spinner = ora('Scanning directory...').start();
    const files = await glob(path.join(input, `*.{${SUPPORTED_FORMATS.join(',')}}`), { nodir: true });

    // Filter out files already in target format
    const toConvert = files.filter(f =>
      path.extname(f).toLowerCase().slice(1) !== targetFormat
    );

    spinner.succeed(`Found ${chalk.bold(toConvert.length)} files to convert`);

    if (toConvert.length === 0) return;
    if (dryRun) {
      toConvert.forEach(f => console.log(`  ${chalk.gray(path.basename(f))} → ${chalk.cyan(`${path.basename(f, path.extname(f))}.${targetFormat}`)}`));
      console.log(chalk.yellow(`\n📋 DRY RUN: ${toConvert.length} files would be converted`));
      return;
    }

    let success = 0;
    const errors = [];

    for (const file of toConvert) {
      const fileSpinner = ora(`Converting ${chalk.cyan(path.basename(file))}...`).start();
      try {
        const { outputPath, rowCount } = await convertFile(file, targetFormat, { output, sheet, minify, delimiter });
        fileSpinner.succeed(`${chalk.gray(path.basename(file))} → ${chalk.green(path.basename(outputPath))} (${rowCount} rows)`);
        success++;
      } catch (err) {
        fileSpinner.fail(`${path.basename(file)}: ${err.message}`);
        errors.push(err);
      }
    }

    console.log(chalk.bold(`\nDone: ${chalk.green(success)} converted, ${chalk.red(errors.length)} failed`));

  } else {
    // Single file mode
    if (!fs.existsSync(input)) {
      console.error(chalk.red(`✖ File not found: ${input}`));
      process.exit(1);
    }

    const spinner = ora(`Converting ${chalk.cyan(path.basename(input))} to ${chalk.bold(targetFormat)}...`).start();
    try {
      const { outputPath, rowCount } = await convertFile(input, targetFormat, { output, sheet, minify, delimiter });
      spinner.succeed(`Converted! → ${chalk.green(outputPath)} (${rowCount} rows)`);
    } catch (err) {
      spinner.fail(err.message);
      process.exit(1);
    }
  }
}

/**
 * Register the convert command with Commander
 */
export function registerConvertCommand(program) {
  program
    .command('convert <input>')
    .description('Convert data files between CSV, JSON, and Excel formats')
    .option('-t, --to <format>', 'Output format: csv | json | xlsx')
    .option('-o, --output <dir>', 'Output directory (default: same as input)')
    .option('-s, --sheet <name>', 'Sheet name for Excel input/output')
    .option('-m, --minify', 'Minify JSON output', false)
    .option('--delimiter <char>', 'CSV delimiter character', ',')
    .option('-d, --dry-run', 'Preview without converting', false)
    .example('fileflow convert data.csv --to json')
    .example('fileflow convert data.xlsx --to csv --sheet "Sales"')
    .example('fileflow convert ./data-dir --to json')
    .action(convert);
}
