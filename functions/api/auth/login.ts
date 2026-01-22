
import { okJson } from "../../_utils/db";

const COOKIE = "mj_admin";

function sign(value: string, secret: string) {
  const data = new TextEncoder().encode(value + "." + secret);
  let h = 0; for (let i = 0; i < data.length; i++) h = (h * 31 + data[i]) | 0;
  return `${value}.${(h >>> 0).toString(16)}`;
}

function setAdminCookie(env: { ADMIN_PASSWORD?: string }) {
  const pwd = env.ADMIN_PASSWORD ?? "";
  const value = `1|${Date.now() + 7*24*3600*1000}`; // 7 days
  const token = sign(value, pwd);
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7*24*3600}`;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { password } = await request.json().catch(()=>({}));
  if (!env.ADMIN_PASSWORD) return okJson({ error: "Server not configured" }, { status: 500 });
  if (password !== env.ADMIN_PASSWORD) return okJson({ ok: false });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json", "set-cookie": setAdminCookie(env) }
  });
};
