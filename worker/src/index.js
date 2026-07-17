const encoder = new TextEncoder();

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://ulrichsturm.github.io';

  return {
    ...(origin === allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env) },
  });
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function validateInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  params.delete('hash');

  if (!receivedHash || !Number.isFinite(authDate)) return null;
  if ((Date.now() / 1000) - authDate > 86_400) return null;

  const dataCheckString = [...params.entries()]
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = await hmac('WebAppData', botToken);
  const expectedHash = toHex(await hmac(secretKey, dataCheckString));

  if (!constantTimeEqual(expectedHash, receivedHash)) return null;
  try {
    return JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/auth/telegram') {
      return json({ error: 'Not found' }, 404, request, env);
    }

    const origin = request.headers.get('Origin');
    if (origin !== (env.ALLOWED_ORIGIN || 'https://ulrichsturm.github.io')) {
      return json({ error: 'Origin is not allowed' }, 403, request, env);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, request, env);
    }

    if (typeof body?.initData !== 'string' || !env.BOT_TOKEN) {
      return json({ error: 'Authorization is unavailable' }, 401, request, env);
    }

    const user = await validateInitData(body.initData, env.BOT_TOKEN);
    if (!user?.id || !user.first_name) return json({ error: 'Invalid Telegram authorization' }, 401, request, env);

    await env.DB.prepare(`
      INSERT INTO players (telegram_id, username, first_name, last_name, language_code, photo_url)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        language_code = excluded.language_code,
        photo_url = excluded.photo_url,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      String(user.id), user.username || null, user.first_name, user.last_name || null,
      user.language_code || null, user.photo_url || null,
    ).run();

    return json({
      player: {
        id: String(user.id),
        firstName: user.first_name,
        username: user.username || null,
      },
    }, 200, request, env);
  },
};
