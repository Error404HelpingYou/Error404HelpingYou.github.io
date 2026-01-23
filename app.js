
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const store = {
  get: (k, d) => {
    try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; }
  },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const fmtSign = n => n > 0 ? `+${n}` : `${n}`;
const color = n => n > 0 ? "var(--pos)" : n < 0 ? "var(--neg)" : "var(--zero)";

const dashState = {
  rows: [],
  sortKey: store.get("dashSortKey", "Total"),
  sortDir: store.get("dashSortDir", "desc")
};

const detailState = {
  rows: [],
  games: [],
  players: [],
  sortKey: store.get("detailSortKey", "Date"),
  sortDir: store.get("detailSortDir", "desc")
};

function selectTab(tab) {
  store.set("lastTab", tab);
  $("#tab-dashboard").classList.remove("on");
  $("#tab-detail").classList.remove("on");
  $("#tab-admin").classList.remove("on");
  $("#view-dashboard").style.display = "none";
  $("#view-detail").style.display = "none";
  $("#view-admin").style.display = "none";
  if (tab === "dashboard") {
    $("#tab-dashboard").classList.add("on");
    $("#view-dashboard").style.display = "";
  } else if (tab === "detail") {
    $("#tab-detail").classList.add("on");
    $("#view-detail").style.display = "";
  } else {
    $("#tab-admin").classList.add("on");
    $("#view-admin").style.display = "";
  }
}

function csvEscape(x) {
  const s = String(x ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function downloadCSV(filename, headers, rows) {
  const head = headers.map(csvEscape).join(","); 
  const body = rows.map(r => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([head + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function clearSortIndicators(headEl) {
  headEl.querySelectorAll("th").forEach(th => th.classList.remove("sort-asc","sort-desc","col-active"));
}
function applySortIndicator(headEl, key, dir) {
  const th = headEl.querySelector(`th[data-key="${CSS.escape(key)}"]`);
  if (th) {
    th.classList.add(dir === "asc" ? "sort-asc" : "sort-desc");
    th.classList.add("col-active");
  }
}

function bindColumnHover(tableId) {
  const table = $(tableId);
  if (!table) return;
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  let lastIdx = -1;
  function setHover(idx) {
    if (idx === lastIdx) return;
    if (lastIdx >= 0) {
      table.querySelectorAll(`thead th:nth-child(${lastIdx+1}), tbody td:nth-child(${lastIdx+1})`).forEach(el => el.classList.remove("col-hover"));
    }
    lastIdx = idx;
    if (idx >= 0) {
      table.querySelectorAll(`thead th:nth-child(${idx+1}), tbody td:nth-child(${idx+1})`).forEach(el => el.classList.add("col-hover"));
    }
  }
  thead.addEventListener("mousemove", e => {
    const th = e.target.closest("th"); 
    if (!th) { setHover(-1); return; }
    const idx = Array.from(th.parentNode.children).indexOf(th);
    setHover(idx);
  });
  thead.addEventListener("mouseleave", () => setHover(-1));
  tbody.addEventListener("mouseleave", () => setHover(-1));
}

function buildDashHeader() {
  const head = $("#dash-head");
  head.innerHTML = `
    <tr>
      <th data-key="Player">Player</th>
      <th data-key="Total">Total</th>
      <th data-key="Wins">Wins</th>
      <th data-key="Games">Games</th>
      <th data-key="WinPct">Win %</th>
    </tr>
  `;
  head.querySelectorAll("th").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (dashState.sortKey === key) {
        dashState.sortDir = dashState.sortDir === "asc" ? "desc" : "asc";
      } else {
        dashState.sortKey = key;
        dashState.sortDir = key === "Player" ? "asc" : "desc";
      }
      store.set("dashSortKey", dashState.sortKey);
      store.set("dashSortDir", dashState.sortDir);
      renderDashboard();
    });
  });
}

function renderDashboard() {
  if (!dashState.rows || !dashState.rows.length) {
    $("#dash-note").textContent = "No data yet.";
    $("#dash-table").style.display = "none";
    return;
  }
  $("#dash-note").style.display = "none";
  $("#dash-table").style.display = "";
  const rows = dashState.rows.slice();
  const body = $("#dash-body");
  const head = $("#dash-head");
  rows.sort((a,b) => {
    const dir = dashState.sortDir === "asc" ? 1 : -1;
    if (dashState.sortKey === "Player") return a.name.localeCompare(b.name, undefined, { sensitivity:"base" }) * dir;
    if (dashState.sortKey === "Total") return (a.total_points - b.total_points) * dir;
    if (dashState.sortKey === "Wins") return (a.wins - b.wins) * dir;
    if (dashState.sortKey === "Games") return (a.games_played - b.games_played) * dir;
    if (dashState.sortKey === "WinPct") return (a.win_pct - b.win_pct) * dir;
    return 0;
  });
  body.innerHTML = rows.map(r => `
    <tr>
      <td>${r.icon} ${r.name}</td>
      <td style="color:${color(r.total_points)};font-weight:700">${fmtSign(r.total_points)}</td>
      <td>${r.wins}</td>
      <td>${r.games_played}</td>
      <td>${(r.win_pct*100).toFixed(1)}%</td>
    </tr>
  `).join("");
  clearSortIndicators(head);
  applySortIndicator(head, dashState.sortKey, dashState.sortDir);
}

async function loadDashboard() {
  try {
    const r = await fetch("/api/stats");
    dashState.rows = await r.json();
    buildDashHeader();
    renderDashboard();
  } catch {
    $("#dash-note").textContent = "Error loading dashboard.";
    $("#dash-table").style.display = "none";
  }
}

function buildDetailHeader() {
  const head = $("#detail-head");
  head.innerHTML = `
    <tr>
      <th data-key="Date">Date</th>
      <th data-key="Game">Game</th>
      ${detailState.players.map(p => `<th data-key="${p.replace(/"/g,'&quot;')}">${p}</th>`).join("")}
    </tr>
  `;
  head.querySelectorAll("th").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (detailState.sortKey === key) {
        detailState.sortDir = detailState.sortDir === "asc" ? "desc" : "asc";
      } else {
        detailState.sortKey = key;
        detailState.sortDir = (key === "Date" || key === "Game") ? "desc" : "desc";
      }
      store.set("detailSortKey", detailState.sortKey);
      store.set("detailSortDir", detailState.sortDir);
      renderDetail();
    });
  });
}

function renderDetail() {
  const note = $("#detail-note");
  const tableWrap = $("#detail-table").parentElement;
  if (!detailState.games.length) {
    note.textContent = "No entries yet.";
    tableWrap.style.display = "none";
    return;
  }
  note.style.display = "none";
  tableWrap.style.display = "";
  const head = $("#detail-head");
  const body = $("#detail-body");
  const data = detailState.games.slice();
  data.sort((a,b) => {
    const dir = detailState.sortDir === "asc" ? 1 : -1;
    if (detailState.sortKey === "Date") {
      const pa = new Date(a.Date.replace(/-/g," ")).getTime();
      const pb = new Date(b.Date.replace(/-/g," ")).getTime();
      return (pa - pb) * dir;
    }
    if (detailState.sortKey === "Game") {
      return ((a.Game|0) - (b.Game|0)) * dir;
    }
    const va = Number(a[detailState.sortKey] ?? 0);
    const vb = Number(b[detailState.sortKey] ?? 0);
    return (va - vb) * dir;
  });
  body.innerHTML = data.map(g => `
    <tr>
      <td>${g.Date}</td>
      <td>${g.Game}</td>
      ${detailState.players.map(p => {
        const v = Number(g[p] ?? 0);
        const cls = v > 0 ? "points-pos" : v < 0 ? "points-neg" : "points-zero";
        const sign = v > 0 ? `+${v}` : `${v}`;
        return `<td><span class="${cls}">${sign}</span></td>`;
      }).join("")}
    </tr>
  `).join("");
  clearSortIndicators(head);
  applySortIndicator(head, detailState.sortKey, detailState.sortDir);
}

async function loadDetail() {
  try {
    const r = await fetch("/api/entries");
    const rows = await r.json();
    detailState.rows = rows;
    if (!rows.length) {
      detailState.players = [];
      detailState.games = [];
      renderDetail();
      return;
    }
    const gamesMap = new Map();
    rows.forEach(it => {
      const d = new Date(it.entry_ts + "Z");
      const dateFmt = d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"2-digit", timeZone:"UTC" }).replace(/ /g,"-");
      if (!gamesMap.has(it.entry_id)) gamesMap.set(it.entry_id, { Date: dateFmt, Game: it.entry_id });
      gamesMap.get(it.entry_id)[it.name] = Number(it.points||0);
    });
    detailState.players = Array.from(new Set(rows.map(x => x.name))).sort((a,b)=>a.localeCompare(b, undefined, {sensitivity:"base"}));
    detailState.games = Array.from(gamesMap.values());
    buildDetailHeader();
    renderDetail();
  } catch {
    $("#detail-note").textContent = "Error loading detail.";
    $("#detail-table").parentElement.style.display = "none";
  }
}

function exportDashboardCSV() {
  if (!dashState.rows.length) return;
  const headers = ["Player","Total","Wins","Games","Win %"];
  const sorted = dashState.rows.slice().sort((a,b) => {
    const dir = dashState.sortDir === "asc" ? 1 : -1;
    if (dashState.sortKey === "Player") return a.name.localeCompare(b.name, undefined, {sensitivity:"base"})*dir;
    if (dashState.sortKey === "Total") return (a.total_points-b.total_points)*dir;
    if (dashState.sortKey === "Wins") return (a.wins-b.wins)*dir;
    if (dashState.sortKey === "Games") return (a.games_played-b.games_played)*dir;
    if (dashState.sortKey === "WinPct") return (a.win_pct-b.win_pct)*dir;
    return 0;
  });
  const rows = sorted.map(r => [ `${r.icon} ${r.name}`, fmtSign(r.total_points), r.wins, r.games_played, (r.win_pct*100).toFixed(1)+"%" ]);
  downloadCSV("dashboard.csv", headers, rows);
}

function exportDetailCSV() {
  if (!detailState.games.length) return;
  const headers = ["Date","Game", ...detailState.players];
  const sorted = detailState.games.slice().sort((a,b) => {
    const dir = detailState.sortDir === "asc" ? 1 : -1;
    if (detailState.sortKey === "Date") {
      const pa = new Date(a.Date.replace(/-/g," ")).getTime();
      const pb = new Date(b.Date.replace(/-/g," ")).getTime();
      return (pa - pb) * dir;
    }
    if (detailState.sortKey === "Game") return ((a.Game|0)-(b.Game|0))*dir;
    const va = Number(a[detailState.sortKey] ?? 0);
    const vb = Number(b[detailState.sortKey] ?? 0);
    return (va - vb) * dir;
  });
  const rows = sorted.map(g => [ g.Date, g.Game, ...detailState.players.map(p => Number(g[p] ?? 0)) ]);
  downloadCSV("detail.csv", headers, rows);
}

async function adminLogin() {
  const password = $("#admin-pass").value;
  const r = await fetch("/api/auth/login", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ password }) });
  const data = await r.json();
  if (data && data.ok) {
    $("#admin-login").style.display = "none";
    $("#admin-panel").style.display = "";
    await adminLoadPlayers();
    await adminLoadRecent();
  } else {
    alert("Incorrect password");
  }
}

async function adminLoadPlayers() {
  const r = await fetch("/api/players");
  const players = await r.json();
  const list = $("#players-list");
  list.innerHTML = "";
  players.forEach(p => {
    const lab = document.createElement("label");
    lab.className = "pill";
    lab.dataset.id = String(p.id);
    lab.textContent = `${p.icon} ${p.name}`;
    lab.addEventListener("click", () => {
      lab.classList.toggle("on");
      adminRenderPerPlayer(players);
    });
    list.appendChild(lab);
  }); 
  onst delSel = $("#delete-player-select");
  if (delSel) {
    delSel.innerHTML = "";
    players.forEach(p => {
      const opt = document.createElement("option");
      opt.value = String(p.id);
      opt.textContent = `${p.icon} ${p.name}`;
      delSel.appendChild(opt);
    });
  }
  
  // === Delete Player click handler ===
  const delBtn = $("#btn-delete-player");
  if (delBtn) {
    delBtn.onclick = async () => {
      const pid = Number($("#delete-player-select").value);
      if (!pid) return;
  
      if (!confirm("Delete this player? This will remove their historical scores.")) return;
  
      const resp = await fetch(`/api/players/${pid}`, { method: "DELETE" });
      const data = await resp.json().catch(() => ({}));
  
      if (!resp.ok || !data.ok) {
        alert(data?.error || "Failed to delete player.");
        return;
      }
  
      // Refresh Admin lists and both tables
      await adminLoadPlayers();
      await loadDashboard();
      if ($("#view-detail").style.display !== "none") await loadDetail();
    };
  }

  $("#btn-add-player").onclick = async () => {
    const name = $("#p-name").value.trim();
    const icon = $("#p-icon").value.trim() || null;
    if (!name) { alert("Enter a name"); return; }
    await fetch("/api/players", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ name, icon }) });
    $("#p-name").value = ""; $("#p-icon").value = "";
    await adminLoadPlayers();
    await loadDashboard();
    if ($("#view-detail").style.display !== "none") await loadDetail();
  };
  function selectedIds() { return $$("#players-list .pill.on").map(x => Number(x.dataset.id)); }
  function adminRenderPerPlayer(playersArr) {
    const ids = selectedIds();
    const box = $("#per-player");
    box.innerHTML = "";
    $("#btn-save-entry").disabled = ids.length === 0;
    const half = Math.max(1, Math.floor(ids.length/2));
    ids.forEach((id, idx) => {
      const p = playersArr.find(x => x.id === id);
      const row = document.createElement("div");
      row.className = "form-row";
      row.innerHTML = `<label style="min-width:120px">${p.name}</label><input type="number" class="input-field" data-id="${id}" value="${idx < half ? 5 : -5}">`;
      box.appendChild(row);
    });
  }
  $("#btn-save-entry").onclick = async () => {
    const inputs = $$("#per-player input[data-id]");
    const items = inputs.map(inp => ({ player_id: Number(inp.dataset.id), points: Number(inp.value||0) }));
    if (!items.length) return;
    const note = $("#note").value;
    const game_date = $("#game-date").value || undefined;
    await fetch("/api/entries", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ items, note, game_date }) });
    alert("Saved!");
    $("#note").value = "";
    $("#per-player").innerHTML = "";
    $("#btn-save-entry").disabled = true;
    $$("#players-list .pill.on").forEach(el => el.classList.remove("on"));
    await loadDashboard();
    if ($("#view-detail").style.display !== "none") await loadDetail();
    await adminLoadRecent();
  };
}

async function adminLoadRecent() {
  try {
    const r = await fetch("/api/entries?limit=10");
    const rows = await r.json();
    const container = $("#recent-entries");
    container.innerHTML = "";
    if (!rows.length) { container.innerHTML = `<div class="message">No entries yet.</div>`; return; }
    const ids = Array.from(new Set(rows.map(x => x.entry_id)));
    ids.forEach(eid => {
      const group = rows.filter(x => x.entry_id === eid);
      const ts = group[0].entry_ts.replace("T"," ") + " UTC";
      const note = group[0].note || "";
      const mini = group.map(r => `${r.icon} ${r.name}: ${r.points > 0 ? "+"+r.points : r.points}`).join(" • ");
      const row = document.createElement("div");
      row.className = "form-row";
      const left = document.createElement("div");
      left.style.flex = "1";
      left.innerHTML = `<b>Game #${eid}</b> — ${ts} — <i>${note}</i><br>${mini}`;
      const del = document.createElement("button");
      del.className = "action-button";
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        try {
          const resp = await fetch(`/api/entries/${eid}`, { method:"DELETE" });
          if (!resp.ok) throw 0;
          await adminLoadRecent();
          await loadDashboard();
          if ($("#view-detail").style.display !== "none") await loadDetail();
        } catch { alert("Delete failed (endpoint may be missing)."); }
      });
      row.appendChild(left);
      row.appendChild(del);
      container.appendChild(row);
    });
  } catch {
    $("#recent-entries").innerHTML = `<div class="message">Error loading recent entries.</div>`;
  }
}

function wireTabs() {
  $("#tab-dashboard").addEventListener("click", () => { selectTab("dashboard"); });
  $("#tab-detail").addEventListener("click", () => { selectTab("detail"); loadDetail(); });
  $("#tab-admin").addEventListener("click", () => { selectTab("admin"); });
}

function wireExports() {
  $("#export-dashboard").addEventListener("click", exportDashboardCSV);
  $("#export-detail").addEventListener("click", exportDetailCSV);
}

function wireAdmin() {
  $("#btn-login").addEventListener("click", adminLogin);
}

function initHeads() {
  buildDashHeader();
  buildDetailHeader();
}

function applySavedTab() {
  const last = store.get("lastTab", "dashboard");
  if (last === "detail") { selectTab("detail"); loadDetail(); }
  else if (last === "admin") { selectTab("admin"); }
  else { selectTab("dashboard"); }
}

function init() {
  wireTabs();
  wireExports();
  wireAdmin();
  initHeads();
  bindColumnHover("#dash-table");
  bindColumnHover("#detail-table");
  loadDashboard();
  applySavedTab();
}

document.addEventListener("DOMContentLoaded", init);
