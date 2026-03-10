/**
 * fileHelpers.test.js - Tests for shared utility functions
 */

import { describe, it, expect } from '@jest/globals';
import { formatBytes, getFileDate, sanitizeFilename, isDirectory } from '../../src/utils/fileHelpers.js';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';

describe('formatBytes', () => {
  it('returns "0 B" for zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes correctly', () => {
    expect(formatBytes(512)).toBe('512.00 B');
  });

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(2048)).toBe('2.00 KB');
  });

  it('formats megabytes correctly', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });
});

describe('getFileDate', () => {
  it('returns birthtime when it is valid', () => {
    const birth = new Date('2023-01-01');
    const mtime = new Date('2024-06-15');
    const stats = { birthtime: birth, mtime };

    expect(getFileDate(stats)).toBe(birth);
  });

  it('falls back to mtime when birthtime is epoch zero', () => {
    const mtime = new Date('2024-06-15');
    const stats = { birthtime: new Date(0), mtime };

    expect(getFileDate(stats)).toBe(mtime);
  });
});

describe('sanitizeFilename', () => {
  it('replaces spaces with underscores', () => {
    expect(sanitizeFilename('my file name.txt')).toBe('my_file_name.txt');
  });

  it('replaces unsafe characters with dashes', () => {
    expect(sanitizeFilename('file:name?.txt')).toBe('file-name-.txt');
  });

  it('collapses multiple dashes into one', () => {
    expect(sanitizeFilename('a//b.txt')).toBe('a-b.txt');
  });

  it('trims leading and trailing dashes', () => {
    expect(sanitizeFilename('/file/.txt')).toBe('file-.txt');
  });

  it('limits output to 200 characters', () => {
    expect(sanitizeFilename('a'.repeat(300)).length).toBeLessThanOrEqual(200);
  });

  it('does not modify already-clean filenames', () => {
    expect(sanitizeFilename('clean_filename.txt')).toBe('clean_filename.txt');
  });
});

describe('isDirectory', () => {
  it('returns true for an existing directory', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-ishdir-'));
    expect(isDirectory(tmpDir)).toBe(true);
    await fs.remove(tmpDir);
  });

  it('returns false for a file path', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-isfile-'));
    const filePath = path.join(tmpDir, 'test.txt');
    await fs.writeFile(filePath, 'data');
    expect(isDirectory(filePath)).toBe(false);
    await fs.remove(tmpDir);
  });

  it('returns false for a non-existent path', () => {
    expect(isDirectory('/non/existent/path/xyz')).toBe(false);
  });
});
