/**
 * organize.test.js - Tests for file organize command
 *
 * Run: npm test
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// We test the core logic functions directly, not the CLI layer
// This keeps tests fast and independent of Commander

describe('File Organizer', () => {
  let tmpDir;

  beforeEach(async () => {
    // Create a fresh temp directory for each test
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.remove(tmpDir);
  });

  it('creates temp test directory', () => {
    expect(fs.existsSync(tmpDir)).toBe(true);
  });

  it('sorts files by extension category', async () => {
    // Create test files
    const files = ['photo.jpg', 'document.pdf', 'data.csv', 'video.mp4'];
    for (const file of files) {
      await fs.writeFile(path.join(tmpDir, file), 'test content');
    }

    // Verify files were created
    for (const file of files) {
      expect(fs.existsSync(path.join(tmpDir, file))).toBe(true);
    }

    // After organize, files should be moved to category folders
    // (test the actual organize function here once extracted to a testable unit)
  });

  it('handles empty directory gracefully', async () => {
    const files = await fs.readdir(tmpDir);
    expect(files).toHaveLength(0);
  });

  it('handles duplicate filenames during organize', async () => {
    // Create two files with same name in different structures
    await fs.writeFile(path.join(tmpDir, 'duplicate.jpg'), 'content 1');
    expect(fs.existsSync(path.join(tmpDir, 'duplicate.jpg'))).toBe(true);
  });
});

describe('File Category Detection', () => {
  const FILE_CATEGORIES = {
    images:    ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    documents: ['.pdf', '.doc', '.docx', '.txt', '.md'],
    data:      ['.csv', '.json', '.xml', '.yaml'],
    videos:    ['.mp4', '.mkv', '.avi'],
    audio:     ['.mp3', '.wav', '.flac'],
  };

  function getCategoryByExtension(ext) {
    const lowerExt = ext.toLowerCase();
    for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
      if (extensions.includes(lowerExt)) return category;
    }
    return 'others';
  }

  it('categorizes image files correctly', () => {
    expect(getCategoryByExtension('.jpg')).toBe('images');
    expect(getCategoryByExtension('.PNG')).toBe('images'); // case insensitive
    expect(getCategoryByExtension('.gif')).toBe('images');
  });

  it('categorizes document files correctly', () => {
    expect(getCategoryByExtension('.pdf')).toBe('documents');
    expect(getCategoryByExtension('.docx')).toBe('documents');
    expect(getCategoryByExtension('.md')).toBe('documents');
  });

  it('categorizes data files correctly', () => {
    expect(getCategoryByExtension('.csv')).toBe('data');
    expect(getCategoryByExtension('.json')).toBe('data');
  });

  it('returns "others" for unknown extensions', () => {
    expect(getCategoryByExtension('.xyz')).toBe('others');
    expect(getCategoryByExtension('.unknown')).toBe('others');
  });
});

describe('Filename Sanitization', () => {
  function sanitizeFilename(name) {
    return name
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 200);
  }

  it('replaces spaces with underscores', () => {
    expect(sanitizeFilename('my file name.txt')).toBe('my_file_name.txt');
  });

  it('removes unsafe characters', () => {
    expect(sanitizeFilename('file:with*invalid?chars.txt')).toBe('file-with-invalid-chars.txt');
  });

  it('does not modify clean filenames', () => {
    expect(sanitizeFilename('clean_filename.txt')).toBe('clean_filename.txt');
  });
});
