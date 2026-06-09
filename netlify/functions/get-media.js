const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;

  if (!key || !key.startsWith('media-')) {
    return { statusCode: 400, body: 'Invalid key' };
  }

  const store = getStore({ name: 'journal', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });

  try {
    const data = await store.get(key, { type: 'arrayBuffer' });
    if (!data) return { statusCode: 404, body: 'Not found' };

    const contentType = await store.get(`${key}-type`) || 'application/octet-stream';

    return {
      statusCode: 200,
      headers: { 'Content-Type': contentType },
      body: Buffer.from(data).toString('base64'),
      isBase64Encoded: true
    };
  } catch {
    return { statusCode: 404, body: 'Not found' };
  }
};
