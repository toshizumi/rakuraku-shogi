// らくらく将棋のランキングを受け取って保存する Worker
// GET  /ranking            上位10件を返す
// POST /ranking {name, moves}  記録を追加して上位10件と順位を返す

const KEY = 'ranking';
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    if (url.pathname !== '/ranking') return json({ error: 'not found' }, 404);

    const list = (await env.RANKING.get(KEY, 'json')) || [];

    if (request.method === 'GET') {
      return json({ ranking: list.slice(0, MAX_SHOW) });
    }

    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }

      const name = String(body.name ?? '').trim().slice(0, NAME_MAX);
      const moves = Number(body.moves);
      if (!name) return json({ error: 'name required' }, 400);
      if (!Number.isInteger(moves) || moves < 1 || moves > 999) return json({ error: 'invalid moves' }, 400);

      const record = { name, moves, at: Date.now() };
      list.push(record);
      list.sort((a, b) => a.moves - b.moves || a.at - b.at);
      const trimmed = list.slice(0, MAX_STORE);
      await env.RANKING.put(KEY, JSON.stringify(trimmed));

      const idx = trimmed.indexOf(record);
      return json({ ranking: trimmed.slice(0, MAX_SHOW), rank: idx === -1 ? null : idx + 1 });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
