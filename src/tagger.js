const fs = require('fs');
const axios = require('axios');
const NodeID3 = require('node-id3');
const log = require('./utils/logger');

/**
 * ID3 Tagging Engine
 * Writes Title, Artist, Album, Year, Cover Image, and Lyrics into MP3 files.
 */

async function applyTags(mp3FilePath, trackMetadata, lyrics = null) {
  let coverBuffer = null;

  // Download cover image if available
  if (trackMetadata.coverUrl) {
    try {
      const imageResponse = await axios.get(trackMetadata.coverUrl, {
        responseType: 'arraybuffer',
        timeout: 8000
      });
      coverBuffer = Buffer.from(imageResponse.data);
      log.debug('tagger', `Cover art downloaded (${coverBuffer.length} bytes)`);
    } catch (e) {
      log.warn('tagger', `Cover art download failed for "${trackMetadata.title}": ${e.message}`);
    }
  }

  const tags = {
    title: trackMetadata.title,
    artist: trackMetadata.artist,
    album: trackMetadata.album || 'Spotify Playlist',
    year: trackMetadata.releaseYear || ''
  };

  if (coverBuffer) {
    tags.image = {
      mime: 'image/jpeg',
      type: { id: 3, name: 'front cover' },
      description: 'Album Art',
      imageBuffer: coverBuffer
    };
  }

  // Embed unsynchronised lyrics inside MP3 metadata
  if (lyrics && lyrics.plainLyrics) {
    tags.unsynchronisedLyrics = {
      language: 'eng',
      text: lyrics.plainLyrics
    };
  }

  // Write tags to MP3 file
  const success = NodeID3.write(tags, mp3FilePath);
  return success;
}

module.exports = {
  applyTags
};
