const axios = require('axios');

async function testToken() {
    try {
        const response = await axios.get('https://open.spotify.com/playlist/3tl9RMkL0rgVC2RN8EHZKZ');
        
        const html = response.data;
        const stateMatch = html.match(/<script id="initialState" type="text\/plain">(.*?)<\/script>/);
        if (stateMatch) {
            const stateData = Buffer.from(stateMatch[1], 'base64').toString('utf-8');
            const stateJson = JSON.parse(stateData);
            
            // accessToken is usually under session -> accessToken? Or we can just regex the decoded string.
            const tokenMatch = stateData.match(/"accessToken":"([^"]+)"/);
            if (tokenMatch) {
                console.log('Access Token Found:', tokenMatch[1].substring(0, 20) + '...');
                
                // test pagination
                const apiRes = await axios.get('https://api.spotify.com/v1/playlists/3tl9RMkL0rgVC2RN8EHZKZ/tracks?offset=0&limit=1', {
                    headers: {
                        'Authorization': `Bearer ${tokenMatch[1]}`
                    }
                });
                console.log('API call successful! Track count:', apiRes.data.total);
            } else {
                console.log('Access Token not found in decoded state:', stateData.substring(0, 100));
            }
        } else {
            console.log('InitialState script not found');
        }
    } catch(e) {
        console.log('API Failed:', e.message);
    }
}
testToken();
