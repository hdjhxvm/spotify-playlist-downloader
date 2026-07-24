const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { fetchLyrics } = require('../src/lyrics');

describe('fetchLyrics', () => {
  it('should return lyrics for a well-known song (integration)', async () => {
    const result = await fetchLyrics('Never Gonna Give You Up', 'Rick Astley');
    assert.ok(result.plainLyrics || result.syncedLyrics, 'Expected at least one lyrics type');
  });

  it('should return null lyrics for a nonexistent song without throwing', async () => {
    const result = await fetchLyrics('xyznonexistentsong12345', 'fakeartist99999');
    assert.strictEqual(result.plainLyrics, null);
    assert.strictEqual(result.syncedLyrics, null);
  });

  it('should return an object with plainLyrics and syncedLyrics keys', async () => {
    const result = await fetchLyrics('Test', 'Test');
    assert.ok('plainLyrics' in result, 'Missing plainLyrics key');
    assert.ok('syncedLyrics' in result, 'Missing syncedLyrics key');
  });
});
