const { getPlaylistInfo } = require('./src/spotify');
const { fetchLyrics } = require('./src/lyrics');
const { downloadTrack, downloadPlaylist } = require('./src/downloader');

/**
 * Spotify Playlist Downloader & Automation Library
 */

module.exports = {
  getPlaylistInfo,
  fetchLyrics,
  downloadTrack,
  downloadPlaylist
};
