// أقسام الصفحة الرئيسية: إحصائيات + فعاليات جارية + أعلى المستويات + آخر الفائزين (كلها من بيانات الموقع)
(function () {
  const { db, esc } = App, box = document.getElementById("hx");
  if (!box) return;
  const val = (p, n) => db.ref(p).orderByChild("createdAt").limitToLast(n).once("value").then((s) => s.val() || {}).catch(() => ({}));
  const left = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60); return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + "m"; };
  async function load() {
    const [gs, hs, ts, top] = await Promise.all([val("giveaways", 60), val("hunts", 40), val("tournaments", 40), Lv.top(5).catch(() => [])]);
    const G = Object.entries(gs).map(([id, g]) => ({ id, ...g })).filter((g) => !g.tournament).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const now = App.now(), done = G.filter((g) => g.status !== "open" || g.endsAt <= now);
    const winSet = new Set();
    done.forEach((g) => Object.keys(g.winners || {}).forEach((k) => winSet.add(k)));
    Object.values(hs).forEach((h) => ((h.final && h.final.winners) || []).forEach((w) => winSet.add(w.uid || w.name)));
    Object.values(ts).forEach((t) => { const f = t.final || {}; [f.champion, f.runnerUp, f.third].forEach((p) => { if (p) winSet.add(p.uid || p.name); }); });
    const winnersN = winSet.size;
    const hDone = Object.values(hs).filter((h) => h.phase === "ended").length, tDone = Object.values(ts).filter((t) => t.final).length;
    const stats = [["مسابقات منتهية", done.length], ["فائزون", winnersN], ["بونص هانت", hDone], ["بطولات", tDone]];
    let html = "";
    if (stats.some((s) => s[1])) html += `<div class="hx-stats">${stats.map(([a, b]) => `<div class="panel"><small>${a}</small><b>${b.toLocaleString("en")}</b></div>`).join("")}</div>`;
    html += `<div class="panel cc-promo"><a class="cc-pbanner" href="https://crowncases.gg/r/Peakz9" target="_blank" rel="noopener sponsored"><img src="img/crowncases-banner.jpg" alt="CrownCases" loading="lazy" width="1600" height="364"></a>
      <div class="cc-ptxt"><h2>ابدأ مع CrownCases</h2><p>سجّل من الرابط بكود الإحالة <b dir="ltr">PEAKZ9</b>، وبعدها فعّل كود البرومو <b dir="ltr">PEAKZ20</b> واحصل على بونص <b dir="ltr">$20</b> على أول إيداع. الحد الأدنى للإيداع <b dir="ltr">$20</b>، وتنطبق شروط وأحكام البونصات.</p>
      <div class="row"><a class="btn primary" href="https://crowncases.gg/r/Peakz9" target="_blank" rel="noopener sponsored">العب الآن</a><a class="btn ghost" href="crowncases.html">المزيد من العروض</a></div><small>+18 · العب بمسؤولية</small></div></div>`;
    const ev = [];
    G.filter((g) => g.status === "open" && g.endsAt > now).forEach((g) => ev.push(["مسابقة", g.title, g.prize || "", "تنتهي بعد " + left(g.endsAt - now), "giveaways.html", "شارك الآن"]));
    Object.values(hs).filter((h) => h.phase && h.phase !== "ended").forEach((h) => ev.push(["بونص هانت", h.title, "", h.guessOpen ? "التخمين مفتوح" : "جاري", "bonus.html", "شارك الآن"]));
    Object.values(ts).filter((t) => !t.final && t.title).forEach((t) => ev.push(["بطولة", t.title, "", t.status === "live" ? "جارية الآن" : "التسجيل مفتوح", "tournaments.html", "التفاصيل"]));
    const side = top.length ? `<div class="panel hx-top"><div class="hx-h"><h2>أعلى المستويات</h2><a href="stats.html">عرض الكل</a></div>${top.map((r, i) => `<div class="hx-r"><b>${i + 1}</b><span>${/^kick_\d+$/.test(r.uid) ? `<a href="user.html?id=${r.uid}">${esc(r.name)}</a>` : esc(r.name)}</span><small>Lv.${Lv.levelOf(r.xp)}</small></div>`).join("")}</div>` : "";
    if (ev.length || side) html += `<div class="hx-grid"><div>${ev.length ? `<div class="hx-h"><h2>الفعاليات الجارية</h2></div><div class="hx-ev">${ev.slice(0, 4).map((e) => `<a class="panel hx-c" href="${e[4]}"><small>${e[0]}</small><h3>${esc(e[1])}</h3>${e[2] ? `<div class="hx-p">${esc(e[2])}</div>` : ""}<div class="hx-t">${esc(e[3])}</div><span class="btn primary small">${e[5]}</span></a>`).join("")}</div>` : ""}</div>${side}</div>`;
    const wins = [];
    done.forEach((g) => g.winners && Object.entries(g.winners).forEach(([uid, w]) => wins.push({ uid, name: w.name || uid, prize: g.prize || g.title || "" })));
    if (wins.length) html += `<div class="hx-h"><h2>آخر الفائزين</h2></div><div class="hx-w">${wins.slice(0, 8).map((w) => `<div class="panel"><i>${esc((w.name || "?")[0].toUpperCase())}</i><div><b>${/^kick_\d+$/.test(w.uid) ? `<a href="user.html?id=${w.uid}">${esc(w.name)}</a>` : esc(w.name)}</b><small>${esc(w.prize)}</small></div></div>`).join("")}</div>`;
    box.innerHTML = html;
  }
  load().catch((e) => console.error(e));
})();
