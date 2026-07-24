# 🎵 Spotify Playlist Downloader & Automation Library

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

Network-grade automation tool and Node.js library to download Spotify playlists, albums, and tracks as high-quality MP3s with complete **ID3 metadata**, **album art**, and **synced lyrics (.lrc)**.

Designed for both **CLI power-users** and **Mobile/Web App developers** looking for an easy-to-integrate music downloader engine.

---

## ✨ Features

- 🎧 **High Quality MP3s**: Converts audio up to 320kbps using `FFmpeg`.
- 📜 **Synced & Plain Lyrics**: Automatically fetches and embeds lyrics via `LRCLIB API` into ID3 tags and creates `.lrc` files.
- 🖼️ **Full ID3 Tagging**: Embeds title, artist, album, release year, and HD cover art directly into the `.mp3`.
- ⚡ **Zero Spotify API Key Required**: Works out-of-the-box with public Spotify links.
- 📱 **Mobile & Backend Ready**: Exports clean JavaScript / TypeScript async API with progress callbacks (`onProgress`).
- 🤖 **Auto-Vendor Binary Setup**: Automatically downloads standalone `yt-dlp` binary if not present on your system.
- 🚀 **Enterprise-Grade Performance**: Smart duration matching and `yt-dlp` RAM optimization for downloading 400+ tracks efficiently.

---

## 🔑 Downloading Large Playlists (>100 tracks)

By default, the script fetches tracks using Spotify's public embed page, which limits playlists to the first **100 tracks**. 
To bypass this limit and download playlists of any size (e.g. 400+ tracks), provide official Spotify API credentials via environment variables:

```bash
# Windows (PowerShell)
$env:SPOTIFY_CLIENT_ID="your_client_id"
$env:SPOTIFY_CLIENT_SECRET="your_client_secret"

# Linux / macOS
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
```

You can get these keys for free by creating an app on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

---

## 🚀 Quick Start (CLI Usage)

You can run the CLI directly using Node.js:

```bash
node bin/cli.js "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
```

Or pass options:

```bash
node bin/cli.js -o ./my_music -q 320k --no-lrc
```

### CLI Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `-o, --output <dir>` | Output folder for downloaded tracks | `./downloads` |
| `-q, --quality <bitrate>` | Audio quality (`128k`, `192k`, `256k`, `320k`) | `320k` |
| `--no-lyrics` | Disable fetching and embedding lyrics | `false` |
| `--no-lrc` | Disable saving separate `.lrc` synced lyrics files | `false` |

---

## 📦 Library API Usage (for Mobile Backends & Node.js)

Install via npm:

```bash
npm install spotify-playlist-downloader
```

### Download an Entire Playlist with Progress Callbacks

```javascript
const { downloadPlaylist, getPlaylistInfo } = require('spotify-playlist-downloader');

async function run() {
  const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';

  // 1. Fetch metadata
  const info = await getPlaylistInfo(url);
  console.log(`Downloading ${info.title} (${info.totalTracks} tracks)`);

  // 2. Download with real-time callbacks
  const results = await downloadPlaylist(url, {
    outputDir: './downloads',
    quality: '320k',
    embedLyrics: true,
    saveLrcFile: true,
    onProgress: (prog) => {
      console.log(`Progress: ${prog.track.title} -> ${prog.status} (${prog.percent}%)`);
    },
    onTrackEnd: (track, success, filePath, error) => {
      if (success) {
        console.log(`Finished: ${filePath}`);
      } else {
        console.error(`Failed ${track.title}: ${error}`);
      }
    }
  });

  console.log('Completed download task!', results);
}

run();
```

---

## 📄 License

[MIT License](LICENSE) - Free to use in personal, open-source, or commercial projects.
