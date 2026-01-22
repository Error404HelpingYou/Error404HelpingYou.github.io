
import { okJson } from "../_utils/db";

function isAdmin(request: Request, env: { ADMIN_PASSWORD?: string }) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/mj_admin=([^;]+)/);
  return !!match; // simple check (cookie exists). Good enough for hobby admin.
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request, env)) return okJson({ error: "Unauthorized" }, { status: 401 });
  const { items, note, game_date } = await request.json().catch(()=>({}));

  if (!Array.isArray(items) || items.length === 0)
    return okJson({ error: "Items required" }, { status: 400 });

  const ts = game_date
    ? `${game_date}T00:00:00`      // date only → midnight
    : new Date().toISOString().slice(0,19);

  const ins = await env.DB.prepare(
    `INSERT INTO entries(entry_ts, note) VALUES(?, ?)`
  ).bind(ts, note || null).run();

  const entryId = ins.lastRowId;
  const stmt = env.DB.prepare(
    `INSERT INTO entry_items(entry_id, player_id, points) VALUES(?, ?, ?)`
  );

  for (const it of items) {
    await stmt.bind(entryId, Number(it.player_id), Number(it.points)).run();
  }
  return okJson({ id: entryId });
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(`
    SELECT e.id AS entry_id, e.entry_ts, p.name, COALESCE(p.icon,'🏅') AS icon, i.points, e.note
    FROM entries e
    JOIN entry_items i ON e.id = i.entry_id
    JOIN players p ON p.id = i.player_id
    ORDER BY e.entry_ts DESC, p.name COLLATE NOCASE
  `).all();
  return okJson(results);
};
