const fs = require('fs');
const path = require('path');
const { getPlaylistInfo } = require('./spotify');
const { fetchLyrics } = require('./lyrics');
const { downloadAudioStream } = require('./utils/ytdlp');
const { applyTags } = require('./tagger');
const log = require('./utils/logger');

const VALID_QUALITIES = ['128k', '192k', '256k', '320k'];

// Windows reserved filenames
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
const MAX_FILENAME_LENGTH = 200;

/**
 * Sanitizes a string for use as a filename on all platforms.
 * Handles illegal characters, Windows reserved names, trailing dots, and length limits.
 */
function sanitizeFilename(str) {
  let safe = (str || '').replace(/[\\/:*?"<>|]/g, '_').trim();

  // Remove trailing dots and spaces (Windows doesn't allow them)
  safe = safe.replace(/[.\s]+$/, '');

  // Handle Windows reserved names
  if (RESERVED_NAMES.test(safe)) {
    safe = `_${safe}`;
  }

  // Truncate if too long
  if (safe.length > MAX_FILENAME_LENGTH) {
    safe = safe.substring(0, MAX_FILENAME_LENGTH);
  }

  return safe || 'untitled';
}

/**
 * Downloads a single track given its metadata.
 */
async function downloadTrack(track, options = {}) {
  const outputDir = options.outputDir || path.join(process.cwd(), 'downloads');
  const quality = options.quality || '320k';
  const embedLyrics = options.embedLyrics !== false;
  const saveLrcFile = options.saveLrcFile !== false;

  // Validate quality
  if (!VALID_QUALITIES.includes(quality)) {
    throw new Error(`Invalid quality "${quality}". Supported: ${VALID_QUALITIES.join(', ')}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clean filename
  const safeFilename = sanitizeFilename(`${track.artist} - ${track.title}`);
  const mp3FileName = `${safeFilename}.mp3`;
  const mp3Path = path.join(outputDir, mp3FileName);
  const lrcPath = path.join(outputDir, `${safeFilename}.lrc`);

  // Skip download if already exists (O(1) RAM lookup if cache exists, fallback to Disk I/O)
  if (options.existingFilesCache?.has(mp3FileName) || (!options.existingFilesCache && fs.existsSync(mp3Path))) {
    log.debug('downloader', `Skipping (already exists): ${safeFilename}`);
    return { track, success: true, filePath: mp3Path, skipped: true };
  }

  try {
    if (options.onProgress) {
      options.onProgress({ track, status: 'downloading', percent: 20 });
    }

    // 1. Download audio stream via yt-dlp
    // Use primary artist to avoid sponsor/feature noise in search (e.g. "Amr Diab, Orange" -> "Amr Diab")
    const mainArtist = (track.artist || '').split(/[,;&]/)[0].trim();
    const searchQuery = `${mainArtist} ${track.title} official audio`;
    await downloadAudioStream(searchQuery, mp3Path, quality, { durationMs: track.durationMs });

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
 * Simple Promise pool — runs tasks with limited concurrency.
 * @param {Array<() => Promise>} tasks - Array of functions that return promises
 * @param {number} concurrency - Max number of parallel tasks
 * @returns {Promise<Array>} - Results in original order
 */
async function promisePool(tasks, concurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Delays execution for a given number of milliseconds.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Downloads an entire Spotify playlist with concurrent downloads and retry logic.
 */
async function downloadPlaylist(spotifyUrl, options = {}) {
  const playlistInfo = await getPlaylistInfo(spotifyUrl);
  const total = playlistInfo.tracks.length;
  const concurrent = options.concurrent || 3;
  const maxRetries = options.maxRetries ?? 1;

  const sanitizedTitle = sanitizeFilename(playlistInfo.title);
  const targetDir = options.outputDir 
    ? path.join(options.outputDir, sanitizedTitle)
    : path.join(process.cwd(), 'downloads', sanitizedTitle);

  log.debug('downloader', `Downloading ${total} tracks (concurrency: ${concurrent}, retries: ${maxRetries})`);

  // Pre-Scan target directory for existing files to build O(1) lookup cache (Massive CPU/Disk I/O optimization)
  const existingFilesCache = new Set();
  if (fs.existsSync(targetDir)) {
    try {
      const files = fs.readdirSync(targetDir);
      for (const f of files) {
        existingFilesCache.add(f);
      }
      log.debug('downloader', `Pre-scanned ${existingFilesCache.size} existing files for fast skipping.`);
    } catch (e) {
      log.warn('downloader', `Could not pre-scan directory: ${e.message}`);
    }
  }
  options.existingFilesCache = existingFilesCache;

  const tasks = playlistInfo.tracks.map((track, i) => {
    return async () => {
      if (options.onTrackStart) {
        options.onTrackStart(track, i + 1, total);
      }

      let res = await downloadTrack(track, { ...options, outputDir: targetDir });

      // Retry logic for failed tracks
      if (!res.success && maxRetries > 0) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          log.warn('downloader', `Retry ${attempt}/${maxRetries} for "${track.title}"`);
          await delay(2000 * attempt); // exponential backoff: 2s, 4s, ...
          res = await downloadTrack(track, { ...options, outputDir: targetDir });
          if (res.success) break;
        }
      }

      if (options.onTrackEnd) {
        options.onTrackEnd(track, res.success, res.filePath, res.error);
      }

      return res;
    };
  });

  const results = await promisePool(tasks, concurrent);
  return results;
}

module.exports = {
  downloadTrack,
  downloadPlaylist,
  sanitizeFilename // exported for testing
};
