const encoder = new TextEncoder();

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://ulrichsturm.github.io';

  return {
    ...(origin === allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

async function upsertPlayer(db, user) {
  await db.prepare(`
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
}

async function playerSummary(db, telegramId) {
  return db.prepare(`
    SELECT telegram_id AS id, username, first_name AS firstName, best_score AS bestScore
    FROM players WHERE telegram_id = ?
  `).bind(String(telegramId)).first();
}

function withLeague(player) {
  const league = Number(player.bestScore) >= 888 ? 8888 : 888;
  return {
    ...player,
    league,
    displayName: player.username ? `@${player.username}` : player.firstName,
  };
}

async function authorizeRequest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: 'Invalid JSON body', status: 400 };
  }
  if (typeof body?.initData !== 'string' || !env.BOT_TOKEN) {
    return { error: 'Authorization is unavailable', status: 401 };
  }
  const user = await validateInitData(body.initData, env.BOT_TOKEN);
  if (!user?.id || !user.first_name) return { error: 'Invalid Telegram authorization', status: 401 };
  await upsertPlayer(env.DB, user);
  return { user, body };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const isPublicLeaderboard = request.method === 'GET' && url.pathname === '/leaderboard';
    if (!isPublicLeaderboard && origin !== (env.ALLOWED_ORIGIN || 'https://ulrichsturm.github.io')) {
      return json({ error: 'Origin is not allowed' }, 403, request, env);
    }

    if (request.method === 'GET' && url.pathname === '/leaderboard') {
      const league = Number(url.searchParams.get('league')) === 8888 ? 8888 : 888;
      const minimumScore = league === 8888 ? 888 : 1;
      const maximumScore = league === 8888 ? 8888 : 887;
      const { results } = await env.DB.prepare(`
        SELECT telegram_id AS id, username, first_name AS firstName, best_score AS bestScore
        FROM players
        WHERE best_score BETWEEN ? AND ?
        ORDER BY best_score DESC, updated_at ASC
        LIMIT 100
      `).bind(minimumScore, maximumScore).all();
      return json({ league, leaderboard: results.map((player, index) => ({
        rank: index + 1,
        ...withLeague(player),
      })) }, 200, request, env);
    }

    if (request.method !== 'POST' || !['/auth/telegram', '/score'].includes(url.pathname)) {
      return json({ error: 'Not found' }, 404, request, env);
    }

    const authorized = await authorizeRequest(request, env);
    if (authorized.error) return json({ error: authorized.error }, authorized.status, request, env);

    if (url.pathname === '/auth/telegram') {
      const player = await playerSummary(env.DB, authorized.user.id);
      return json({ player: withLeague(player) }, 200, request, env);
    }

    const score = Number(authorized.body.score);
    if (!Number.isInteger(score) || score < 0 || score > 8888) {
      return json({ error: 'Score is outside the valid range' }, 400, request, env);
    }
    await env.DB.prepare(`
      UPDATE players
      SET best_score = MAX(best_score, ?), updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ?
    `).bind(score, String(authorized.user.id)).run();

    const player = await playerSummary(env.DB, authorized.user.id);
    const ranking = await env.DB.prepare(`
      SELECT COUNT(*) + 1 AS rank FROM players WHERE best_score > ?
    `).bind(player.bestScore).first();

    return json({
      player: withLeague(player),
      rank: ranking.rank,
    }, 200, request, env);
  },
};
