const { getPlaylistInfo, fetchLyrics } = require('./index');

async function test() {
  console.log('Testing Spotify Metadata Extractor...');
  
  // Test track
  const sampleUrl = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'; // Rick Astley - Never Gonna Give You Up
  const info = await getPlaylistInfo(sampleUrl);
  console.log('Playlist Metadata Result:', JSON.stringify(info, null, 2));

  console.log('\nTesting LRCLIB Lyrics API...');
  const lyrics = await fetchLyrics('Never Gonna Give You Up', 'Rick Astley');
  console.log('Lyrics Found:', !!lyrics.plainLyrics, 'Synced Lyrics Found:', !!lyrics.syncedLyrics);
}

test().catch(console.error);
