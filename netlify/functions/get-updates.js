exports.handler = async () => {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/jjjjust-in/dont-coast/main/journal.json?t=${Date.now()}`
    );
    const text = res.ok ? await res.text() : '[]';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: text
    };
  } catch {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '[]' };
  }
};
