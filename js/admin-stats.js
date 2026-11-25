// أدمن: الإحصائيات — المستخدمين، المشاركات، أكثر الفعاليات تفاعلاً، توزيع اللفلات
(function () {
  const { db, esc } = App;
  App.shell("giveaways");
  const root = document.getElementById("root");
  const TABS = `<h1 class="plain">لوحة التحكم</h1><div class="atabs"><a href="admin.html">🎟️ المسابقات</a><a href="admin-bonus.html">🎯 البونص هانت</a><a href="admin-tournaments.html">⚔️ البطولات</a><a href="admin-slots.html">🎰 السلوت كول</a><a href="admin-profiles.html">👤 البروفايلات</a><a href="admin-stats.html" class="on">📊 الإحصائيات</a><a href="admin-database.html">🗄️ قاعدة البيانات</a></div>`;
  const val = (p) => db.ref(p).once("value").then((s) => s.val() || {}).catch(() => ({}));
  const num = (n) => Number(n || 0).toLocaleString("en");
  const DAY = 86400000;
  const bars = (rows) => { const mx = Math.max(1, ...rows.map((r) => r[1])); return `<div class="st-bars">${rows.map(([l, v]) => `<div class="st-row"><span class="st-l" dir="ltr">${esc(l)}</span><div class="st-t"><i style="width:${Math.round((v / mx) * 100)}%"></i></div><b>${num(v)}</b></div>`).join("")}</div>`; };

  App.onUser((u) => {
    if (!u) {
      root.innerHTML = `<div class="empty"><div>سجّل دخولك بحساب الأدمن على كيك للوصول للوحة التحكم</div><div class="center"><button class="btn primary" id="l">تسجيل الدخول بكيك</button></div></div>`;
      document.getElementById("l").onclick = () => App.login("admin-stats.html");
    } else if (!u.admin) root.innerHTML = `<div class="empty"><div>حسابك (${esc(u.name)}) مو أدمن</div></div>`;
    else load();
  });

  async function load() {
    root.innerHTML = TABS + '<div class="empty">جاري التحميل...</div>';
    try {
      const [users, ver, lv, gs, hs, ts] = await Promise.all([val("users"), val("verified"), val("levels"), val("giveaways"), val("hunts"), val("tournaments")]);
      const gids = Object.keys(gs).sort((a, b) => (gs[b].createdAt || 0) - (gs[a].createdAt || 0)).slice(0, 60);
      const hids = Object.keys(hs).sort((a, b) => (hs[b].createdAt || 0) - (hs[a].createdAt || 0)).slice(0, 40);
      const [ents, gus] = await Promise.all([Promise.all(gids.map((id) => val("entries/" + id))), Promise.all(hids.map((id) => val("huntGuesses/" + id)))]);
      const now = Date.now(), U = Object.values(users);
      const total = U.length, verified = Object.values(ver).filter((v) => v && v.status === "ok").length || Object.keys(ver).length;
      const act7 = U.filter((u) => u.lastLogin > now - 7 * DAY).length, new7 = U.filter((u) => u.createdAt > now - 7 * DAY).length;
      let site = 0, chat = 0;
      const gRows = gids.map((id, i) => { const e = Object.values(ents[i]); e.forEach((x) => (x && x.source === "site" ? site++ : chat++)); return { t: (gs[id].tournament ? "⚔️ " : "🎟️ ") + (gs[id].title || id), n: e.length }; });
      const hRows = hids.map((id, i) => ({ t: "🎯 " + (hs[id].title || id), n: Object.keys(gus[i]).length }));
      const avg = (a) => (a.length ? Math.round(a.reduce((s, r) => s + r.n, 0) / a.length) : 0);
      const top = [...gRows, ...hRows].sort((a, b) => b.n - a.n).slice(0, 8);
      const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(now - i * DAY), k = d.toISOString().slice(5, 10); days.push([k, U.filter((u) => u.lastLogin && new Date(u.lastLogin).toISOString().slice(5, 10) === k && now - u.lastLogin < 15 * DAY).length]); }
      const lvl = Object.values(lv).map((x) => (window.Lv ? Lv.levelOf(x.xp || 0) : 0));
      const B = [["0", 0, 0], ["1–4", 1, 4], ["5–9", 5, 9], ["10–19", 10, 19], ["20–49", 20, 49], ["50+", 50, 100]];
      const dist = B.map(([l, a, b]) => [l, lvl.filter((x) => x >= a && x <= b).length]);
      const stat = (a, b) => `<div class="panel"><small>${a}</small><b>${b}</b></div>`;
      root.innerHTML = TABS + `
        <div class="hx-stats">${stat("إجمالي المسجلين", num(total))}${stat("نشطين آخر 7 أيام", num(act7))}${stat("مسجلين جدد (7 أيام)", num(new7))}${stat("موثّقين", num(verified))}</div>
        <div class="hx-stats">${stat("مسابقات (آخر 60)", num(gids.length))}${stat("متوسط المشاركين بالمسابقة", num(avg(gRows)))}${stat("متوسط التخمينات بالهانت", num(avg(hRows)))}${stat("مشاركة من الموقع / الشات", num(site) + " / " + num(chat))}</div>
        <div class="panel"><h2>أكثر الفعاليات تفاعلاً</h2>${top.length ? bars(top.map((r) => [r.t, r.n])) : '<div class="hint">ما في بيانات بعد</div>'}</div>
        <div class="panel"><h2>آخر دخول للمستخدمين (14 يوم)</h2>${bars(days)}</div>
        <div class="panel"><h2>توزيع المستويات</h2>${bars(dist)}</div>
        <p class="hint" style="text-align:start">"المسجلين الجدد" بيبدأ يعدّ من تاريخ هالتحديث. الأرقام محسوبة من آخر 60 مسابقة و40 هانت.</p>`;
    } catch (e) { console.error(e); root.innerHTML = TABS + '<div class="empty">فشل التحميل — تأكد من قواعد Firebase</div>'; }
  }
})();
