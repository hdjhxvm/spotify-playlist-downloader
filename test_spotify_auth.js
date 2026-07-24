const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('https://open.spotify.com/playlist/3tl9RMkL0rgVC2RN8EHZKZ', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const html = res.data;
    
    // Extract access token if it's embedded in the HTML initial state
    const tokenMatch = html.match(/"accessToken":"([^"]+)"/);
    if (tokenMatch) {
        console.log('Access Token Found in HTML!');
        
        // Let's test calling the API with this token
        const apiRes = await axios.get('https://api.spotify.com/v1/playlists/3tl9RMkL0rgVC2RN8EHZKZ/tracks?offset=0&limit=1', {
            headers: {
                'Authorization': `Bearer ${tokenMatch[1]}`
            }
        });
        console.log('API call successful! Track count:', apiRes.data.total);
    } else {
        console.log('Access token not found in HTML');
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}

test();
