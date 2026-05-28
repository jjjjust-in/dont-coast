const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  const store = getStore('journal');
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
