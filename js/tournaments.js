// صفحة البطولات للمستخدمين: دخول عبر السحب + الشجرة + النتائج + البطل
(function () {
  const { db, esc } = App;
  App.shell("tournaments");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("list");
  let tab = "current", ts = {};
  const gv = {}, ent = {}, gRefs = {}, eRefs = {};
  const num = (v) => (Math.round(v * 100) / 100).toLocaleString("en-US");
  const fmt = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };

  document.querySelectorAll(".tabs button").forEach((b) => {
    b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b)); render(); };
  });
  App.onUser((u) => { document.getElementById("adminLink").style.display = u && u.admin ? "" : "none"; render(); });
  db.ref("tournaments").orderByChild("createdAt").limitToLast(30).on("value", (s) => {
    ts = s.val() || {};
    Object.values(ts).forEach((t) => {
      if (t.status !== "reg" || !t.gid || gRefs[t.gid]) return;
      gRefs[t.gid] = db.ref("giveaways/" + t.gid); gRefs[t.gid].on("value", (x) => { gv[t.gid] = x.val(); render(); }, () => {});
      eRefs[t.gid] = db.ref("entries/" + t.gid); eRefs[t.gid].on("value", (x) => { ent[t.gid] = x.val() || {}; render(); }, () => {});
    });
    render();
  });
  setInterval(() => root.querySelectorAll(".gtimer[data-end]").forEach((t) => { const l = Number(t.dataset.end) - App.now(); if (l > 0) t.textContent = fmt(l); else render(); }), 1000);

  const ST = { reg: ["التسجيل", "open"], seeded: ["القرعة تمّت", "wait"], live: ["جارية", "open"], ended: ["انتهت", ""] };

  function slot(t, s, w, sc, pay) {
    const nm = s.uid ? esc(s.name) : s.bye ? "— (راحة)" : "؟";
    const game = s.uid && t.games && t.games[s.uid] ? `<small class="gm">🎰 ${esc(t.games[s.uid])}</small>` : "";
    const val = sc !== undefined ? `<b>${t.cmp === "pay" ? (t.currency || "$") + num(pay ?? sc) : num(sc) + "x"}</b>` : "";
    return `<div class="bs ${s.uid ? "" : "e"} ${w ? "w" : ""}"><span>${nm}${game}</span>${val}</div>`;
  }
  function bracket(t) {
    const R = t.bracket;
    return `<div class="brk">` + R.map((rd, r) => `<div class="bcol"><h5>${Bracket.roundName(r, R.length)}</h5>` +
      rd.map((m) => `<div class="bm">${slot(t, m.a, m.w === "a", m.sa, m.pa)}${slot(t, m.b, m.w === "b", m.sb, m.pb)}</div>`).join("") + `</div>`).join("") + `</div>`;
  }

  function regBox(tid, t) {
    const g = gv[t.gid], E = ent[t.gid] || {}, n = Object.keys(E).length;
    if (!g) return `<div class="msg">جاري التحميل...</div>`;
    const open = g.status === "open" && g.endsAt > App.now(), mine = App.user && E[App.user.uid];
    let act;
    if (!open) act = `<span class="hint">انتهى وقت التسجيل — بانتظار القرعة</span>`;
    else if (!App.user) act = `<button class="btn primary" data-login="1">سجّل دخول بكيك للدخول</button>`;
    else if (mine) act = `<span class="badge open">أنت مسجّل ✓</span>`;
    else if (App.verified === false) act = `<a class="btn primary" href="profile.html">⚠️ وثّق حسابك أولاً</a>`;
    else act = `<button class="btn primary" data-join="${tid}">⚔️ ادخل البطولة</button>`;
    return `<div class="gbox"><div class="gtop"><b>🎟️ التسجيل بالبطولة (${t.max} لاعب)</b>${open ? `<span class="badge open">مفتوح</span><span class="gtimer" data-end="${g.endsAt}">${fmt(g.endsAt - App.now())}</span>` : `<span class="badge">انتهى</span>`}</div>
      <div class="hint">${n} مسجّل · الدخول من الموقع أو بكتابة الكلمة <b>${esc(g.keyword || t.keyword || "")}</b> بشات كيك. بعد ما ينتهي الوقت بنسحب ${t.max} لاعب عشوائياً وبنوزعهم بالشجرة.</div>
      <div class="row" style="margin-top:10px">${act}</div></div>`;
  }

  function card(tid, t) {
    const prizes = (t.prizes || []).filter(Boolean).map((p, i) => `${["🥇", "🥈"][i] || ""} ${esc(p)}`).join(" · ");
    const res = t.status === "ended" && t.final ? `<div class="podium" style="margin:12px 0"><div class="pod p1"><span class="pm">🏆</span><b>${esc(t.final.champion.name)}</b><small>البطل${t.prizes && t.prizes[0] ? " · " + esc(t.prizes[0]) : ""}</small></div>
      <div class="pod"><span class="pm">🥈</span><b>${esc(t.final.runnerUp.name)}</b><small>الوصيف${t.prizes && t.prizes[1] ? " · " + esc(t.prizes[1]) : ""}</small></div></div>` : "";
    const how = t.cmp === "pay" ? "الفوز لصاحب أعلى ربح بالبونص" : "الفوز لصاحب أعلى x (الربح ÷ الرهان)";
    return `<section class="panel hunt"><div class="hh"><h3>${esc(t.title)} <span class="badge ${ST[t.status][1]}">${ST[t.status][0]}</span></h3><span class="hint">${t.max} لاعب</span></div>
      ${prizes ? `<div class="hint" style="margin-bottom:8px">الجوائز: ${prizes}</div>` : ""}<div class="hint" style="margin-bottom:8px">${how}</div>${t.note ? `<div class="msg" style="margin-bottom:10px">${esc(t.note)}</div>` : ""}
      ${t.status === "reg" ? regBox(tid, t) : ""}${res}${t.bracket ? bracket(t) : ""}</section>`;
  }

  function render() {
    const ids = Object.keys(ts).sort((a, b) => ts[b].createdAt - ts[a].createdAt).filter((id) => (tab === "past") === (ts[id].status === "ended"));
    root.innerHTML = ids.length ? ids.map((id) => card(id, ts[id])).join("") : `<div class="empty"><div>${tab === "past" ? "ما في بطولات سابقة." : "ما في بطولات حالياً."}</div></div>`;
    root.querySelectorAll("[data-login]").forEach((b) => (b.onclick = () => App.login("tournaments.html")));
    root.querySelectorAll("[data-join]").forEach((b) => (b.onclick = () => join(b.dataset.join)));
  }
  async function join(tid) {
    try { await db.ref(`entries/${ts[tid].gid}/${App.user.uid}`).set({ name: App.user.name, source: "site", at: SV.TIMESTAMP }); App.toast("تم تسجيلك بالبطولة ⚔️"); }
    catch (e) { console.error(e); App.toast("ما قدرنا نسجّلك (ممكن انتهى الوقت)"); }
  }
})();
