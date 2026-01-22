
import { all, okJson } from "../_utils/db";

function isAdmin(request: Request) {
  const cookie = request.headers.get("Cookie") || "";
  return /mj_admin=/.test(cookie);
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const rows = await all(env, `
    SELECT id, name, COALESCE(icon, '🏅') AS icon
    FROM players
    ORDER BY name COLLATE NOCASE
  `);
  return okJson(rows);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAdmin(request)) return okJson({ error: "Unauthorized" }, { status: 401 });
  const { name, icon } = await request.json().catch(()=>({}));
  if (!name || !String(name).trim()) return okJson({ error: "Name required" }, { status: 400 });

  const trimmed = String(name).trim();
  const exists = await env.DB.prepare(`SELECT id FROM players WHERE name=?`).bind(trimmed).first();
  if (exists) {
    if (icon !== undefined) {
      await env.DB.prepare(`UPDATE players SET icon=? WHERE id=?`).bind(icon || null, exists.id).run();
    }
    return okJson({ id: exists.id, updated: true });
  }
  const ins = await env.DB.prepare(`INSERT INTO players(name, icon) VALUES(?, ?)`).bind(trimmed, icon || null).run();
  return okJson({ id: ins.lastRowId, created: true });
};
