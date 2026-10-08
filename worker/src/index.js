// らくらく将棋のランキングを受け取って保存する Worker
// GET  /ranking?opponent=ID            その相手のランキング上位10件を返す
// POST /ranking {name, moves, opponent}  記録を追加して上位10件と順位を返す
// ランキングは対戦相手ごとに別のキーに保存する。opponent のない登録（古い画面から）は古いキーに入れる

const LEGACY_KEY = 'ranking';
const OPPONENTS = ['ginji', 'omino', 'nakata'];
const MAX_STORE = 100; // 保存しておく件数
const MAX_SHOW = 10;   // 画面に出す件数
const NAME_MAX = 12;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
  });
}

// 相手のIDから保存先のキーを決める。指定がなければ古いキー、知らないIDなら null
function keyFor(opponent) {
  if (opponent === null || opponent === undefined || opponent === '') return LEGACY_KEY;
  return OPPONENTS.includes(opponent) ? 'ranking:' + opponent : null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    if (url.pathname !== '/ranking') return json({ error: 'not found' }, 404);

    if (request.method === 'GET') {
      const key = keyFor(url.searchParams.get('opponent'));
      if (!key) return json({ error: 'invalid opponent' }, 400);
      const list = (await env.RANKING.get(key, 'json')) || [];
      return json({ ranking: list.slice(0, MAX_SHOW) });
    }

    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }

      const key = keyFor(body.opponent);
      if (!key) return json({ error: 'invalid opponent' }, 400);
      const list = (await env.RANKING.get(key, 'json')) || [];

      const name = String(body.name ?? '').trim().slice(0, NAME_MAX);
      const moves = Number(body.moves);
      if (!name) return json({ error: 'name required' }, 400);
      if (!Number.isInteger(moves) || moves < 1 || moves > 999) return json({ error: 'invalid moves' }, 400);

      const record = { name, moves, at: Date.now() };
      list.push(record);
      list.sort((a, b) => a.moves - b.moves || a.at - b.at);
      const trimmed = list.slice(0, MAX_STORE);
      await env.RANKING.put(key, JSON.stringify(trimmed));

      const idx = trimmed.indexOf(record);
      return json({ ranking: trimmed.slice(0, MAX_SHOW), rank: idx === -1 ? null : idx + 1 });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
