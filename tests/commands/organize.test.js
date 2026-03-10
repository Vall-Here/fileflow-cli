/**
 * organize.test.js - Tests for file organize command
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import {
  getCategoryByExtension,
  getDestinationFolder,
  organizeFiles,
  FILE_CATEGORIES,
} from '../../src/commands/organize.js';

describe('getCategoryByExtension', () => {
  it('categorizes image files correctly', () => {
    expect(getCategoryByExtension('.jpg')).toBe('images');
    expect(getCategoryByExtension('.PNG')).toBe('images'); // case-insensitive
    expect(getCategoryByExtension('.gif')).toBe('images');
    expect(getCategoryByExtension('.webp')).toBe('images');
  });

  it('categorizes video files correctly', () => {
    expect(getCategoryByExtension('.mp4')).toBe('videos');
    expect(getCategoryByExtension('.MKV')).toBe('videos');
    expect(getCategoryByExtension('.avi')).toBe('videos');
  });

  it('categorizes audio files correctly', () => {
    expect(getCategoryByExtension('.mp3')).toBe('audio');
    expect(getCategoryByExtension('.WAV')).toBe('audio');
    expect(getCategoryByExtension('.flac')).toBe('audio');
  });

  it('categorizes document files correctly', () => {
    expect(getCategoryByExtension('.pdf')).toBe('documents');
    expect(getCategoryByExtension('.docx')).toBe('documents');
    expect(getCategoryByExtension('.md')).toBe('documents');
    expect(getCategoryByExtension('.txt')).toBe('documents');
  });

  it('categorizes data files correctly', () => {
    expect(getCategoryByExtension('.csv')).toBe('data');
    expect(getCategoryByExtension('.json')).toBe('data');
    expect(getCategoryByExtension('.yaml')).toBe('data');
  });

  it('categorizes archive files correctly', () => {
    expect(getCategoryByExtension('.zip')).toBe('archives');
    expect(getCategoryByExtension('.rar')).toBe('archives');
    expect(getCategoryByExtension('.gz')).toBe('archives');
  });

  it('categorizes code files correctly', () => {
    expect(getCategoryByExtension('.js')).toBe('code');
    expect(getCategoryByExtension('.py')).toBe('code');
    expect(getCategoryByExtension('.ts')).toBe('code');
  });

  it('returns "others" for unknown extensions', () => {
    expect(getCategoryByExtension('.xyz')).toBe('others');
    expect(getCategoryByExtension('.unknown')).toBe('others');
    expect(getCategoryByExtension('')).toBe('others');
  });

  it('covers all categories in FILE_CATEGORIES', () => {
    for (const [category, exts] of Object.entries(FILE_CATEGORIES)) {
      for (const ext of exts) {
        expect(getCategoryByExtension(ext)).toBe(category);
      }
    }
  });
});

describe('getDestinationFolder', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-dest-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('returns correct YYYY-MM format for date strategy', async () => {
    const testFile = path.join(tmpDir, 'photo.jpg');
    await fs.writeFile(testFile, 'data');

    const result = getDestinationFolder(testFile, 'date');
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns "small (< 1MB)" for files < 1MB with size strategy', async () => {
    const testFile = path.join(tmpDir, 'small.txt');
    await fs.writeFile(testFile, 'tiny content');

    expect(getDestinationFolder(testFile, 'size')).toBe('small (< 1MB)');
  });

  it('returns "medium (1-10MB)" for files 1-10MB with size strategy', async () => {
    const testFile = path.join(tmpDir, 'medium.bin');
    await fs.writeFile(testFile, Buffer.alloc(2 * 1024 * 1024)); // 2MB

    expect(getDestinationFolder(testFile, 'size')).toBe('medium (1-10MB)');
  });

  it('returns "large (10-100MB)" for files 10-100MB with size strategy', async () => {
    const testFile = path.join(tmpDir, 'large.bin');
    await fs.writeFile(testFile, Buffer.alloc(15 * 1024 * 1024)); // 15MB

    expect(getDestinationFolder(testFile, 'size')).toBe('large (10-100MB)');
  });

  it('returns category name for extension strategy', async () => {
    const testFile = path.join(tmpDir, 'photo.jpg');
    await fs.writeFile(testFile, 'data');

    expect(getDestinationFolder(testFile, 'extension')).toBe('images');
  });

  it('defaults to extension strategy', async () => {
    const testFile = path.join(tmpDir, 'doc.pdf');
    await fs.writeFile(testFile, 'data');

    expect(getDestinationFolder(testFile, 'default')).toBe('documents');
  });
});

describe('organizeFiles — integration', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-org-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('moves files to correct category subfolders', async () => {
    await fs.writeFile(path.join(tmpDir, 'photo.jpg'), 'img data');
    await fs.writeFile(path.join(tmpDir, 'report.pdf'), 'pdf data');
    await fs.writeFile(path.join(tmpDir, 'data.csv'), 'csv data');

    await organizeFiles(tmpDir, { by: 'extension', dryRun: false, recursive: false, verbose: false });

    expect(fs.existsSync(path.join(tmpDir, 'images', 'photo.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'documents', 'report.pdf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'data', 'data.csv'))).toBe(true);
  });

  it('does not move files in dry-run mode', async () => {
    await fs.writeFile(path.join(tmpDir, 'photo.jpg'), 'img data');

    await organizeFiles(tmpDir, { by: 'extension', dryRun: true, recursive: false, verbose: false });

    // File should still be at root (not moved)
    expect(fs.existsSync(path.join(tmpDir, 'photo.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'images', 'photo.jpg'))).toBe(false);
  });

  it('handles filename conflicts by appending a timestamp', async () => {
    await fs.writeFile(path.join(tmpDir, 'photo.jpg'), 'original');
    // Pre-create a conflicting file in the destination folder
    await fs.ensureDir(path.join(tmpDir, 'images'));
    await fs.writeFile(path.join(tmpDir, 'images', 'photo.jpg'), 'existing');

    await organizeFiles(tmpDir, { by: 'extension', dryRun: false, recursive: false, verbose: false });

    // Original destination still exists
    expect(fs.existsSync(path.join(tmpDir, 'images', 'photo.jpg'))).toBe(true);

    // New file should exist with a timestamp suffix
    const imageFiles = await fs.readdir(path.join(tmpDir, 'images'));
    const renamedFile = imageFiles.find(f => f.startsWith('photo_') && f.endsWith('.jpg'));
    expect(renamedFile).toBeDefined();
  });

  it('handles empty directory gracefully', async () => {
    // Should not throw
    await expect(
      organizeFiles(tmpDir, { by: 'extension', dryRun: false, recursive: false, verbose: false })
    ).resolves.not.toThrow();
  });

  it('skips files already in the correct subfolder', async () => {
    await fs.ensureDir(path.join(tmpDir, 'images'));
    await fs.writeFile(path.join(tmpDir, 'images', 'photo.jpg'), 'data');

    await organizeFiles(tmpDir, { by: 'extension', dryRun: false, recursive: false, verbose: false });

    // File should remain in place, not be duplicated
    const imageFiles = await fs.readdir(path.join(tmpDir, 'images'));
    expect(imageFiles).toHaveLength(1);
    expect(imageFiles[0]).toBe('photo.jpg');
  });
});

describe('Filename Sanitization', () => {
  // Import from fileHelpers
  it('replaces spaces with underscores', async () => {
    const { sanitizeFilename } = await import('../../src/utils/fileHelpers.js');
    expect(sanitizeFilename('my file name.txt')).toBe('my_file_name.txt');
  });

  it('removes unsafe characters', async () => {
    const { sanitizeFilename } = await import('../../src/utils/fileHelpers.js');
    expect(sanitizeFilename('file:with*invalid?chars.txt')).toBe('file-with-invalid-chars.txt');
  });

  it('trims leading and trailing dashes', async () => {
    const { sanitizeFilename } = await import('../../src/utils/fileHelpers.js');
    expect(sanitizeFilename('/leading.txt')).toBe('leading.txt');
  });

  it('does not exceed max length of 200 chars', async () => {
    const { sanitizeFilename } = await import('../../src/utils/fileHelpers.js');
    const longName = 'a'.repeat(300);
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(200);
  });
});
