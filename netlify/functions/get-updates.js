exports.handler = async () => {
  try {
    const res = await fetch(
      'https://api.github.com/repos/jjjjust-in/dont-coast/contents/journal.json',
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );
    if (!res.ok) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: '[]' };
    }
    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: content
    };
  } catch {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '[]' };
  }
};
