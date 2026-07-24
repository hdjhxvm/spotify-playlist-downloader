const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeFilename } = require('../src/downloader');

describe('sanitizeFilename', () => {
  it('should remove illegal characters', () => {
    assert.strictEqual(sanitizeFilename('hello/world:test'), 'hello_world_test');
  });

  it('should replace all Windows-illegal characters', () => {
    const result = sanitizeFilename('file\\name:with*bad?"chars<>|');
    assert.ok(!result.match(/[\\/:*?"<>|]/), `Result "${result}" still contains illegal chars`);
  });

  it('should trim whitespace', () => {
    assert.strictEqual(sanitizeFilename('  hello world  '), 'hello world');
  });

  it('should remove trailing dots', () => {
    assert.strictEqual(sanitizeFilename('filename...'), 'filename');
  });

  it('should handle Windows reserved names', () => {
    const result = sanitizeFilename('CON');
    assert.ok(result !== 'CON', `Reserved name "CON" should be prefixed`);
    assert.ok(result.includes('CON'));
  });

  it('should handle NUL reserved name', () => {
    const result = sanitizeFilename('NUL');
    assert.ok(result !== 'NUL', `Reserved name "NUL" should be prefixed`);
  });

  it('should handle COM1 reserved name', () => {
    const result = sanitizeFilename('COM1');
    assert.ok(result !== 'COM1', `Reserved name "COM1" should be prefixed`);
  });

  it('should truncate very long filenames', () => {
    const longName = 'A'.repeat(300);
    const result = sanitizeFilename(longName);
    assert.ok(result.length <= 200, `Length ${result.length} exceeds 200`);
  });

  it('should return "untitled" for empty string', () => {
    assert.strictEqual(sanitizeFilename(''), 'untitled');
  });

  it('should return "untitled" for null/undefined', () => {
    assert.strictEqual(sanitizeFilename(null), 'untitled');
    assert.strictEqual(sanitizeFilename(undefined), 'untitled');
  });

  it('should handle Arabic and Unicode characters', () => {
    const result = sanitizeFilename('SABAH EL WARD / صباح الورد');
    assert.ok(result.length > 0);
    assert.ok(!result.includes('/'));
  });

  it('should handle realistic track names', () => {
    const result = sanitizeFilename('DizzyTooSkinny - Ya Helwa Blil');
    assert.strictEqual(result, 'DizzyTooSkinny - Ya Helwa Blil');
  });
});

describe('quality validation', () => {
  const { downloadTrack } = require('../src/downloader');

  it('should reject invalid quality values', async () => {
    await assert.rejects(
      () => downloadTrack({ artist: 'Test', title: 'Test' }, { quality: '999k' }),
      { message: /Invalid quality/ }
    );
  });

  it('should reject non-standard quality strings', async () => {
    await assert.rejects(
      () => downloadTrack({ artist: 'Test', title: 'Test' }, { quality: 'banana' }),
      { message: /Invalid quality/ }
    );
  });
});
