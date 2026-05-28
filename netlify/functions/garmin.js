exports.handler = async () => {
  try {
    const res = await fetch('https://share.garmin.com/Feed/Share/jjjjustin');
    const text = await res.text();

    // KML coordinates are lng,lat,elevation — grab the most recent point
    const matches = [...text.matchAll(/<coordinates>\s*([\-\d.]+),([\-\d.]+),[\-\d.]*\s*<\/coordinates>/g)];

    if (!matches.length) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: null, lng: null })
      };
    }

    // Last match is the most recent position
    const last = matches[matches.length - 1];
    const lng = parseFloat(last[1]);
    const lat = parseFloat(last[2]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
