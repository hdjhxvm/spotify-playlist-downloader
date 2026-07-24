const axios = require('axios');
const log = require('./utils/logger');

/**
 * Spotify Network Metadata Extractor
 * Fetches public Spotify Playlist, Album, and Track details without requiring client secret.
 */

const HTTP_CLIENT = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  }
});

/**
 * Parses Spotify URL to identify resource type and ID.
 */
function parseSpotifyUrl(url) {
  const match = url.match(/spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error('Invalid Spotify URL. Supported formats: playlist, album, or track links.');
  }
  return { type: match[1], id: match[2] };
}

/**
 * Gets an official Spotify API token using Client Credentials Flow.
 */
async function getOfficialApiToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      }
    });
    return response.data.access_token;
  } catch (e) {
    log.warn('spotify', `Failed to get official API token: ${e.message}`);
    return null;
  }
}

/**
 * Fetches all tracks of a playlist using official API (handles pagination).
 */
async function fetchFullPlaylistWithToken(id, token) {
  let tracks = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100&offset=0`;
  let playlistData = null;

  // First fetch to get playlist metadata
  try {
    const plRes = await axios.get(`https://api.spotify.com/v1/playlists/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    playlistData = plRes.data;
  } catch (e) {
    throw new Error(`Failed to fetch playlist metadata via API: ${e.message}`);
  }

  // Paginate tracks
  while (nextUrl) {
    try {
      const res = await axios.get(nextUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const pageItems = res.data.items || [];
      const pageTracks = pageItems.map((item, idx) => {
        const trackData = item.track || item;
        const artists = trackData.artists || [];
        const artistName = artists.map(a => a.name).join(', ') || 'Unknown Artist';

        return {
          id: trackData.id || `track_${idx}`,
          title: trackData.name || 'Unknown Track',
          artist: artistName,
          album: trackData.album?.name || playlistData.name || 'Spotify Playlist',
          releaseYear: trackData.album?.release_date ? trackData.album.release_date.split('-')[0] : '',
          durationMs: trackData.duration_ms || 0,
          coverUrl: trackData.album?.images?.[0]?.url || playlistData.images?.[0]?.url || '',
          isrc: trackData.external_ids?.isrc || ''
        };
      });
      
      tracks.push(...pageTracks);
      nextUrl = res.data.next;
    } catch (e) {
      log.warn('spotify', `Failed to fetch tracks page via API: ${e.message}`);
      break;
    }
  }

  return {
    id,
    title: playlistData.name || `PLAYLIST ${id}`,
    description: playlistData.description || 'Spotify Playlist',
    totalTracks: tracks.length,
    coverUrl: playlistData.images?.[0]?.url || '',
    tracks
  };
}

/**
 * Fetches metadata for Spotify Playlist, Album, or Single Track.
 */
async function getPlaylistInfo(url) {
  const { type, id } = parseSpotifyUrl(url);

  if (type === 'track') {
    const track = await fetchSingleTrackMetadata(id);
    return {
      id,
      title: track.title,
      description: 'Single Track',
      totalTracks: 1,
      coverUrl: track.coverUrl,
      tracks: [track]
    };
  }

  // 1. Try Official API first if credentials are provided (supports 400+ tracks)
  const officialToken = await getOfficialApiToken();
  if (officialToken && type === 'playlist') {
    log.info('spotify', 'Using official Spotify API to fetch playlist (Supports unlimited tracks)');
    return await fetchFullPlaylistWithToken(id, officialToken);
  }

  if (type === 'playlist') {
    log.warn('spotify', 'SPOTIFY_CLIENT_ID not found. Falling back to public embed page (Limited to first 100 tracks).');
  }

  // 2. Fetch playlist / album webpage embed data (Fallback)
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
  const response = await HTTP_CLIENT.get(embedUrl);
  const html = response.data;

  // Extract JSON payload embedded inside Spotify HTML embed (<script id="__NEXT_DATA__"> or <script id="initial-state">)
  let stateData = null;
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
  if (nextDataMatch) {
    try {
      stateData = JSON.parse(nextDataMatch[1]);
      log.debug('spotify', 'Successfully parsed __NEXT_DATA__ payload');
    } catch (e) {
      log.warn('spotify', `Failed to parse __NEXT_DATA__ JSON: ${e.message}`);
    }
  }

  if (!stateData) {
    const scriptMatch = html.match(/<script id="initial-state" type="text\/plain">(.*?)<\/script>/);
    if (scriptMatch) {
      try {
        const decodedJson = Buffer.from(scriptMatch[1], 'base64').toString('utf-8');
        stateData = JSON.parse(decodedJson);
        log.debug('spotify', 'Successfully parsed initial-state payload');
      } catch (e) {
        log.warn('spotify', `Failed to parse initial-state JSON: ${e.message}`);
      }
    }
  }

  if (!stateData) {
    log.warn('spotify', 'No structured data found in embed page — Spotify may have changed their HTML format');
  }

  let playlistTitle = `${type.toUpperCase()} ${id}`;
  let coverUrl = '';
  let tracks = [];

  if (stateData) {
    try {
      const entity = stateData?.props?.pageProps?.state?.data?.entity || stateData?.data?.entity || stateData?.entity;
      if (entity) {
        playlistTitle = entity.name || playlistTitle;
        coverUrl = entity.coverArt?.sources?.[0]?.url || entity.images?.[0]?.url || entity.visualIdentity?.image?.[0]?.url || '';

        const itemList = entity.trackList || entity.tracksList || entity.tracks?.items || [];
        
        tracks = itemList.map((item, idx) => {
          const trackData = item.track || item;
          const artists = trackData.artists || trackData.artistsList;
          let artistName = 'Unknown Artist';
          if (trackData.subtitle) {
            artistName = trackData.subtitle;
          } else if (Array.isArray(artists)) {
            artistName = artists.map(a => typeof a === 'string' ? a : a.name).join(', ');
          }

          return {
            id: trackData.id || (trackData.uri ? trackData.uri.split(':').pop() : `track_${idx}`),
            title: trackData.title || trackData.name || 'Unknown Track',
            artist: artistName,
            album: trackData.album?.name || entity.name || 'Spotify Playlist',
            releaseYear: trackData.album?.release_date ? trackData.album.release_date.split('-')[0] : '',
            durationMs: trackData.duration || trackData.duration_ms || 0,
            coverUrl: trackData.album?.images?.[0]?.url || coverUrl,
            isrc: trackData.external_ids?.isrc || ''
          };
        });
      }
    } catch (e) {
      log.error('spotify', `Failed to extract entity from state data: ${e.message}`);
      log.debug('spotify', 'State data keys:', Object.keys(stateData || {}));
    }
  }

  // Fallback if structured data parsing yielded 0 tracks
  if (tracks.length === 0) {
    log.warn('spotify', 'Structured parsing returned 0 tracks, attempting regex fallback');
    tracks = extractTracksByRegexFallback(html, playlistTitle, coverUrl);
    if (tracks.length === 0) {
      log.warn('spotify', 'Regex fallback also returned 0 tracks — the playlist may be empty or Spotify changed their format');
    }
  }

  return {
    id,
    title: playlistTitle,
    description: `Spotify ${type}`,
    totalTracks: tracks.length,
    coverUrl,
    tracks
  };
}

/**
 * Fetches metadata for a single track using oEmbed API.
 */
async function fetchSingleTrackMetadata(trackId) {
  const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
  const response = await HTTP_CLIENT.get(oembedUrl);
  const data = response.data;

  // Title format can be "Never Gonna Give You Up", "Track by Artist", or "Track - song and lyrics by Artist | Spotify"
  let rawTitle = data.title || 'Unknown Track';
  rawTitle = rawTitle.replace(/\s*-\s*song (and|&) lyrics by.*/i, '');

  let title = rawTitle;
  let artist = 'Unknown Artist';

  if (rawTitle.includes(' by ')) {
    const parts = rawTitle.split(' by ');
    title = parts[0].trim();
    artist = parts.slice(1).join(' by ').trim();
  } else if (data.author_name) {
    artist = data.author_name;
  }

  return {
    id: trackId,
    title,
    artist,
    album: 'Spotify Single',
    coverUrl: data.thumbnail_url || '',
    durationMs: 0
  };
}

/**
 * Regex fallback for scraping Spotify HTML embed lists.
 */
function extractTracksByRegexFallback(html, defaultAlbum, defaultCover) {
  const tracks = [];
  const trackMatches = html.matchAll(/"name":"([^"]+)".*?"artists":\[(.*?)\]/g);

  for (const match of trackMatches) {
    const title = match[1];
    const artistMatch = match[2].match(/"name":"([^"]+)"/);
    const artist = artistMatch ? artistMatch[1] : 'Unknown Artist';

    tracks.push({
      id: `track_${tracks.length + 1}`,
      title,
      artist,
      album: defaultAlbum,
      coverUrl: defaultCover
    });
  }

  return tracks;
}

module.exports = {
  parseSpotifyUrl,
  getPlaylistInfo
};
