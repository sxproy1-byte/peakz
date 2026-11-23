// منطق البونص هانت (حسابات + ترتيب الفائزين). نفس الملف يستخدمه الموقع والاختبارات.
(function (root) {
  const n = (x) => (x === null || x === undefined || x === "" || !isFinite(Number(x)) ? null : Number(x));
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  // قائمة البونصات مرتبة + إحصائيات
  function stats(bonuses, startBalance) {
    const list = Object.entries(bonuses || {}).map(([id, b]) => ({ id, slot: b.slot || "", bet: n(b.bet) || 0, payout: n(b.payout), note: b.note || "", nc: b.nc || "g" }));
    const opened = list.filter((b) => b.payout !== null), rest = list.filter((b) => b.payout === null);
    const totalWin = sum(opened.map((b) => b.payout));
    const openedBets = sum(opened.map((b) => b.bet)), restBets = sum(rest.map((b) => b.bet));
    const start = n(startBalance);
    let best = null;
    opened.forEach((b) => { const x = b.bet > 0 ? b.payout / b.bet : 0; if (!best || x > best.x) best = { ...b, x }; });
    return {
      list, count: list.length, openedCount: opened.length, nextId: rest.length ? rest[0].id : null,
      totalBets: sum(list.map((b) => b.bet)), totalWin,
      avgX: openedBets > 0 ? totalWin / openedBets : null,                         // متوسط المضاعف للمفتوح
      beX: start !== null && restBets > 0 ? Math.max(0, (start - totalWin) / restBets) : null,   // المضاعف المطلوب على الباقي للتعادل
      profit: start !== null ? totalWin - start : null, best,
    };
  }

  // ترتيب التخمينات: الأقرب للرقم الحقيقي أولاً، وعند التساوي الأقدم تخميناً، وعند التساوي التام الـ uid (ثابت وغير متحيّز)
  function rank(guesses, total, prizes) {
    const arr = Object.entries(guesses || {}).map(([uid, g]) => ({ uid, name: g.name, value: n(g.value), at: n(g.at) }))
      .filter((g) => g.value !== null);
    arr.forEach((g) => (g.diff = Math.abs(g.value - total)));
    arr.sort((a, b) => a.diff - b.diff || (a.at ?? Infinity) - (b.at ?? Infinity) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    arr.forEach((g, i) => { g.rank = i + 1; g.prize = i < 3 ? (prizes && prizes[i]) || "" : ""; });
    return arr;
  }

  const money = (v, cur) => (v === null || v === undefined ? "—" : (Number(v) < 0 ? "-" : "") + (cur || "$") + Math.abs(Number(v)).toLocaleString("en", { maximumFractionDigits: 2 }));
  const xfmt = (x) => (x === null || x === undefined ? "—" : Number(x).toLocaleString("en", { maximumFractionDigits: 2 }) + "x");
  // ألوان الملاحظة بجانب البونص (اختيارية): g ذهبي، p بنفسجي، k أخضر، r أحمر، b أزرق
  const NC = { g: ["#ffd36e", "#2a2008"], p: ["#b77bff", "#1e0f33"], k: ["#34f5b0", "#052a1e"], r: ["#ff6b7a", "#33080e"], b: ["#4da3ff", "#06203a"] };
  const noteStyle = (nc) => { const c = NC[nc] || NC.g; return `background:${c[0]};color:${c[1]}`; };
  const api = { stats, rank, money, xfmt, NC, noteStyle };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Hunt = api;
})(typeof window !== "undefined" ? window : globalThis);
