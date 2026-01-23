
import { okJson } from "../../_utils/db";

// Same cookie check as before
function isAdmin(request: Request) {
  const cookie = request.headers.get("Cookie") || "";
  return /mj_admin=/.test(cookie);
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, params, env }) => {
  try {
    if (!isAdmin(request)) {
      return okJson({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number(params.id);
    if (!id || isNaN(id)) {
      return okJson({ error: "Invalid ID" }, { status: 400 });
    }

    await env.DB.prepare(`DELETE FROM entries WHERE id = ?1`)
      .bind(id)
      .run();

    return okJson({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/entries/[id] failed:", err?.stack || err);
    return okJson({ error: "Internal server error" }, { status: 500 });
  }
};
