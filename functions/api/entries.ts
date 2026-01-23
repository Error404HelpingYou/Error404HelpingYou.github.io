
import { okJson } from "../_utils/db";

// Simple cookie check (same as before)
function isAdmin(request: Request) {
  const cookie = request.headers.get("Cookie") || "";
  return /mj_admin=/.test(cookie);
}

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!isAdmin(request)) {
      return okJson({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    const note = typeof body.note === "string" ? body.note : null;
    const game_date = typeof body.game_date === "string" ? body.game_date : null;

    if (items.length === 0) {
      return okJson({ error: "Items required" }, { status: 400 });
    }

    // Build timestamp (UTC), date-only → midnight
    const ts = game_date ? `${game_date}T00:00:00` : new Date().toISOString().slice(0, 19);

    // 1) Insert into entries
    const ins = await env.DB
      .prepare(`INSERT INTO entries (entry_ts, note) VALUES (?1, ?2)`)
      .bind(ts, note)
      .run();

    // ✅ D1 uses snake_case:
    const entryId = Number(ins.meta?.last_row_id || 0);
    if (!Number.isFinite(entryId) || entryId <= 0) {
      console.error("Failed to read last_row_id from D1 response:", ins);
      return okJson({ error: "Could not determine entry ID" }, { status: 500 });
    }

    // 2) Insert all entry_items (safe batch)
    const stmts = items.map((it: any) =>
      env.DB
        .prepare(`INSERT INTO entry_items (entry_id, player_id, points) VALUES (?1, ?2, ?3)`)
        .bind(entryId, Number(it.player_id), Number(it.points))
    );
    await env.DB.batch(stmts);

    return okJson({ id: entryId });
  } catch (err: any) {
    console.error("POST /api/entries failed:", err?.stack || err);
    return okJson({ error: "Internal server error" }, { status: 500 });
  }
};
