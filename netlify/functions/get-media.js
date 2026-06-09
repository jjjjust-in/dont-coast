const REPO = 'jjjjust-in/dont-coast';

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key || !key.startsWith('journal-images/')) {
    return { statusCode: 400, body: 'Invalid key' };
  }

  try {
    // Use raw media type — works for files > 1MB
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${key}`, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.raw+json'
      }
    });

    if (!res.ok) return { statusCode: res.status, body: 'Not found' };

    const buf = Buffer.from(await res.arrayBuffer());
    const ext = key.split('.').pop().toLowerCase();
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
    const contentType = mimeMap[ext] || 'image/jpeg';

    return {
      statusCode: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000' },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
