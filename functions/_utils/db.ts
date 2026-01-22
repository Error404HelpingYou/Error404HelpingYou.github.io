
export type Env = {
  DB: D1Database;
  ADMIN_PASSWORD?: string;
};

export const okJson = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", ...(init.headers||{}) },
    status: init.status ?? 200
  });

export async function all<T = any>(env: Env, sql: string, params: unknown[] = []) {
  const { results } = await env.DB.prepare(sql).bind(...params).all<T>();
  return results;
}
