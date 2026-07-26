const { RACES, getStravaAccessToken, syncRace } = require('./lib/strava-sync');

// Registered with a `schedule` in netlify.toml — Netlify invokes this
// automatically once a day. Not meant to be hit directly over HTTP; see
// sync-strava.js for the manual/backfill entry point.
exports.handler = async () => {
  try {
    const accessToken = await getStravaAccessToken();
    const results = [];
    for (const race of Object.keys(RACES)) {
      results.push(await syncRace(race, accessToken));
    }
    console.log('sync-strava-scheduled results:', JSON.stringify(results));
    return { statusCode: 200, body: JSON.stringify({ success: true, results }) };
  } catch (err) {
    console.error('sync-strava-scheduled error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
