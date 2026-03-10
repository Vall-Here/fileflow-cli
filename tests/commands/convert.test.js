/**
 * convert.test.js - Tests for data file converter command
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { readFile, writeFile, convertFile, SUPPORTED_FORMATS } from '../../src/commands/convert.js';

describe('readFile', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-convert-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('parses a CSV file correctly', async () => {
    const csvPath = path.join(tmpDir, 'data.csv');
    await fs.writeFile(csvPath, 'name,age\nAlice,30\nBob,25\n');

    const rows = await readFile(csvPath);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'Alice', age: 30 });
    expect(rows[1]).toMatchObject({ name: 'Bob', age: 25 });
  });

  it('parses a JSON array file correctly', async () => {
    const jsonPath = path.join(tmpDir, 'data.json');
    await fs.writeFile(jsonPath, JSON.stringify([{ id: 1, val: 'a' }, { id: 2, val: 'b' }]));

    const rows = await readFile(jsonPath);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 1, val: 'a' });
  });

  it('parses a JSON object with data property', async () => {
    const jsonPath = path.join(tmpDir, 'wrapped.json');
    await fs.writeFile(jsonPath, JSON.stringify({ data: [{ x: 1 }, { x: 2 }] }));

    const rows = await readFile(jsonPath);

    expect(rows).toHaveLength(2);
  });

  it('parses a single JSON object as a single-row array', async () => {
    const jsonPath = path.join(tmpDir, 'single.json');
    await fs.writeFile(jsonPath, JSON.stringify({ key: 'value' }));

    const rows = await readFile(jsonPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'value' });
  });

  it('throws on unsupported format', async () => {
    const unsupported = path.join(tmpDir, 'file.xyz');
    await fs.writeFile(unsupported, 'data');

    await expect(readFile(unsupported)).rejects.toThrow('Unsupported format');
  });
});

describe('writeFile', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-write-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('writes valid JSON output', async () => {
    const outputPath = path.join(tmpDir, 'output.json');
    const data = [{ name: 'Alice', age: 30 }];

    await writeFile(data, outputPath);

    const content = await fs.readFile(outputPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ name: 'Alice', age: 30 });
  });

  it('writes minified JSON when minify option is true', async () => {
    const outputPath = path.join(tmpDir, 'minified.json');
    await writeFile([{ a: 1 }], outputPath, { minify: true });

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).not.toContain('\n');
  });

  it('writes valid CSV output', async () => {
    const outputPath = path.join(tmpDir, 'output.csv');
    const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];

    await writeFile(data, outputPath);

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).toContain('name');
    expect(content).toContain('Alice');
    expect(content).toContain('Bob');
  });

  it('uses custom delimiter for CSV output', async () => {
    const outputPath = path.join(tmpDir, 'semicolon.csv');
    await writeFile([{ a: 1, b: 2 }], outputPath, { delimiter: ';' });

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).toContain(';');
  });

  it('throws on unsupported output format', async () => {
    const badPath = path.join(tmpDir, 'output.xyz');
    await expect(writeFile([{ a: 1 }], badPath)).rejects.toThrow('Unsupported output format');
  });
});

describe('convertFile', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileflow-convertfile-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('converts CSV to JSON end-to-end', async () => {
    const csvPath = path.join(tmpDir, 'input.csv');
    await fs.writeFile(csvPath, 'name,score\nAlice,95\nBob,87\n');

    const { outputPath, rowCount } = await convertFile(csvPath, 'json');

    expect(rowCount).toBe(2);
    expect(path.extname(outputPath)).toBe('.json');

    const parsed = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    expect(parsed[0]).toMatchObject({ name: 'Alice', score: 95 });
  });

  it('converts JSON to CSV end-to-end', async () => {
    const jsonPath = path.join(tmpDir, 'input.json');
    await fs.writeFile(jsonPath, JSON.stringify([{ x: 1, y: 2 }, { x: 3, y: 4 }]));

    const { outputPath, rowCount } = await convertFile(jsonPath, 'csv');

    expect(rowCount).toBe(2);
    expect(path.extname(outputPath)).toBe('.csv');

    const content = await fs.readFile(outputPath, 'utf-8');
    expect(content).toContain('x');
    expect(content).toContain('1');
  });

  it('throws when input format is unsupported', async () => {
    const bad = path.join(tmpDir, 'file.xyz');
    await fs.writeFile(bad, 'data');

    await expect(convertFile(bad, 'json')).rejects.toThrow('Unsupported input format');
  });

  it('throws when output format is unsupported', async () => {
    const csvPath = path.join(tmpDir, 'input.csv');
    await fs.writeFile(csvPath, 'a,b\n1,2\n');

    await expect(convertFile(csvPath, 'xml')).rejects.toThrow('Unsupported output format');
  });

  it('throws when input and output formats are the same', async () => {
    const csvPath = path.join(tmpDir, 'input.csv');
    await fs.writeFile(csvPath, 'a,b\n1,2\n');

    await expect(convertFile(csvPath, 'csv')).rejects.toThrow('same');
  });

  it('uses custom output directory when specified', async () => {
    const csvPath = path.join(tmpDir, 'data.csv');
    const outDir = path.join(tmpDir, 'output');
    await fs.writeFile(csvPath, 'k,v\n1,2\n');

    const { outputPath } = await convertFile(csvPath, 'json', { output: outDir });

    expect(outputPath).toContain(outDir);
    expect(fs.existsSync(outputPath)).toBe(true);
  });
});

describe('SUPPORTED_FORMATS', () => {
  it('includes csv, json, xlsx, xls', () => {
    expect(SUPPORTED_FORMATS).toContain('csv');
    expect(SUPPORTED_FORMATS).toContain('json');
    expect(SUPPORTED_FORMATS).toContain('xlsx');
    expect(SUPPORTED_FORMATS).toContain('xls');
  });
});
