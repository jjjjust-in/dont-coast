const REPO = 'jjjjust-in/dont-coast';
const BRANCH = 'main';

const RACES = {
  'tour-divide':    { start: '2026-06-12T07:30:00-06:00', windowDays: 21 },
  'colorado-trail': { start: '2026-08-02T04:00:00-06:00', windowDays: 8 },
  'arizona-trail':  { start: '2026-10-01T06:00:00-07:00', windowDays: 12 },
};

const BIKE_TYPES = new Set(['Ride', 'GravelRide', 'MountainBikeRide', 'VirtualRide', 'EBikeRide']);

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
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub PUT ${path} ${res.status}: ${errText}`);
  }
  return true;
}

async function getStravaAccessToken() {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: process.env.STRAVA_REFRESH_TOKEN,
    })
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function fetchActivities(accessToken, afterEpochSec, beforeEpochSec) {
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${afterEpochSec}&before=${beforeEpochSec}&per_page=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchActivityPhotoUrls(accessToken, activityId) {
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/photos?size=600`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return [];
    const photos = await res.json();
    return photos.map(p => p.urls && p.urls['600']).filter(Boolean);
  } catch {
    return [];
  }
}

async function reverseGeocode(latlng) {
  if (!Array.isArray(latlng) || latlng.length !== 2) return null;
  const [lat, lng] = latlng;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10`,
      { headers: { 'User-Agent': 'dont-coast-strava-sync/1.0 (https://github.com/jjjjust-in/dont-coast)' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const place = a.city || a.town || a.village || a.hamlet || a.county;
    const region = a.state_code || a.state || (a.country_code ? a.country_code.toUpperCase() : null);
    const label = [place, region].filter(Boolean).join(', ');
    return label || null;
  } catch {
    return null;
  }
}

// Strava's *_local timestamps carry a 'Z' suffix but represent local wall-clock
// time, not UTC — read components with the UTC getters to avoid double-shifting.
function formatLocalTime(isoLocal, offsetSeconds) {
  const d = new Date(new Date(isoLocal).getTime() + offsetSeconds * 1000);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

function dayNumberForTimestamp(ts, raceStartMs) {
  return Math.max(1, Math.floor((ts - raceStartMs) / 86400000) + 1);
}

async function buildEntryFromActivity(activity, accessToken, race) {
  const startMs = new Date(activity.start_date).getTime();
  const photoUrls = activity.total_photo_count > 0
    ? await fetchActivityPhotoUrls(accessToken, activity.id)
    : [];

  const imageKeys = [];
  for (let i = 0; i < photoUrls.length; i++) {
    try {
      const res = await fetch(photoUrls[i]);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const filename = `journal-images/${race}/${activity.id}-${i}.jpg`;
      await ghPut(filename, buf, `Strava photo for activity ${activity.id}`, undefined, process.env.GITHUB_TOKEN);
      imageKeys.push(filename);
    } catch {
      // best effort — skip photos that fail to download/commit
    }
  }

  const [startLocation, endLocation] = await Promise.all([
    reverseGeocode(activity.start_latlng),
    reverseGeocode(activity.end_latlng),
  ]);

  return {
    id: startMs,
    timestamp: startMs,
    text: activity.description || activity.name || '',
    startTime: formatLocalTime(activity.start_date_local, 0),
    endTime: formatLocalTime(activity.start_date_local, activity.elapsed_time),
    miles: Math.round((activity.distance / 1609.34) * 10) / 10,
    elevation: Math.round(activity.total_elevation_gain * 3.28084),
    startLocation,
    endLocation,
    imageKeys,
    source: 'strava',
    stravaId: activity.id,
  };
}

async function syncRace(race, accessToken, windowDaysOverride) {
  const cfg = RACES[race];
  const windowDays = windowDaysOverride || cfg.windowDays;
  const raceStartMs = new Date(cfg.start).getTime();
  const afterSec = Math.floor(raceStartMs / 1000) - 3600; // small buffer before start
  const beforeSec = Math.floor(raceStartMs / 1000) + windowDays * 86400;

  const activities = (await fetchActivities(accessToken, afterSec, beforeSec))
    .filter(a => BIKE_TYPES.has(a.type || a.sport_type));

  const journalPath = `journal/${race}.json`;
  const existingFile = await ghGet(journalPath, process.env.GITHUB_TOKEN);
  let entries = [];
  if (existingFile && existingFile.content) {
    try { entries = JSON.parse(Buffer.from(existingFile.content, 'base64').toString()); } catch {}
  }

  if (!activities.length) {
    return { race, freshEntries: 0, daysReplaced: 0 };
  }

  const freshEntries = [];
  for (const activity of activities) {
    freshEntries.push(await buildEntryFromActivity(activity, accessToken, race));
  }

  const freshDays = new Set(freshEntries.map(e => dayNumberForTimestamp(e.timestamp, raceStartMs)));

  const kept = entries.filter(e => {
    if (e.source !== 'placeholder' && e.source !== 'strava') return true; // never touch manual posts
    if (e.timestamp < raceStartMs) return true; // pre-race posts
    return !freshDays.has(dayNumberForTimestamp(e.timestamp, raceStartMs));
  });

  const merged = [...kept, ...freshEntries].sort((a, b) => a.timestamp - b.timestamp);

  await ghPut(
    journalPath,
    Buffer.from(JSON.stringify(merged, null, 2) + '\n'),
    `Sync Strava activities for ${race}`,
    existingFile ? existingFile.sha : undefined,
    process.env.GITHUB_TOKEN
  );

  return { race, freshEntries: freshEntries.length, daysReplaced: freshDays.size };
}

module.exports = { RACES, getStravaAccessToken, syncRace };
