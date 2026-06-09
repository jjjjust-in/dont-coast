const ROUTE_MILES = 2745;
const RACE_START = '2026-06-12';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

exports.handler = async () => {
  try {
    const res = await fetch(`https://share.garmin.com/Feed/Share/justinmckinley?d1=${RACE_START}`);
    const text = await res.text();

    // Parse all coordinate points from KML
    const matches = [...text.matchAll(/<coordinates>\s*([\-\d.]+),([\-\d.]+),[\-\d.]*\s*<\/coordinates>/g)];

    if (!matches.length) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: null, lng: null, distanceMiles: 0, distanceRemaining: ROUTE_MILES, percentComplete: 0 })
      };
    }

    // Calculate cumulative distance across all points
    let distanceMiles = 0;
    for (let i = 1; i < matches.length; i++) {
      const [, lng1, lat1] = matches[i - 1].map(Number);
      const [, lng2, lat2] = matches[i].map(Number);
      distanceMiles += haversine(lat1, lng1, lat2, lng2);
    }

    const last = matches[matches.length - 1];
    const lng = parseFloat(last[1]);
    const lat = parseFloat(last[2]);
    const distanceRemaining = Math.max(0, ROUTE_MILES - distanceMiles);
    const percentComplete = Math.min(100, (distanceMiles / ROUTE_MILES) * 100);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat, lng,
        distanceMiles: Math.round(distanceMiles),
        distanceRemaining: Math.round(distanceRemaining),
        percentComplete: Math.round(percentComplete * 10) / 10
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
