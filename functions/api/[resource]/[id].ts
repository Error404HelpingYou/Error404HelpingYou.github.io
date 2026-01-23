
import { okJson } from "../../_utils/db";

function isAdmin(request: Request) {
  const cookie = request.headers.get("Cookie") || "";
  return /mj_admin=/.test(cookie);
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, params, env }) => {
  try {
    if (!isAdmin(request)) {
      return okJson({ error: "Unauthorized" }, { status: 401 });
    }

    const resource = String(params.resource || "").toLowerCase();
    const id = Number(params.id);

    if (!id || Number.isNaN(id)) {
      return okJson({ error: "Invalid ID" }, { status: 400 });
    }

    if (resource === "entries") {
      await env.DB.prepare(`DELETE FROM entries WHERE id = ?1`).bind(id).run();
      // ON DELETE CASCADE removes related entry_items
      return okJson({ ok: true, deleted: { type: "entry", id } });
    }

    if (resource === "players") {
      await env.DB.prepare(`DELETE FROM players WHERE id = ?1`).bind(id).run();
      // ON DELETE CASCADE removes related entry_items
      return okJson({ ok: true, deleted: { type: "player", id } });
    }

    return okJson({ error: "Unknown resource" }, { status: 404 });
  } catch (err: any) {
    console.error("DELETE /api/[resource]/[id] failed:", err?.stack || err);
    return okJson({ error: "Internal server error" }, { status: 500 });
  }
};
