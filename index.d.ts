/**
 * Spotify Playlist Downloader & Automation Library
 * TypeScript Definitions for Mobile & Backend Engineers
 */

export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseYear?: string;
  durationMs?: number;
  coverUrl?: string;
  isrc?: string;
}

export interface PlaylistMetadata {
  id: string;
  title: string;
  description?: string;
  owner?: string;
  totalTracks: number;
  coverUrl?: string;
  tracks: TrackMetadata[];
}

export interface LyricsData {
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface DownloadOptions {
  outputDir?: string;
  quality?: '128k' | '192k' | '256k' | '320k';
  embedLyrics?: boolean;
  saveLrcFile?: boolean;
  concurrent?: number;
  maxRetries?: number;
  onProgress?: (progress: {
    track: TrackMetadata;
    status: 'fetching' | 'downloading' | 'converting' | 'tagging' | 'completed' | 'failed';
    percent: number;
    error?: string;
  }) => void;
  onTrackStart?: (track: TrackMetadata, index: number, total: number) => void;
  onTrackEnd?: (track: TrackMetadata, success: boolean, filePath?: string, error?: string) => void;
}

export interface DownloadResult {
  track: TrackMetadata;
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Parses a Spotify URL and fetches track/playlist metadata.
 */
export function getPlaylistInfo(spotifyUrl: string): Promise<PlaylistMetadata>;

/**
 * Downloads a single track from Spotify metadata.
 */
export function downloadTrack(track: TrackMetadata, options?: DownloadOptions): Promise<DownloadResult>;

/**
 * Downloads an entire Spotify playlist.
 */
export function downloadPlaylist(spotifyUrl: string, options?: DownloadOptions): Promise<DownloadResult[]>;

/**
 * Fetches lyrics from LRCLIB.
 */
export function fetchLyrics(trackName: string, artistName: string, albumName?: string): Promise<LyricsData>;
