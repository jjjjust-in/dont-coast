const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const token = event.headers['x-auth-token'] || event.headers['X-Auth-Token'];
  if (!token || token !== process.env.UPDATE_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { text, images, audioData, audioType, startTime, endTime, miles, elevation, startLocation, endLocation } = body;
  const store = getStore('journal');
  const id = Date.now();
  const update = {
    id, timestamp: id, text: text || '',
    startTime: startTime || null,
    endTime: endTime || null,
    miles: miles || null,
    elevation: elevation || null,
    startLocation: startLocation || null,
    endLocation: endLocation || null
  };

  // Handle array of images
  if (Array.isArray(images) && images.length) {
    update.imageKeys = [];
    for (let i = 0; i < images.length; i++) {
      const { data, type } = images[i];
      if (!data) continue;
      const imgKey = `media-${id}-img-${i}`;
      const buf = Buffer.from(data, 'base64');
      await store.set(imgKey, buf);
      await store.set(`${imgKey}-type`, type || 'image/jpeg');
      update.imageKeys.push(imgKey);
    }
  }

  if (audioData) {
    const audioKey = `media-${id}-audio`;
    const buf = Buffer.from(audioData, 'base64');
    await store.set(audioKey, buf);
    await store.set(`${audioKey}-type`, audioType || 'audio/m4a');
    update.audioKey = audioKey;
  }

  let updates = [];
  try {
    const raw = await store.get('updates');
    if (raw) updates = JSON.parse(raw);
  } catch {}

  updates.push(update);
  await store.set('updates', JSON.stringify(updates));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, id })
  };
};
