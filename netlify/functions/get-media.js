exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;
  if (!key || !key.startsWith('journal-images/')) {
    return { statusCode: 400, body: 'Invalid key' };
  }
  return {
    statusCode: 302,
    headers: { Location: `https://raw.githubusercontent.com/jjjjust-in/dont-coast/main/${key}` }
  };
};
