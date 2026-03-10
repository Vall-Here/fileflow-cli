/**
 * FileFlow CLI — library entry point
 * Re-exports core functions for programmatic use.
 */

export { organizeFiles, getCategoryByExtension, getDestinationFolder } from './commands/organize.js';
export { renameFiles, applyTemplate, applyCase } from './commands/rename.js';
export { convertFile, readFile, writeFile } from './commands/convert.js';
export { hashFile, findDuplicateGroups } from './commands/duplicates.js';
export { formatBytes, getFileDate, sanitizeFilename, isDirectory } from './utils/fileHelpers.js';
export { logSummary, logInfo, logSuccess, logWarn, logError } from './utils/logger.js';
