const axios = require('axios');

/**
 * Spotify Network Metadata Extractor
 * Fetches public Spotify Playlist, Album, and Track details without requiring client secret.
 */

const HTTP_CLIENT = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36',
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

  // Fetch playlist / album webpage embed data
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
  const response = await HTTP_CLIENT.get(embedUrl);
  const html = response.data;

  // Extract JSON payload embedded inside Spotify HTML embed (<script id="__NEXT_DATA__"> or <script id="initial-state">)
  let stateData = null;
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
  if (nextDataMatch) {
    try {
      stateData = JSON.parse(nextDataMatch[1]);
    } catch (e) {}
  }

  if (!stateData) {
    const scriptMatch = html.match(/<script id="initial-state" type="text\/plain">(.*?)<\/script>/);
    if (scriptMatch) {
      try {
        const decodedJson = Buffer.from(scriptMatch[1], 'base64').toString('utf-8');
        stateData = JSON.parse(decodedJson);
      } catch (e) {}
    }
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
      // Fallback regex scraping if JSON structure differs
    }
  }

  // Fallback if initial-state parsing yielded 0 tracks
  if (tracks.length === 0) {
    tracks = extractTracksByRegexFallback(html, playlistTitle, coverUrl);
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
