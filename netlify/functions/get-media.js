const REPO = 'jjjjust-in/dont-coast';

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key || !key.startsWith('journal-images/')) {
    return { statusCode: 400, body: 'Invalid key' };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${key}`, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) return { statusCode: 404, body: 'Not found' };

    const json = await res.json();
    const ext = key.split('.').pop().toLowerCase();
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
    const contentType = mimeMap[ext] || 'image/jpeg';

    return {
      statusCode: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000' },
      body: json.content.replace(/\n/g, ''),
      isBase64Encoded: true
    };
  } catch {
    return { statusCode: 500, body: 'Error fetching image' };
  }
};
