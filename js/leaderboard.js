// المتصدرين: أكثر مشاركة بالمسابقات، أدق تخمين بالبونص هانت، أبطال البطولات. (كل البيانات عامة، بنحسبها بالمتصفح)
(function () {
  const { db, esc } = App;
  App.shell("leaderboard");
  const root = document.getElementById("lb");
  let tab = "lvl", data = null;
  const TOP = 20;
  const medal = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1);
  const bump = (m, uid, name, f) => { const r = m[uid] || (m[uid] = { uid, name: name || uid, a: 0, b: 0, c: 0, d: 0 }); if (name) r.name = name; f(r); };

  document.querySelectorAll(".tabs button").forEach((b) => {
    b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b)); render(); };
  });

  async function load() {
    const [gs, hs, ts] = await Promise.all([
      db.ref("giveaways").orderByChild("createdAt").limitToLast(80).once("value").then((s) => s.val() || {}),
      db.ref("hunts").orderByChild("createdAt").limitToLast(40).once("value").then((s) => s.val() || {}),
      db.ref("tournaments").orderByChild("createdAt").limitToLast(40).once("value").then((s) => s.val() || {}),
    ]);
    // 1) المشاركة: عدد المسابقات اللي شارك فيها كل شخص + كم مرة فاز
    const part = {};
    const gids = Object.keys(gs).filter((id) => !gs[id].tournament);
    const ents = await Promise.all(gids.map((id) => db.ref("entries/" + id).once("value").then((s) => s.val() || {}).catch(() => ({}))));
    gids.forEach((id, i) => {
      Object.entries(ents[i]).forEach(([uid, e]) => bump(part, uid, e && e.name, (r) => r.a++));        // a = مشاركات
      Object.entries(gs[id].winners || {}).forEach(([uid, w]) => bump(part, uid, w && w.name, (r) => r.b++));  // b = فوز
    });
    // 2) التخمين: الهانتات المنتهية
    const hunt = {};
    const hids = Object.keys(hs).filter((id) => hs[id].phase === "ended");
    const gus = await Promise.all(hids.map((id) => db.ref("huntGuesses/" + id).once("value").then((s) => s.val() || {}).catch(() => ({}))));
    hids.forEach((id, i) => {
      const total = Hunt.stats(hs[id].bonuses, hs[id].startBalance).totalWin;
      const rk = Hunt.rank(gus[i], total, hs[id].prizes);
      rk.forEach((g) => bump(hunt, g.uid, g.name, (r) => {
        r.a++;                                   // a = عدد التخمينات
        if (g.rank === 1) r.b++;                 // b = مرات المركز الأول
        if (g.rank <= 3) r.c++;                  // c = مرات بالمراكز الثلاثة
        if (total > 0) { r.d += Math.abs(g.value - total) / total; }   // d = مجموع نسبة الخطأ
      }));
    });
    // 3) البطولات
    const tour = {};
    Object.values(ts).filter((t) => t.status === "ended" && t.final).forEach((t) => {
      const f = t.final;
      if (f.champion) bump(tour, f.champion.uid, f.champion.name, (r) => r.a++);     // a = بطل
      if (f.runnerUp) bump(tour, f.runnerUp.uid, f.runnerUp.name, (r) => r.b++);     // b = وصيف
      if (f.third) bump(tour, f.third.uid, f.third.name, (r) => r.c++);              // c = ثالث
    });
    const lvl = await Lv.top(TOP).catch(() => []);
    data = {
      lvl,
      part: Object.values(part).sort((x, y) => y.a - x.a || y.b - x.b || (x.name < y.name ? -1 : 1)),
      hunt: Object.values(hunt).sort((x, y) => y.b - x.b || y.c - x.c || x.d / x.a - y.d / y.a || y.a - x.a),
      tour: Object.values(tour).sort((x, y) => y.a - x.a || y.b - x.b || y.c - x.c),
      counts: { g: gids.length, h: hids.length, t: Object.values(ts).filter((t) => t.status === "ended" && t.final).length },
    };
  }

  function table(head, rows) {
    if (Array.isArray(rows)) rows = rows.join("");
    return `<div class="tscroll"><table class="btable lb"><thead><tr><th style="width:56px">#</th><th>${head[0]}</th>${head.slice(1).map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function render() {
    if (!data) return;
    const me = App.user ? App.user.uid : null;
    const tr = (i, r, cells) => `<tr class="${i < 3 ? "hot" : ""} ${r.uid === me ? "next" : ""}"><td>${medal(i)}</td><td><b>${/^kick_\d+$/.test(r.uid) ? `<a href="user.html?id=${r.uid}">${esc(r.name)}</a>` : esc(r.name)}</b></td>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    let html = "", list = data[tab];
    if (tab === "lvl") {
      html = list.length ? table(["المتفاعل", "المستوى", "الخبرة", "الاشتراك"], list.slice(0, TOP).map((r, i) => tr(i, r, [`<b class="gold">${Lv.levelOf(r.xp)}</b>`, r.xp.toLocaleString("en"), r.subMonths ? r.subMonths + " شهر" : "—"]))) : "";
    } else if (tab === "part") {
      html = list.length ? table(["المشارك", "المسابقات", "الفوز"], list.slice(0, TOP).map((r, i) => tr(i, r, [r.a, r.b || "—"]))) : "";
    } else if (tab === "hunt") {
      html = list.length ? table(["المخمّن", "التخمينات", "المركز الأول", "بالمراكز الثلاثة", "متوسط الخطأ"], list.slice(0, TOP).map((r, i) => tr(i, r, [r.a, r.b || "—", r.c || "—", (r.d / r.a * 100).toLocaleString("en", { maximumFractionDigits: 1 }) + "%"]))) : "";
    } else {
      html = list.length ? table(["اللاعب", "بطل", "وصيف", "ثالث"], list.slice(0, TOP).map((r, i) => tr(i, r, [r.a || "—", r.b || "—", r.c || "—"]))) : "";
    }
    const en = window.I18N && I18N.lang === "en", c = data.counts;
    const note = tab === "lvl" ? (en ? "Level from chat, watch time and subscription" : "المستوى من الشات والتواجد بالبث والاشتراك") : tab === "part" ? (en ? `From the last ${c.g} giveaways` : `من آخر ${c.g} مسابقة`) : tab === "hunt" ? (en ? `From ${c.h} finished bonus hunts` : `من ${c.h} بونص هانت منتهي`) : (en ? `From ${c.t} finished tournaments` : `من ${c.t} بطولة منتهية`);
    root.innerHTML = html ? `<div class="hint" style="margin-bottom:12px">${note}</div>${html}` : '<div class="empty">ما في بيانات لسا</div>';
  }

  App.onUser(() => render());
  window.addEventListener("langchange", render);
  load().then(render).catch((e) => { console.error(e); root.innerHTML = '<div class="empty">تعذّر تحميل البيانات</div>'; });
})();
