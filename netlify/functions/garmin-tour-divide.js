// Race is complete — return hardcoded final values
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: 31.6817,
      lng: -107.8581,
      distanceMiles: 2720,
      distanceRemaining: 0,
      percentComplete: 100,
      finished: true
    })
  };
};
