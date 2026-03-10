/**
 * fileHelpers.js - Shared file utility functions
 */

import fs from 'fs';

/**
 * Format bytes into human-readable string
 * @param {number} bytes
 * @returns {string} e.g. "1.23 MB"
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Get file date — uses birthtime if available, falls back to mtime
 * @param {fs.Stats} stats
 * @returns {Date}
 */
export function getFileDate(stats) {
  return stats.birthtime && stats.birthtime.getTime() > 0
    ? stats.birthtime
    : stats.mtime;
}

/**
 * Check if a path is a valid directory
 * @param {string} dir
 * @returns {boolean}
 */
export function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Sanitize a string to be safe for use as a filename
 * Removes or replaces characters not safe in filenames
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}
