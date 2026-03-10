/**
 * logger.js - Shared logging utilities for consistent CLI output
 */

import chalk from 'chalk';

/**
 * Print a summary table with colored values
 * @param {Array<{label: string, value: number|string, color: string}>} items
 */
export function logSummary(items) {
  console.log('\n' + chalk.bold('Summary:'));
  items.forEach(({ label, value, color }) => {
    const colorFn = chalk[color] || chalk.white;
    console.log(`  ${label.padEnd(12)} ${colorFn(String(value))}`);
  });
  console.log();
}

/**
 * Print a section header
 */
export function logHeader(title) {
  console.log('\n' + chalk.bold.underline(title));
}

/**
 * Print an info message with a bullet
 */
export function logInfo(msg) {
  console.log(chalk.cyan('ℹ ') + msg);
}

/**
 * Print a success message
 */
export function logSuccess(msg) {
  console.log(chalk.green('✔ ') + msg);
}

/**
 * Print a warning message
 */
export function logWarn(msg) {
  console.log(chalk.yellow('⚠ ') + msg);
}

/**
 * Print an error message
 */
export function logError(msg) {
  console.log(chalk.red('✖ ') + msg);
}
