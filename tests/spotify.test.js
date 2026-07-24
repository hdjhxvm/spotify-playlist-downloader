const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseSpotifyUrl } = require('../src/spotify');

describe('parseSpotifyUrl', () => {
  it('should parse a valid playlist URL', () => {
    const result = parseSpotifyUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    assert.deepStrictEqual(result, { type: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' });
  });

  it('should parse a valid track URL', () => {
    const result = parseSpotifyUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    assert.deepStrictEqual(result, { type: 'track', id: '4cOdK2wGLETKBW3PvgPWqT' });
  });

  it('should parse a valid album URL', () => {
    const result = parseSpotifyUrl('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3');
    assert.deepStrictEqual(result, { type: 'album', id: '1DFixLWuPkv3KT3TnV35m3' });
  });

  it('should ignore query parameters like ?si=...', () => {
    const result = parseSpotifyUrl('https://open.spotify.com/playlist/3tl9RMkL0rgVC2RN8EHZKZ?si=in0VLsC7TRyd98kl_V5T5A');
    assert.deepStrictEqual(result, { type: 'playlist', id: '3tl9RMkL0rgVC2RN8EHZKZ' });
  });

  it('should throw on an invalid URL', () => {
    assert.throws(() => parseSpotifyUrl('https://google.com'), {
      message: /Invalid Spotify URL/
    });
  });

  it('should throw on a Spotify URL without a supported type', () => {
    assert.throws(() => parseSpotifyUrl('https://open.spotify.com/artist/0gxyHStUsqpMadRV0Di1Qt'), {
      message: /Invalid Spotify URL/
    });
  });

  it('should throw on an empty string', () => {
    assert.throws(() => parseSpotifyUrl(''), {
      message: /Invalid Spotify URL/
    });
  });
});
