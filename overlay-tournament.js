// أوفرلاي OBS للبطولة (440×320): التسجيل، القرعة، المباراة الحالية والنتائج، البطل
// الرابط:  .../overlay-tournament.html  (آخر بطولة شغّالة تلقائياً)  أو  ?t=<معرّف البطولة>
(function () {
  const C = window.CONFIG;
  firebase.initializeApp(C.firebase);
  const db = firebase.database();
  const card = document.getElementById("card");
  const q = new URLSearchParams(location.search);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => (Math.round(v * 100) / 100).toLocaleString("en-US");
  let offset = 0, ts = {}, lastSig = "", gRef = null, eRef = null, gid = null, gv = null, cnt = 0;
  const now = () => Date.now() + offset;
  db.ref(".info/serverTimeOffset").on("value", (s) => (offset = s.val() || 0));
  db.ref("tournaments").orderByChild("createdAt").limitToLast(10).on("value", (s) => { ts = s.val() || {}; render(); });
  const fmt = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };

  function pick() {
    const only = q.get("t");
    if (only) return ts[only] ? [only, ts[only]] : null;
    const ids = Object.keys(ts).filter((id) => ts[id].status !== "ended").sort((a, b) => ts[b].createdAt - ts[a].createdAt);
    return ids.length ? [ids[0], ts[ids[0]]] : null;
  }
  function watch(g) {                                       // نتابع مسابقة التسجيل (الوقت + العدد)
    if (g === gid) return; gid = g;
    if (gRef) gRef.off(); if (eRef) eRef.off(); gv = null; cnt = 0;
    if (!g) return;
    gRef = db.ref("giveaways/" + g); gRef.on("value", (x) => { gv = x.val(); lastSig = ""; render(); });
    eRef = db.ref("entries/" + g); eRef.on("value", (x) => { cnt = x.numChildren(); lastSig = ""; render(); });
  }

  const gm = (t, s) => (s.uid && t.games && t.games[s.uid] ? `<small>🎰 ${esc(t.games[s.uid])}</small>` : "<small>&nbsp;</small>");
  const nm = (s) => (s.uid ? esc(s.name) : s.bye ? "— راحة" : "؟");
  const val = (m, side) => { const v = side === "a" ? m.sa : m.sb; return v !== undefined ? num(v) + "x" : ""; };
  function matchRow(t, m, isNext) {
    return `<div class="mt ${isNext ? "nx" : ""}" ${isNext ? 'id="nxt"' : ""}>
      <div class="p l ${m.w === "a" ? "w" : ""}"><b>${nm(m.a)}</b>${gm(t, m.a)}</div><div class="v ${m.w === "a" ? "w" : ""}">${val(m, "a")}</div><div class="vs">vs</div><div class="v ${m.w === "b" ? "w" : ""}">${val(m, "b")}</div>
      <div class="p r ${m.w === "b" ? "w" : ""}"><b>${nm(m.b)}</b>${gm(t, m.b)}</div></div>`;
  }

  function render() {
    const p = pick();
    if (!p) { watch(null); if (lastSig !== "none") { lastSig = "none"; card.innerHTML = `<div class="top"><img src="img/logo.png" alt=""><span class="tag">${esc(C.siteName)}</span></div><div class="none"><div class="ic">⚔️</div><b>لا يوجد بطولة حالياً</b><small>ترقّبوا البطولة القادمة</small></div>`; } return; }
    const [tid, t] = p;
    if (t.status === "reg") watch(t.gid); else watch(null);
    const live = t.status === "reg" && gv && gv.status === "open" && gv.endsAt > now();
    const sig = JSON.stringify([tid, t.title, t.status, t.bracket, t.games, t.final, t.max, live, cnt]);
    const head = (tag, wait) => `<div class="top"><img src="img/logo.png" alt=""><span class="tag"><i class="dot ${wait ? "wait" : ""}"></i>${tag}</span></div><h1>⚔️ ${esc(t.title)}</h1>`;
    if (sig !== lastSig) {
      lastSig = sig;
      if (t.status === "reg") {
        card.innerHTML = head(live ? "التسجيل مفتوح" : "انتهى التسجيل — بانتظار القرعة", !live) + `<div class="prize">${(t.prizes || []).filter(Boolean).map((x, i) => ["🥇", "🥈", "🥉"][i] + " " + esc(x)).join("  ") || "&nbsp;"}</div>
          <div class="stats"><div class="st"><b>${t.max}</b><small>مقعد</small></div><div class="st time"><b id="oTime">${live ? fmt(gv.endsAt - now()) : "00:00"}</b><small>الوقت المتبقي</small></div><div class="st"><b>${cnt}</b><small>مسجّل</small></div></div>
          ${live ? `<div class="kw">اكتب بالشات <span>${esc(t.keyword || "")}</span></div>` : `<div class="kw">بنسحب ${t.max} لاعب ونوزعهم عشوائياً 🎲</div>`}`;
      } else if (t.status === "seeded") {
        const r0 = t.bracket[0];
        card.innerHTML = head("القرعة تمّت", true) + `<div class="lst" id="lst">${r0.map((m) => matchRow(t, m, false)).join("")}</div>`;
      } else if (t.status === "live") {
        let r = t.bracket.findIndex((rd) => rd.some((m) => !m.w)); if (r < 0) r = t.bracket.length - 1;
        const rd = t.bracket[r], nxt = rd.findIndex((m) => !m.w && Bracket.isP(m.a) && Bracket.isP(m.b));
        const rn = Bracket.roundName(r, t.bracket.length);
        card.innerHTML = head(rn, false) + `<div class="lst" id="lst">${rd.map((m, i) => matchRow(t, m, i === nxt)).join("")}</div><div class="glance"><span>الفائز: أعلى x</span><span>${nxt >= 0 ? "المباراة الجاية ◀" : ""}</span></div>`;
      } else {
        const f = t.final || {}, pz = t.prizes || [];
        card.innerHTML = head("انتهت البطولة", true) + `<div class="pdm"><div>🏆 ${esc((f.champion || {}).name || "")}<small>${esc(pz[0] || "")}</small></div><div>🥈 ${esc((f.runnerUp || {}).name || "")}<small>${esc(pz[1] || "")}</small></div>${f.third ? `<div>🥉 ${esc(f.third.name)}<small>${num(f.third.score)}x${pz[2] ? " · " + esc(pz[2]) : ""}</small></div>` : ""}</div>`;
      }
      const l = document.getElementById("lst"), nx = document.getElementById("nxt");
      if (l) l.scrollTop = nx ? Math.max(0, nx.offsetTop - l.clientHeight / 2) : 0;
    }
    const tm = document.getElementById("oTime"); if (tm && gv) tm.textContent = live ? fmt(gv.endsAt - now()) : "00:00";
  }
  setInterval(render, 1000);
})();
