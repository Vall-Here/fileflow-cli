/**
 * rename.test.js - Tests for bulk rename command
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { applyTemplate, applyCase, renameFiles } from '../../src/commands/rename.js';

describe('applyTemplate', () => {
  let tmpDir;
  let testFile;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-rename-'));
    testFile = path.join(tmpDir, 'hello world.txt');
    await fs.writeFile(testFile, 'content');
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('replaces {name} token', () => {
    const result = applyTemplate('{name}', testFile, 1);
    expect(result).toBe('hello world');
  });

  it('replaces {ext} token', () => {
    const result = applyTemplate('{ext}', testFile, 1);
    expect(result).toBe('txt');
  });

  it('replaces {index} token', () => {
    expect(applyTemplate('{index}', testFile, 5)).toBe('5');
    expect(applyTemplate('{index}', testFile, 42)).toBe('42');
  });

  it('replaces {index:3} with zero-padded number', () => {
    expect(applyTemplate('{index:3}', testFile, 1)).toBe('001');
    expect(applyTemplate('{index:3}', testFile, 42)).toBe('042');
    expect(applyTemplate('{index:5}', testFile, 7)).toBe('00007');
  });

  it('replaces {date} token with YYYY-MM-DD format', () => {
    const result = applyTemplate('{date}', testFile, 1);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('replaces {timestamp} token with numeric string', () => {
    const result = applyTemplate('{timestamp}', testFile, 1);
    expect(result).toMatch(/^\d+$/);
  });

  it('replaces multiple tokens in one template', () => {
    const result = applyTemplate('file_{index:3}_{name}', testFile, 2);
    expect(result).toBe('file_002_hello world');
  });
});

describe('applyCase', () => {
  it('converts to uppercase', () => {
    expect(applyCase('hello world.txt', 'upper')).toBe('HELLO WORLD.txt');
  });

  it('converts to lowercase', () => {
    expect(applyCase('HELLO WORLD.txt', 'lower')).toBe('hello world.txt');
  });

  it('converts to kebab-case', () => {
    expect(applyCase('hello world.txt', 'kebab')).toBe('hello-world.txt');
    expect(applyCase('Hello_World.txt', 'kebab')).toBe('hello-world.txt');
  });

  it('converts to snake_case', () => {
    expect(applyCase('hello world.txt', 'snake')).toBe('hello_world.txt');
    expect(applyCase('hello-world.txt', 'snake')).toBe('hello_world.txt');
  });

  it('converts to camelCase', () => {
    expect(applyCase('hello world.txt', 'camel')).toBe('helloWorld.txt');
    expect(applyCase('my-great-file.txt', 'camel')).toBe('myGreatFile.txt');
  });

  it('preserves extension on all case types', () => {
    expect(applyCase('file.PDF', 'lower')).toBe('file.PDF');
    expect(applyCase('file.PDF', 'upper')).toBe('FILE.PDF');
  });

  it('returns unchanged filename for unknown case type', () => {
    expect(applyCase('file.txt', 'unknown')).toBe('file.txt');
  });
});

describe('renameFiles — integration', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-renamefiles-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('does not rename files in dry-run mode', async () => {
    await fs.writeFile(path.join(tmpDir, 'photo001.jpg'), 'data');

    await renameFiles(tmpDir, { pattern: 'image_{index:3}', dryRun: true });

    expect(fs.existsSync(path.join(tmpDir, 'photo001.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'image_001.jpg'))).toBe(false);
  });

  it('renames files using a pattern', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.txt'), '1');
    await fs.writeFile(path.join(tmpDir, 'b.txt'), '2');

    await renameFiles(tmpDir, { pattern: 'file_{index:2}', dryRun: false });

    const files = await fs.readdir(tmpDir);
    expect(files).toContain('file_01.txt');
    expect(files).toContain('file_02.txt');
  });

  it('renames files using find/replace', async () => {
    await fs.writeFile(path.join(tmpDir, 'IMG_001.jpg'), 'data');
    await fs.writeFile(path.join(tmpDir, 'IMG_002.jpg'), 'data');

    await renameFiles(tmpDir, { find: 'IMG_', replace: 'photo_', dryRun: false });

    expect(fs.existsSync(path.join(tmpDir, 'photo_001.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'photo_002.jpg'))).toBe(true);
  });

  it('skips renaming when destination already exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'img.jpg'), 'original');
    await fs.writeFile(path.join(tmpDir, 'photo_.jpg'), 'existing');

    await renameFiles(tmpDir, { find: 'img', replace: 'photo_', dryRun: false });

    // Original should remain because destination exists
    expect(fs.existsSync(path.join(tmpDir, 'img.jpg'))).toBe(true);
  });

  it('only renames files with specified extension', async () => {
    await fs.writeFile(path.join(tmpDir, 'doc.pdf'), 'pdf');
    await fs.writeFile(path.join(tmpDir, 'photo.jpg'), 'jpg');

    await renameFiles(tmpDir, { case: 'upper', ext: 'pdf', dryRun: false });

    expect(fs.existsSync(path.join(tmpDir, 'DOC.pdf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'photo.jpg'))).toBe(true); // unchanged
  });

  it('applies case conversion correctly', async () => {
    await fs.writeFile(path.join(tmpDir, 'hello world.txt'), 'data');

    await renameFiles(tmpDir, { case: 'kebab', dryRun: false });

    expect(fs.existsSync(path.join(tmpDir, 'hello-world.txt'))).toBe(true);
  });
});
