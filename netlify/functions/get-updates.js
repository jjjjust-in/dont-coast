const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  const store = getStore({ name: 'journal', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
  let updates = [];

  try {
    const raw = await store.get('updates');
    if (raw) updates = JSON.parse(raw);
  } catch {}

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    body: JSON.stringify(updates)
  };
};
