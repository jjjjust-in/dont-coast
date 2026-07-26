const { RACES, getStravaAccessToken, syncRace } = require('./lib/strava-sync');

// Manual/on-demand endpoint (backfills, tests). The scheduled daily sync lives
// in sync-strava-scheduled.js — Netlify returns a bare 403 for direct HTTP
// requests to any function registered with a `schedule`, so the two are kept
// separate and share this logic via lib/strava-sync.js.
exports.handler = async (event) => {
  const token = event.headers['x-auth-token'] || event.headers['X-Auth-Token'];
  if (!token || token !== process.env.UPDATE_SECRET) return { statusCode: 401, body: 'Unauthorized' };

  const params = event.queryStringParameters || {};
  const raceParam = params.race;
  const racesToSync = RACES[raceParam] ? [raceParam] : Object.keys(RACES);
  const daysParam = parseInt(params.days, 10);
  const windowDaysOverride = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined;

  try {
    const accessToken = await getStravaAccessToken();
    const results = [];
    for (const race of racesToSync) {
      results.push(await syncRace(race, accessToken, windowDaysOverride));
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, results })
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
