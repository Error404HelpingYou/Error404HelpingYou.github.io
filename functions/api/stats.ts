
import { all, okJson } from "../_utils/db";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const rows = await all<{
    id:number; name:string; icon:string;
    total_points:number; games_played:number; wins:number;
  }>(env, `
    SELECT
      p.id,
      p.name,
      COALESCE(p.icon,'🏅') AS icon,
      COALESCE(SUM(i.points), 0) AS total_points,
      SUM(CASE WHEN i.points IS NOT NULL THEN 1 ELSE 0 END) AS games_played,
      SUM(CASE WHEN i.points > 0 THEN 1 ELSE 0 END) AS wins
    FROM players p
    LEFT JOIN entry_items i ON i.player_id = p.id
    GROUP BY p.id, p.name, p.icon
  `);

  const enriched = rows.map(r => ({
    ...r,
    win_pct: r.games_played ? r.wins / r.games_played : 0
  }))
  .sort((a,b) =>
    (b.total_points - a.total_points) ||
    (b.win_pct - a.win_pct) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  return okJson(enriched);
};
