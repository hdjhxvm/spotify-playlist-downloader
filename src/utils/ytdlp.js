const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const axios = require('axios');
const log = require('./logger');

const VENDOR_DIR = path.join(__dirname, '..', '..', 'bin', 'vendor');
const YTDLP_PATH = process.platform === 'win32' 
  ? path.join(VENDOR_DIR, 'yt-dlp.exe') 
  : path.join(VENDOR_DIR, 'yt-dlp');

const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes per track

/**
 * Ensures yt-dlp binary is available on the system PATH or local vendor folder.
 */
async function ensureYtDlp() {
  // 1. Check system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    const systemPath = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\r\n')[0];
    if (systemPath && fs.existsSync(systemPath)) {
      log.debug('ytdlp', `Found yt-dlp in system PATH: ${systemPath}`);
      return systemPath;
    }
  } catch (e) {
    // Not found in system PATH
  }

  // 2. Check vendor directory
  if (fs.existsSync(YTDLP_PATH)) {
    log.debug('ytdlp', `Found yt-dlp in vendor dir: ${YTDLP_PATH}`);
    return YTDLP_PATH;
  }

  // 3. Auto-download binary from GitHub releases
  if (!fs.existsSync(VENDOR_DIR)) {
    fs.mkdirSync(VENDOR_DIR, { recursive: true });
  }

  const downloadUrl = process.platform === 'win32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  log.info('ytdlp', `Downloading yt-dlp binary from ${downloadUrl}...`);

  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'arraybuffer',
    timeout: 30000
  });

  fs.writeFileSync(YTDLP_PATH, response.data);
  if (process.platform !== 'win32') {
    fs.chmodSync(YTDLP_PATH, 0o755);
  }

  log.info('ytdlp', `yt-dlp ready at ${YTDLP_PATH}`);
  return YTDLP_PATH;
}

/**
 * Returns the directory containing ffmpeg binary (from ffmpeg-static, local vendor, or null).
 * yt-dlp's --ffmpeg-location expects a directory path, not a file path.
 */
function getFfmpegDir() {
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      log.debug('ytdlp', `Using ffmpeg-static: ${ffmpegStatic}`);
      return path.dirname(ffmpegStatic);
    }
  } catch (e) {}

  const vendorFfmpeg = process.platform === 'win32'
    ? path.join(VENDOR_DIR, 'ffmpeg.exe')
    : path.join(VENDOR_DIR, 'ffmpeg');

  if (fs.existsSync(vendorFfmpeg)) {
    return VENDOR_DIR;
  }

  return null;
}

/**
 * Scans the output directory for the downloaded file.
 * yt-dlp may produce a file with a different extension or suffix than expected.
 * Returns the actual file path, or null if not found.
 */
function findOutputFile(expectedPath) {
  // Check exact path first
  if (fs.existsSync(expectedPath)) {
    return expectedPath;
  }

  // Scan directory for files matching the base name
  const dir = path.dirname(expectedPath);
  const baseName = path.basename(expectedPath, path.extname(expectedPath));

  if (!fs.existsSync(dir)) return null;

  const candidates = fs.readdirSync(dir).filter(f => {
    const fBase = path.basename(f, path.extname(f));
    return fBase === baseName && f.endsWith('.mp3');
  });

  if (candidates.length > 0) {
    return path.join(dir, candidates[0]);
  }

  return null;
}

/**
 * Searches and downloads audio stream using yt-dlp.
 * @param {string} searchQuery - YouTube search query
 * @param {string} outputPath - Desired output .mp3 file path
 * @param {string} quality - Audio bitrate (e.g. '320k')
 * @param {object} [options] - Additional options
 * @param {number} [options.timeoutMs] - Max time to wait for download (default: 120000)
 */
async function downloadAudioStream(searchQuery, outputPath, quality = '320k', options = {}) {
  const binaryPath = await ensureYtDlp();
  const ffmpegDir = getFfmpegDir();
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const args = [
      `ytsearch1:${searchQuery}`,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', quality.replace('k', ''),
      '-o', outputPath,
      '--no-playlist',
      '--no-cache-dir',
      '--no-mtime',
      '--quiet',
      '--no-warnings'
    ];

    if (options.durationMs) {
      const durationSec = Math.round(options.durationMs / 1000);
      // Tolerance of 30 seconds to allow for music video intros/outros but block 10 min compilations
      const minDuration = Math.max(0, durationSec - 15);
      const maxDuration = durationSec + 30;
      args.push('--match-filter', `duration >= ${minDuration} & duration <= ${maxDuration}`);
    }

    if (ffmpegDir) {
      args.push('--ffmpeg-location', ffmpegDir);
    }

    log.debug('ytdlp', `Spawning: ${binaryPath} ${args.join(' ')}`);
    const child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderrData = '';
    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    // Process timeout
    const timer = setTimeout(() => {
      log.error('ytdlp', `Download timed out after ${timeoutMs / 1000}s, killing process`);
      child.kill('SIGTERM');
      reject(new Error(`yt-dlp download timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);

      // Scan for the actual output file (yt-dlp may alter the filename)
      const actualPath = findOutputFile(outputPath);

      if (code === 0 && actualPath) {
        // Rename to expected path if different
        if (actualPath !== outputPath) {
          log.debug('ytdlp', `Renaming output: ${actualPath} -> ${outputPath}`);
          fs.renameSync(actualPath, outputPath);
        }
        resolve(outputPath);
      } else if (code === 0 && !actualPath) {
        log.error('ytdlp', `yt-dlp exited successfully but output file not found at: ${outputPath}`);
        log.debug('ytdlp', `stderr: ${stderrData}`);
        reject(new Error(`yt-dlp completed but output file not found. Expected: ${outputPath}`));
      } else {
        log.error('ytdlp', `yt-dlp failed with code ${code}`);
        reject(new Error(`yt-dlp download failed with code ${code}: ${stderrData.trim()}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      log.error('ytdlp', `Failed to spawn yt-dlp: ${err.message}`);
      reject(err);
    });
  });
}

module.exports = {
  ensureYtDlp,
  downloadAudioStream
};

