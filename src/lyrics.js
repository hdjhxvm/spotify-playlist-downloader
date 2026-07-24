const axios = require('axios');
const log = require('./utils/logger');

/**
 * LRCLIB Network Lyrics Client
 * Fetches synced (.lrc) and unsynchronised plain text lyrics.
 */

const LRCLIB_BASE_URL = 'https://lrclib.net/api';

/**
 * Searches and fetches lyrics for a track.
 */
async function fetchLyrics(trackName, artistName, albumName = '') {
  try {
    // 1. Direct GET query
    const response = await axios.get(`${LRCLIB_BASE_URL}/get`, {
      params: {
        track_name: trackName,
        artist_name: artistName,
        album_name: albumName
      },
      timeout: 5000
    });

    if (response.data) {
      return {
        plainLyrics: response.data.plainLyrics || null,
        syncedLyrics: response.data.syncedLyrics || null
      };
    }
  } catch (err) {
    // If exact match fails, try fuzzy search
    log.debug('lyrics', `Exact match failed for "${trackName}" by "${artistName}", trying fuzzy search`);
    try {
      const searchRes = await axios.get(`${LRCLIB_BASE_URL}/search`, {
        params: { q: `${trackName} ${artistName}` },
        timeout: 5000
      });

      if (searchRes.data && searchRes.data.length > 0) {
        const bestMatch = searchRes.data[0];
        return {
          plainLyrics: bestMatch.plainLyrics || null,
          syncedLyrics: bestMatch.syncedLyrics || null
        };
      }
    } catch (searchErr) {
      log.warn('lyrics', `Fuzzy search also failed for "${trackName}": ${searchErr.message}`);
    }
  }

  return { plainLyrics: null, syncedLyrics: null };
}

module.exports = {
  fetchLyrics
};
