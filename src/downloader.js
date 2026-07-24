const fs = require('fs');
const path = require('path');
const { getPlaylistInfo } = require('./spotify');
const { fetchLyrics } = require('./lyrics');
const { downloadAudioStream } = require('./utils/ytdlp');
const { applyTags } = require('./tagger');

/**
 * Downloads a single track given its metadata.
 */
async function downloadTrack(track, options = {}) {
  const outputDir = options.outputDir || path.join(process.cwd(), 'downloads');
  const quality = options.quality || '320k';
  const embedLyrics = options.embedLyrics !== false;
  const saveLrcFile = options.saveLrcFile !== false;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean filename
  const safeFilename = `${track.artist} - ${track.title}`.replace(/[\\/:*?"<>|]/g, '_');
  const mp3Path = path.join(outputDir, `${safeFilename}.mp3`);
  const lrcPath = path.join(outputDir, `${safeFilename}.lrc`);

  // Skip download if already exists
  if (fs.existsSync(mp3Path)) {
    return { track, success: true, filePath: mp3Path, skipped: true };
  }

  try {
    if (options.onProgress) {
      options.onProgress({ track, status: 'downloading', percent: 20 });
    }

    // 1. Download audio stream via yt-dlp
    const searchQuery = `${track.artist} - ${track.title} official audio`;
    await downloadAudioStream(searchQuery, mp3Path, quality);

    if (options.onProgress) {
      options.onProgress({ track, status: 'fetching_lyrics', percent: 60 });
    }

    // 2. Fetch lyrics if requested
    let lyrics = { plainLyrics: null, syncedLyrics: null };
    if (embedLyrics || saveLrcFile) {
      lyrics = await fetchLyrics(track.title, track.artist, track.album);
    }

    // Save .lrc file if synced lyrics are found
    if (saveLrcFile && lyrics.syncedLyrics) {
      fs.writeFileSync(lrcPath, lyrics.syncedLyrics, 'utf-8');
    }

    if (options.onProgress) {
      options.onProgress({ track, status: 'tagging', percent: 85 });
    }

    // 3. Write ID3 Tags & Album Cover
    await applyTags(mp3Path, track, lyrics);

    if (options.onProgress) {
      options.onProgress({ track, status: 'completed', percent: 100 });
    }

    return { track, success: true, filePath: mp3Path };
  } catch (err) {
    if (options.onProgress) {
      options.onProgress({ track, status: 'failed', percent: 0, error: err.message });
    }
    return { track, success: false, error: err.message };
  }
}

/**
 * Downloads an entire Spotify playlist.
 */
async function downloadPlaylist(spotifyUrl, options = {}) {
  const playlistInfo = await getPlaylistInfo(spotifyUrl);
  const total = playlistInfo.tracks.length;
  const results = [];

  const targetDir = options.outputDir 
    ? path.join(options.outputDir, playlistInfo.title.replace(/[\\/:*?"<>|]/g, '_'))
    : path.join(process.cwd(), 'downloads', playlistInfo.title.replace(/[\\/:*?"<>|]/g, '_'));

  for (let i = 0; i < total; i++) {
    const track = playlistInfo.tracks[i];
    
    if (options.onTrackStart) {
      options.onTrackStart(track, i + 1, total);
    }

    const res = await downloadTrack(track, { ...options, outputDir: targetDir });
    results.push(res);

    if (options.onTrackEnd) {
      options.onTrackEnd(track, res.success, res.filePath, res.error);
    }
  }

  return results;
}

module.exports = {
  downloadTrack,
  downloadPlaylist
};
