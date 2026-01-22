
import { all, okJson } from "../_utils/db";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const rows = await all(env, `
    SELECT id, name, COALESCE(icon, '🏅') AS icon
    FROM players
    ORDER BY name COLLATE NOCASE
  `);
  return okJson(rows);
};
