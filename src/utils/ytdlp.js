const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const axios = require('axios');

const VENDOR_DIR = path.join(__dirname, '..', '..', 'bin', 'vendor');
const YTDLP_PATH = process.platform === 'win32' 
  ? path.join(VENDOR_DIR, 'yt-dlp.exe') 
  : path.join(VENDOR_DIR, 'yt-dlp');

/**
 * Ensures yt-dlp binary is available on the system PATH or local vendor folder.
 */
async function ensureYtDlp() {
  // 1. Check system PATH
  try {
    const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    const systemPath = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\r\n')[0];
    if (systemPath && fs.existsSync(systemPath)) {
      return systemPath;
    }
  } catch (e) {
    // Not found in system PATH
  }

  // 2. Check vendor directory
  if (fs.existsSync(YTDLP_PATH)) {
    return YTDLP_PATH;
  }

  // 3. Auto-download binary from GitHub releases
  if (!fs.existsSync(VENDOR_DIR)) {
    fs.mkdirSync(VENDOR_DIR, { recursive: true });
  }

  const downloadUrl = process.platform === 'win32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  console.log(`[Auto-Setup] Downloading yt-dlp binary from ${downloadUrl}...`);

  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'arraybuffer',
    timeout: 30000
  });

  fs.writeFileSync(YTDLP_PATH, response.data);
  if (process.platform !== 'win32') {
    fs.chmodSync(YTDLP_PATH, 0755);
  }

  console.log(`[Auto-Setup] yt-dlp ready at ${YTDLP_PATH}`);
  return YTDLP_PATH;
}

/**
 * Searches and downloads audio stream using yt-dlp.
 */
async function downloadAudioStream(searchQuery, outputPath, quality = '320k') {
  const binaryPath = await ensureYtDlp();

  return new Promise((resolve, reject) => {
    const args = [
      `ytsearch1:${searchQuery}`,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', quality.replace('k', ''),
      '-o', outputPath,
      '--no-playlist',
      '--quiet',
      '--no-warnings'
    ];

    const child = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderrData = '';
    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp download failed with code ${code}: ${stderrData}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  ensureYtDlp,
  downloadAudioStream
};
