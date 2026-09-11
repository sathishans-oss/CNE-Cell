interface CloudflareEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  [key: string]: any;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

export const onRequestGet = async (context: {
  env: CloudflareEnv;
}): Promise<Response> => {
  const { env } = context;
  const apiKey = (
    env?.GEMINI_API_KEY ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    ''
  ).trim();

  return new Response(JSON.stringify({
    status: 'ok',
    service: 'CNE Management System API (Cloudflare)',
    aiAvailable: !!apiKey,
    model: (env?.GEMINI_MODEL || (typeof process !== 'undefined' && process.env?.GEMINI_MODEL) || 'gemini-3.1-flash-lite').trim(),
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: JSON_HEADERS
  });
};
