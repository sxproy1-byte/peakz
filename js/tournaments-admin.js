// إدارة البطولات (أدمن): تسجيل بالسحب (كلمة بالشات) → قرعة عشوائية → الألعاب → البدء → إدخال البونصات والموقع يحسب الفائز
(function () {
  const { db, esc, C } = App;
  App.shell("tournaments");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("root");
  let ts = {}, started = false;
  const gv = {}, ent = {}, gRefs = {}, eRefs = {}, keep = {};
  const num = (v) => (Math.round(v * 100) / 100).toLocaleString("en-US");
  const fmt = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };

  App.onUser((u) => {
    if (!u) {
      root.innerHTML = `<div class="empty"><div>سجّل دخولك بحساب الأدمن على كيك</div><div class="center"><button class="btn primary" id="l">تسجيل الدخول بكيك</button></div></div>`;
      document.getElementById("l").onclick = () => App.login("admin-tournaments.html");
    } else if (!u.admin) root.innerHTML = `<div class="empty"><div>حسابك (${esc(u.name)}) مو أدمن</div></div>`;
    else start();
  });

  const tabs = '<div class="atabs"><a href="admin.html">🎟️ المسابقات</a><a href="admin-bonus.html">🎯 البونص هانت</a><a href="admin-tournaments.html" class="on">⚔️ البطولات</a><a href="admin-slots.html">🎰 السلوت كول</a><a href="admin-profiles.html">👤 البروفايلات</a><a href="admin-stats.html">📊 الإحصائيات</a><a href="admin-database.html">🗄️ قاعدة البيانات</a></div>';

  function start() {
    if (started) return; started = true;
    root.innerHTML = `<h1 class="plain">لوحة التحكم</h1>${tabs}
      ${App.overlayPanel("overlay-tournament.html", "البطولات", "بـ OBS: Sources ← Browser ← الصق الرابط. الحجم 440×320 (أو أي حجم بنفس النسبة). بيعرض آخر بطولة شغّالة: التسجيل، القرعة، المباراة الحالية والنتائج، ثم البطل.")}
      <div class="panel"><h2>➕ بطولة جديدة</h2><div class="form">
        <div class="field"><label>العنوان</label><input id="cTitle" placeholder="بطولة السلوتات"></div>
        <div class="field"><label>عدد اللاعبين</label><select id="cMax"><option>8</option><option selected>16</option><option>32</option></select></div>
        <div class="field"><label>كلمة الدخول بالشات</label><input id="cKey" placeholder="${esc(C.defaultKeyword)}"></div>
        <div class="field"><label>مدة التسجيل (دقائق)</label><input id="cMin" type="number" min="1" value="10"></div>
        <div class="field"><label>عملة</label><input id="cCur" value="$" maxlength="4"></div>
        <div class="field"><label>جائزة البطل</label><input id="cP1" placeholder="$200"></div>
        <div class="field"><label>جائزة الوصيف</label><input id="cP2" placeholder="$100"></div>
        <div class="field"><label>جائزة المركز 3</label><input id="cP3" placeholder="$50"></div>
        <div class="field" style="grid-column:1/-1"><label>ملاحظة / القوانين (اختياري)</label><input id="cNote" placeholder="كل مباراة: سلوت وبونص واحد"></div>
        <div class="field"><label>&nbsp;</label><button class="btn primary" id="cGo" style="width:100%">إنشاء وفتح التسجيل</button></div></div></div>
      <div id="active"></div><div class="panel"><h2>📜 المنتهية</h2><div class="alist" id="done"></div></div>`;
    document.getElementById("cGo").onclick = create;
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.keep) keep[e.target.id] = e.target.value; });
    db.ref("tournaments").orderByChild("createdAt").limitToLast(30).on("value", (s) => {
      ts = s.val() || {};
      Object.values(ts).forEach((t) => {
        if (!t.gid || gRefs[t.gid]) return;
        gRefs[t.gid] = db.ref("giveaways/" + t.gid); gRefs[t.gid].on("value", (x) => { gv[t.gid] = x.val(); render(); });
        eRefs[t.gid] = db.ref("entries/" + t.gid); eRefs[t.gid].on("value", (x) => { ent[t.gid] = x.val() || {}; render(); });
      });
      render();
    });
    setInterval(() => root.querySelectorAll(".gtimer[data-end]").forEach((t) => { const l = Number(t.dataset.end) - App.now(); if (l > 0) t.textContent = fmt(l); else render(); }), 1000);
  }

  async function create() {
    const v = (id) => document.getElementById(id).value.trim();
    const title = v("cTitle") || "بطولة", max = Number(v("cMax")) || 16, key = (v("cKey") || C.defaultKeyword).toLowerCase(), min = Math.max(1, Number(v("cMin")) || 10);
    try {
      const g = await db.ref("giveaways").push({ title: "🏆 تسجيل: " + title, prize: "مقعد بالبطولة", keyword: key, winnersCount: max, status: "open", createdAt: SV.TIMESTAMP, endsAt: App.now() + min * 60000, tournament: true });
      const nr = await db.ref("tournaments").push({ title, max, keyword: key, gid: g.key, cmp: "x", currency: v("cCur") || "$", prizes: [v("cP1"), v("cP2"), v("cP3")], note: v("cNote"), status: "reg", createdAt: SV.TIMESTAMP });
      ["cTitle", "cKey", "cP1", "cP2", "cP3", "cNote"].forEach((id) => (document.getElementById(id).value = ""));
      App.toast("انفتح التسجيل بالبطولة ⚔️"); App.notify("tournament", nr.key);
    } catch (e) { console.error(e); App.toast("فشل الإنشاء — تأكد من قواعد Firebase"); }
  }

  const ST = { reg: "التسجيل", seeded: "القرعة تمّت", live: "جارية", ended: "انتهت" };
  const score = (t, bet, pay) => (t.cmp === "pay" ? pay : bet > 0 ? pay / bet : pay);
  const gameOf = (t, s) => (s.uid && t.games && t.games[s.uid] ? `<small class="gm">🎰 ${esc(t.games[s.uid])}</small>` : "");
  const nm = (t, s) => (s.uid ? esc(s.name) + gameOf(t, s) : s.bye ? "— راحة" : "؟");
  const showV = (t, sc, pay) => (t.cmp === "pay" ? (t.currency || "$") + num(pay ?? sc) : num(sc) + "x");

  function matchHtml(tid, t, r, i, m) {
    const sl = (s, w, sc, pay, bet) => `<div class="bs ${w ? "w" : ""}"><span>${nm(t, s)}</span><b>${sc !== undefined ? showV(t, sc, pay) + (t.cmp === "x" && pay !== undefined ? ` <small class="gm">${t.currency || "$"}${num(pay)} / ${t.currency || "$"}${num(bet || 0)}</small>` : "") : ""}</b></div>`;
    if (m.w) return `<div class="bm">${sl(m.a, m.w === "a", m.sa, m.pa, m.ba)}${sl(m.b, m.w === "b", m.sb, m.pb, m.bb)}
      ${m.b.bye ? "" : `<div class="mrow" style="grid-template-columns:1fr"><button class="btn ghost small" data-act="clr" data-tid="${tid}" data-r="${r}" data-i="${i}">↩ تراجع</button></div>`}</div>`;
    const ready = t.status === "live" && Bracket.isP(m.a) && Bracket.isP(m.b), k = (s) => `m-${tid}-${r}-${i}-${s}`, dis = ready ? "" : "disabled";
    const row = (s, x) => `<div class="mrow3"><span>${nm(t, s)}</span><input class="ci n" type="number" min="0" step="any" id="${k("b" + x)}" data-keep="1" ${dis} placeholder="الرهان"><input class="ci n" type="number" min="0" step="any" id="${k("p" + x)}" data-keep="1" ${dis} placeholder="الربح"></div>`;
    return `<div class="bm">${row(m.a, "a")}${row(m.b, "b")}<div class="mrow" style="grid-template-columns:1fr"><button class="btn primary small" ${dis} data-act="res" data-tid="${tid}" data-r="${r}" data-i="${i}">✔ احسب الفائز</button></div></div>`;
  }

  function panel(tid, t) {
    const g = gv[t.gid], E = ent[t.gid] || {}, n = Object.keys(E).length, now = App.now();
    let ctl = "", body = "";
    if (t.status === "reg") {
      const open = g && g.status === "open" && g.endsAt > now;
      body = `<div class="gbox"><div class="gtop"><b>🎟️ التسجيل — كلمة الدخول: ${esc(t.keyword)}</b>${open ? `<span class="badge open">مفتوح</span><span class="gtimer" data-end="${g.endsAt}">${fmt(g.endsAt - now)}</span>` : `<span class="badge">مقفول</span>`}</div>
        <div class="hint">${n} مسجّل · رح نسحب ${Math.min(n, t.max)} من ${t.max}</div>
        <div class="chips" style="margin-top:8px">${Object.values(E).map((e) => `<span class="chip">${esc(e.name)}</span>`).join("") || '<span class="hint">لسا ما سجّل أحد.</span>'}</div></div>`;
      ctl = `<input id="ex-${tid}" data-keep="1" type="number" min="1" step="any" placeholder="دقائق" style="width:90px;padding:7px 10px;border-radius:11px;border:1px solid var(--line);background:rgba(5,7,15,.6)">
        <button class="btn ghost small" data-act="extend" data-tid="${tid}">⏱ ${open ? "تمديد" : "إعادة فتح"} التسجيل</button>
        ${open ? `<button class="btn danger small" data-act="endReg" data-tid="${tid}">🔒 إنهاء التسجيل الآن</button>` : ""}
        <button class="btn ghost small" data-act="manual" data-tid="${tid}">➕ لاعب يدوي</button>
        <button class="btn primary small" data-act="draw" data-tid="${tid}" ${open || n < 2 ? "disabled" : ""}>🎲 سحب اللاعبين</button>`;
    } else if (t.status === "seeded") {
      const ps = t.bracket[0].flatMap((m) => [m.a, m.b]).filter(Bracket.isP);
      body = `<h4 class="sub">اللاعبين وألعابهم</h4><div class="hint" style="margin-bottom:8px">اكتب لعبة (سلوت) كل لاعب لما يختارها. بعد ما تخلص كلهم اضغط "بدء البطولة".</div>
        <div class="tw"><table class="btable"><thead><tr><th>اللاعب</th><th>اللعبة</th></tr></thead><tbody>${ps.map((p) => `<tr><td>${esc(p.name)}</td><td><input class="ci" data-game="${tid}" data-uid="${esc(p.uid)}" value="${esc((t.games || {})[p.uid] || "")}" placeholder="اسم السلوت" maxlength="60"></td></tr>`).join("")}</tbody></table></div>`;
      const miss = ps.filter((p) => !(t.games || {})[p.uid]).length;
      ctl = `<button class="btn primary small" data-act="startT" data-tid="${tid}">▶ بدء البطولة${miss ? ` (${miss} بدون لعبة)` : ""}</button><button class="btn ghost small" data-act="redraw" data-tid="${tid}">🔄 إعادة القرعة</button>`;
    }
    const br = t.bracket && t.status !== "seeded" ? `<h4 class="sub">الشجرة — ${t.cmp === "pay" ? "أعلى ربح يفوز" : "أعلى x يفوز"}</h4><div class="brk">` + t.bracket.map((rd, r) => `<div class="bcol"><h5>${Bracket.roundName(r, t.bracket.length)}</h5>${rd.map((m, i) => matchHtml(tid, t, r, i, m)).join("")}</div>`).join("") + `</div>` : "";
    if (t.status === "live") ctl = `<button class="btn ghost small" data-act="resetT" data-tid="${tid}">↩ إلغاء الشجرة والرجوع للقرعة</button>`;
    return `<div class="panel"><div class="hh"><h3>${esc(t.title)} <span class="badge ${t.status === "ended" ? "" : "open"}">${ST[t.status]}</span></h3><span class="hint">${t.max} لاعب</span></div>
      <div class="row" style="margin:12px 0">${ctl}<button class="btn danger small" data-act="delT" data-tid="${tid}" style="margin-inline-start:auto">حذف</button></div>${body}${br}</div>`;
  }

  function render() {
    const act = document.getElementById("active"); if (!act) return;
    if (document.activeElement && /^(INPUT|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.closest("#active")) { clearTimeout(render.t); render.t = setTimeout(render, 700); return; }   // لا نمسح حقل قيد الكتابة
    const ids = Object.keys(ts).sort((a, b) => ts[b].createdAt - ts[a].createdAt);
    const run = ids.filter((id) => ts[id].status !== "ended"), fin = ids.filter((id) => ts[id].status === "ended");
    act.innerHTML = run.length ? run.map((id) => panel(id, ts[id])).join("") : `<div class="panel"><div class="msg">ما في بطولة نشطة. أنشئ وحدة من فوق.</div></div>`;
    Object.entries(keep).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });
    document.getElementById("done").innerHTML = fin.length ? fin.map((id) => {
      const t = ts[id], f = t.final || {};
      return `<div class="aitem"><div class="info"><b>${esc(t.title)}</b><small>🏆 ${esc((f.champion || {}).name || "")} · 🥈 ${esc((f.runnerUp || {}).name || "")}${f.third ? " · 🥉 " + esc(f.third.name) : ""}</small></div>
        <button class="btn ghost small" data-act="reopen" data-tid="${id}">↩ تراجع</button><button class="btn danger small" data-act="delT" data-tid="${id}">حذف</button></div>`;
    }).join("") : `<div class="msg">لسا ما في بطولة منتهية.</div>`;
  }

  const ref = (tid, p) => db.ref("tournaments/" + tid + (p ? "/" + p : ""));
  async function save(tid, R) {
    const fin = Bracket.result(R), u = { bracket: R };
    if (fin) { u.status = "ended"; u.final = fin; u.endedAt = SV.TIMESTAMP; }
    await ref(tid).update(u);
    if (fin) App.toast("انتهت البطولة 🏆 البطل: " + fin.champion.name);
  }


  // ---------- سحب اللاعبين واحد واحد بتأثير الكيس (CS) ----------
  const $ = (id) => document.getElementById(id);
  let dTid = null, drawn = [], spinning = false, muted = false;
  function openDraw(tid) {
    const t = ts[tid], E = Object.values(ent[t.gid] || {});
    if (E.length < 2) return App.toast("لازم لاعبين اثنين على الأقل");
    dTid = tid; drawn = [];
    $("dTitle").textContent = t.title; $("dPrize").textContent = "سحب لاعبي البطولة";
    $("dInfo").textContent = `${E.length} مسجّل · رح نسحب ${Math.min(E.length, t.max)} لاعب واحد واحد`;
    $("track").innerHTML = ""; $("case").classList.remove("done", "spinning"); $("reveal").classList.remove("show"); $("reveal").textContent = ""; $("wlist").innerHTML = "";
    $("dStart").style.display = ""; $("dStart").disabled = false;
    $("draw").classList.add("show");
  }
  $("drawClose").onclick = () => { if (spinning) return App.toast("استنى لين يخلص السحب"); $("draw").classList.remove("show"); };
  $("dSound").onclick = () => { muted = !muted; Reel.setMuted(muted); $("dSound").textContent = muted ? "🔇 صامت" : "🔊 الصوت"; };
  $("dStart").onclick = runDraw;

  async function runDraw() {
    if (spinning) return;
    const t = ts[dTid], gid = t.gid, g = gv[gid];
    if (g && g.status === "open" && g.endsAt > App.now()) return App.toast("أنهِ التسجيل أولاً");
    const live = Object.entries(ent[gid] || {}).map(([uid, e]) => ({ uid, name: e.name })), names = live.map((p) => p.name);
    const total = Math.min(t.max, live.length);
    let pool = live.slice(); drawn = [];
    spinning = true; $("dStart").disabled = true;
    try {
      for (let i = 0; i < total; i++) {
        const pick = Fair.pickWinners(pool, 1)[0];                     // الاختيار قبل الأنيميشن، آمن وعشوائي بالتساوي
        pool = pool.filter((p) => p.uid !== pick.uid);
        $("reveal").classList.remove("show");
        await Reel.spin($("case"), $("track"), names, pick.name);
        $("reveal").textContent = "⚔️ " + pick.name; $("reveal").classList.add("show");
        drawn.push(pick);
        $("wlist").innerHTML = drawn.map((w, k) => `<div>${k + 1}. <span>${esc(w.name)}</span></div>`).join("");
        await new Promise((r) => setTimeout(r, i === total - 1 ? 1500 : 2200));
      }
      // ترتيب السحب = مكانهم بالشجرة (أول واحد انسحب أول خانة...)
      const R = Bracket.build(drawn), w = {}; drawn.forEach((p) => (w[p.uid] = { name: p.name }));
      await db.ref("giveaways/" + gid).update({ status: "drawn", winners: w, drawnAt: SV.TIMESTAMP, entriesCount: live.length });
      await ref(dTid).update({ bracket: R, status: "seeded", games: null, entriesCount: live.length, drawnAt: SV.TIMESTAMP });
      $("dStart").style.display = "none"; App.toast("تمت القرعة ✓ اكتب لعبة كل لاعب");
    } catch (err) { console.error(err); App.toast("فشل حفظ القرعة — حاول من جديد"); $("dStart").disabled = false; }
    spinning = false;
  }

  async function onChange(e) {
    const el = e.target; if (!el.dataset.game) return;
    try { const v = el.value.trim(); await ref(el.dataset.game, "games/" + el.dataset.uid).set(v || null); } catch (err) { console.error(err); App.toast("فشل الحفظ"); }
  }

  async function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return; e.preventDefault();
    const a = b.dataset.act, tid = b.dataset.tid, t = ts[tid], gid = t && t.gid;
    try {
      if (a === "extend") {
        const m = Number(document.getElementById("ex-" + tid).value); if (!(m > 0)) return App.toast("اكتب عدد الدقائق");
        delete keep["ex-" + tid];
        await db.ref("giveaways/" + gid).update({ status: "open", endsAt: Math.max(App.now(), (gv[gid] || {}).endsAt || 0) + m * 60000 });
      } else if (a === "endReg") await db.ref("giveaways/" + gid + "/endsAt").set(App.now());
      else if (a === "draw") openDraw(tid);
      else if (a === "redraw") {
        if (confirm("إلغاء القرعة والرجوع للتسجيل؟ تقدر تسحب من جديد.")) { await ref(tid).update({ bracket: null, games: null, status: "reg" }); await db.ref("giveaways/" + gid).update({ status: "open", winners: null }); }
      } else if (a === "startT") {
        if (confirm("بدء البطولة؟ بعدها تقدر تدخل نتائج المباريات.")) await ref(tid).update({ status: "live", startedAt: SV.TIMESTAMP });
      } else if (a === "resetT") { if (confirm("إلغاء الشجرة وكل النتائج والرجوع لمرحلة القرعة؟")) await ref(tid).update({ bracket: null, games: null, status: "reg" }), await db.ref("giveaways/" + gid).update({ status: "open", winners: null }); }
      else if (a === "res") {
        const r = +b.dataset.r, i = +b.dataset.i, g = (s) => document.getElementById(`m-${tid}-${r}-${i}-${s}`).value;
        if (g("pa") === "" || g("pb") === "") return App.toast("اكتب ربح اللاعبين");
        const ba = Number(g("ba")) || 0, bb = Number(g("bb")) || 0, pa = Number(g("pa")), pb = Number(g("pb"));
        if (t.cmp === "x" && (!(ba > 0) || !(bb > 0))) return App.toast("اكتب رهان اللاعبين (لأن الفوز بالـ x)");
        if (!(pa >= 0) || !(pb >= 0)) return App.toast("أرقام غير صحيحة");
        const R = Bracket.setResult(t.bracket, r, i, score(t, ba, pa), score(t, bb, pb));
        if (!R) return App.toast("تعادل! لازم فائز — أعيدوا المباراة وأدخل النتيجة الجديدة");
        Object.assign(R[r][i], { ba, bb, pa, pb });
        ["ba", "bb", "pa", "pb"].forEach((s) => delete keep[`m-${tid}-${r}-${i}-${s}`]);
        await save(tid, R);
      } else if (a === "clr") {
        const R = Bracket.clearResult(t.bracket, +b.dataset.r, +b.dataset.i);
        if (!R) return App.toast("ما ينفع التراجع: المباراة التالية انلعبت (تراجع عنها أولاً)");
        const m = R[+b.dataset.r][+b.dataset.i]; ["ba", "bb", "pa", "pb"].forEach((k) => delete m[k]);
        await ref(tid).update({ bracket: R });
      } else if (a === "reopen") { if (confirm("التراجع عن إنهاء البطولة؟")) await ref(tid).update({ status: "live", final: null, endedAt: null }); }
      else if (a === "manual") await App.addManualEntry(gid);
      else if (a === "delT") { if (confirm("حذف البطولة نهائياً؟ (المسابقة المرتبطة بالتسجيل تنحذف كمان)")) { await ref(tid).remove(); await db.ref("giveaways/" + gid).remove(); await db.ref("entries/" + gid).remove(); } }
    } catch (err) { console.error(err); App.toast("فشل — تأكد من الصلاحيات"); }
  }
})();
