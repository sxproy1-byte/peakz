// اللفل والبادجات (للعرض): الحسابات الحقيقية للنقاط بالـ Worker (levels/{uid})، وهون بس القراءة والعرض.
// المعادلة لازم تبقى نفس اللي بالـ Worker: مجموع النقاط للمستوى L = 25 × L^1.8 (الحد الأعلى 100)
(function () {
  const MAX = 100;
  const xpFor = (L) => Math.round(25 * Math.pow(L, 1.8));
  const levelOf = (xp) => { let L = 0; while (L < MAX && xp >= xpFor(L + 1)) L++; return L; };
  const progress = (xp) => {
    const L = levelOf(xp), a = xpFor(L), b = L >= MAX ? a : xpFor(L + 1);
    return { level: L, xp, from: a, to: b, pct: L >= MAX ? 100 : Math.max(0, Math.min(100, Math.round(((xp - a) / (b - a)) * 100))), left: L >= MAX ? 0 : b - xp };
  };

  // تعريف البادجات: [الفئة، الحقل، العتبة، المستوى (1 برونز .. 4 ماسي)، الاسم، الوصف]
  const DEFS = [
    ["sub", "subMonths", 1, 1, "مشترك", "اشتراك بقناة peakz9 على كيك"],
    ["sub", "subMonths", 3, 2, "مشترك وفي", "3 شهور اشتراك"],
    ["sub", "subMonths", 6, 3, "مشترك ذهبي", "6 شهور اشتراك"],
    ["sub", "subMonths", 12, 4, "أسطورة الاشتراك", "سنة اشتراك"],
    ["part", "entries", 1, 1, "أول مشاركة", "شارك بأول مسابقة"],
    ["part", "entries", 10, 2, "مشارك نشيط", "10 مسابقات"],
    ["part", "entries", 25, 3, "مشارك دائم", "25 مسابقة"],
    ["part", "entries", 50, 4, "عمود المسابقات", "50 مسابقة"],
    ["win", "wins", 1, 1, "أول فوز", "فزت بمسابقة"],
    ["win", "wins", 3, 2, "محظوظ", "3 انتصارات"],
    ["win", "wins", 5, 3, "فائز متكرر", "5 انتصارات"],
    ["win", "wins", 10, 4, "ملك الحظ", "10 انتصارات"],
    ["hunt", "hGuess", 1, 1, "أول تخمين", "خمّنت بالبونص هانت"],
    ["hunt", "hGuess", 10, 2, "مخمّن", "10 تخمينات"],
    ["hunt", "hGuess", 25, 3, "خبير تخمين", "25 تخمين"],
    ["near", "hTop3", 1, 2, "تخمين قريب", "جيت بأقرب 3 تخمينات"],
    ["near", "hTop3", 3, 3, "عين الصقر", "3 مرات بأقرب 3 تخمينات"],
    ["near", "hFirst", 1, 3, "قنّاص", "أقرب تخمين للرقم الحقيقي"],
    ["near", "hFirst", 3, 4, "قنّاص محترف", "3 مرات أقرب تخمين"],
    ["tour", "tPlayed", 1, 1, "لاعب بطولات", "سجّلت ببطولة"],
    ["tour", "tPlayed", 5, 2, "محارب", "5 بطولات"],
    ["tour", "tPodium", 1, 3, "منصّة التتويج", "وصلت المركز الأول أو الثاني أو الثالث"],
    ["tour", "tChamp", 1, 4, "بطل", "فزت ببطولة"],
    ["chat", "msgs", 100, 1, "متفاعل", "100 رسالة بالبث"],
    ["chat", "msgs", 1000, 3, "نجم الشات", "1000 رسالة بالبث"],
    ["chat", "msgs", 5000, 4, "ملك الشات", "5000 رسالة بالبث"],
    ["watch", "hours", 5, 1, "مشاهد", "5 ساعات تواجد بالبث"],
    ["watch", "hours", 25, 2, "مشاهد وفي", "25 ساعة تواجد بالبث"],
    ["watch", "hours", 100, 4, "ساكن البث", "100 ساعة تواجد بالبث"],
    ["lvl", "level", 10, 1, "لفل 10", "وصلت المستوى 10"],
    ["lvl", "level", 25, 2, "لفل 25", "وصلت المستوى 25"],
    ["lvl", "level", 50, 3, "لفل 50", "وصلت المستوى 50"],
    ["lvl", "level", 100, 4, "لفل 100", "المستوى الأقصى"],
  ];
  const badges = (s) => [...Object.values(s.ab || {}).filter((x) => x && x.n).map((x) => ({ cat: "x", tier: Math.min(4, Math.max(1, Number(x.t) || 1)), name: String(x.n), desc: "", need: 0, have: 0, ok: true })), ...DEFS.map(([cat, f, n, tier, name, desc]) => ({ cat, tier, name, desc, need: n, have: Number(s[f]) || 0, ok: (Number(s[f]) || 0) >= n }))];
  const shield = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.4 3.1 8 7.5 9.5 4.4-1.5 7.5-5.1 7.5-9.5V6z"/></svg>';
  const html = (list, esc) => list.map((b) => `<div class="bdg t${b.tier} ${b.ok ? "ok" : "lock"}" title="${esc(b.desc)}${b.ok ? "" : " — " + Math.min(b.have, b.need) + "/" + b.need}">${shield}<span>${esc(b.name)}</span></div>`).join("");

  // إحصائيات المشاركة من بيانات الموقع العامة (مرة كل 10 دقائق بالكاش)
  async function loadStats(uid) {
    const key = "lvStats:" + uid;
    try { const c = JSON.parse(sessionStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 600000) return c.v; } catch (e) {}
    const db = App.db, val = (r) => r.once("value").then((s) => s.val()).catch(() => null);
    const [gs, hs, ts] = await Promise.all([
      db.ref("giveaways").orderByChild("createdAt").limitToLast(80).once("value").then((s) => s.val() || {}),
      db.ref("hunts").orderByChild("createdAt").limitToLast(40).once("value").then((s) => s.val() || {}),
      db.ref("tournaments").orderByChild("createdAt").limitToLast(40).once("value").then((s) => s.val() || {}),
    ]);
    const v = { entries: 0, wins: 0, hGuess: 0, hTop3: 0, hFirst: 0, tPlayed: 0, tChamp: 0, tPodium: 0 };
    const gids = Object.keys(gs).filter((id) => !gs[id].tournament);
    const ge = await Promise.all(gids.map((id) => val(db.ref(`entries/${id}/${uid}`))));
    gids.forEach((id, i) => { if (ge[i]) v.entries++; if (gs[id].winners && gs[id].winners[uid]) v.wins++; });
    const hids = Object.keys(hs).filter((id) => hs[id].phase === "ended");
    const hg = await Promise.all(hids.map((id) => val(db.ref(`huntGuesses/${id}/${uid}`))));
    for (let i = 0; i < hids.length; i++) {
      if (!hg[i]) continue; v.hGuess++;
      const all = (await val(db.ref("huntGuesses/" + hids[i]))) || {};
      const total = Hunt.stats(hs[hids[i]].bonuses, hs[hids[i]].startBalance).totalWin;
      const me = Hunt.rank(all, total, hs[hids[i]].prizes).find((g) => g.uid === uid);
      if (me && me.rank === 1) v.hFirst++;
      if (me && me.rank <= 3) v.hTop3++;
    }
    const tl = Object.values(ts);
    const te = await Promise.all(tl.map((t) => (t.gid ? val(db.ref(`entries/${t.gid}/${uid}`)) : null)));
    tl.forEach((t, i) => {
      const f = t.final || {};
      const ch = f.champion && f.champion.uid === uid, pod = ch || (f.runnerUp && f.runnerUp.uid === uid) || (f.third && f.third.uid === uid);
      if (te[i] || pod) v.tPlayed++;
      if (ch) v.tChamp++;
      if (pod) v.tPodium++;
    });
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (e) {}
    return v;
  }
  async function loadLevel(uid) { return (await App.db.ref("levels/" + uid).once("value").then((s) => s.val()).catch(() => null)) || {}; }
  async function top(n) {
    const s = await App.db.ref("levels").orderByChild("xp").limitToLast(n || 50).once("value");
    const a = Object.entries(s.val() || {}).map(([k, v]) => ({ uid: k, name: (v && v.name) || k, xp: (v && v.xp) || 0, subMonths: (v && v.subMonths) || 0 }));
    return a.sort((x, y) => y.xp - x.xp);
  }
  window.Lv = { MAX, xpFor, levelOf, progress, DEFS, badges, html, loadStats, loadLevel, top };
})();
