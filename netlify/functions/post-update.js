const REPO = 'jjjjust-in/dont-coast';
const BRANCH = 'main';

async function ghGet(path, token) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!res.ok) return null;
  return res.json();
}

async function ghPut(path, contentBuf, message, sha, token) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      content: contentBuf.toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {})
    })
  });
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const token = event.headers['x-auth-token'] || event.headers['X-Auth-Token'];
  if (!token || token !== process.env.UPDATE_SECRET) return { statusCode: 401, body: 'Unauthorized' };

  const ghToken = process.env.GITHUB_TOKEN;

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { text, images, startTime, endTime, miles, elevation, startLocation, endLocation } = body;
  const id = Date.now();
  const update = {
    id, timestamp: id,
    text: text || '',
    startTime: startTime || null,
    endTime: endTime || null,
    miles: miles != null ? miles : null,
    elevation: elevation != null ? elevation : null,
    startLocation: startLocation || null,
    endLocation: endLocation || null
  };

  // Upload images to GitHub
  if (Array.isArray(images) && images.length) {
    update.imageKeys = [];
    for (let i = 0; i < images.length; i++) {
      const { data, type } = images[i];
      if (!data) continue;
      const ext = (type || 'image/jpeg').split('/')[1] || 'jpg';
      const filename = `journal-images/${id}-${i}.${ext}`;
      const ok = await ghPut(filename, Buffer.from(data, 'base64'), `Add journal image ${id}-${i}`, undefined, ghToken);
      if (ok) update.imageKeys.push(filename);
    }
  }

  // Read existing journal.json
  const existing = await ghGet('journal.json', ghToken);
  let updates = [];
  if (existing && existing.content) {
    try { updates = JSON.parse(Buffer.from(existing.content, 'base64').toString()); } catch {}
  }

  updates.push(update);

  const ok = await ghPut(
    'journal.json',
    Buffer.from(JSON.stringify(updates, null, 2)),
    `Journal entry ${id}`,
    existing ? existing.sha : undefined,
    ghToken
  );

  if (!ok) return { statusCode: 500, body: 'Failed to save to GitHub' };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, id })
  };
};
