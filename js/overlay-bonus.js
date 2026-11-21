// أوفرلاي OBS للبونص هانت (440×320): رصيد البداية، البريك إيفن، لمحة، وقائمة البونصات مع ملاحظاتها الملوّنة
// الرابط:  .../overlay-bonus.html   (آخر هانت شغّال تلقائياً)   أو  ?h=<معرّف الهانت>
(function () {
  const C = window.CONFIG;
  firebase.initializeApp(C.firebase);
  const db = firebase.database();
  const card = document.getElementById("card");
  const q = new URLSearchParams(location.search);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const M = Hunt.money, X = Hunt.xfmt;
  let offset = 0, hunts = {}, lastSig = "";
  const now = () => Date.now() + offset;
  db.ref(".info/serverTimeOffset").on("value", (s) => (offset = s.val() || 0));
  db.ref("hunts").orderByChild("createdAt").limitToLast(10).on("value", (s) => { hunts = s.val() || {}; render(); });

  const fmt = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };
  function pick() {
    const only = q.get("h");
    if (only) return hunts[only] ? [only, hunts[only]] : null;
    const ids = Object.keys(hunts).filter((id) => hunts[id].phase !== "ended").sort((a, b) => hunts[b].createdAt - hunts[a].createdAt);
    return ids.length ? [ids[0], hunts[ids[0]]] : null;
  }

  function render() {
    const p = pick();
    if (!p) {
      if (lastSig !== "none") { lastSig = "none"; card.innerHTML = `<div class="top"><img src="img/logo.png" alt=""><span class="tag">${esc(C.siteName)}</span></div><div class="none"><div class="ic">🎯</div><b>لا يوجد بونص هانت حالياً</b><small>ترقّبوا الهانت القادم</small></div>`; }
      return;
    }
    const [hid, h] = p, S = Hunt.stats(h.bonuses, h.startBalance), cur = h.currency || "$", opening = h.phase === "opening", ended = h.phase === "ended";
    const open = h.phase === "collecting" && h.guessOpen === true && (!h.guessEndsAt || h.guessEndsAt > now());
    const left = h.guessEndsAt ? h.guessEndsAt - now() : null;
    const sig = JSON.stringify([hid, h.title, h.phase, h.startBalance, h.currency, h.bonuses, open]);
    if (sig !== lastSig) {
      lastSig = sig;
      const rows = S.list.map((b, i) => {
        const x = b.payout !== null && b.bet > 0 ? b.payout / b.bet : null;
        const cls = b.id === S.nextId && opening ? "nx" : x !== null && x >= 100 ? "ht" : x !== null && x >= 25 ? "gd" : "";
        const res = b.payout !== null ? X(x) : b.id === S.nextId && opening ? "◀" : "";
        return `<div class="row ${cls}" ${b.id === S.nextId && opening ? 'id="nxt"' : ""}><span class="n">${i + 1}</span><span class="s">${esc(b.slot)}${b.note ? `<span class="nchip" style="${Hunt.noteStyle(b.nc)}">${esc(b.note)}</span>` : ""}</span><span class="bt">${M(b.bet, cur)}</span><span class="x">${res}</span></div>`;
      }).join("");
      const T = (cls, label, val) => `<div class="st ${cls}"><small>${label}</small><b>${val}</b></div>`;
      const tiles = h.startBalance != null
        ? T("", "رصيد البداية", M(h.startBalance, cur)) + T("be", "للتعادل (BE)", X(S.beX)) + (opening || ended ? (S.profit !== null ? T(S.profit >= 0 ? "up" : "down", "ربح / خسارة", M(S.profit, cur)) : T("", "الربح", M(S.totalWin, cur))) : T("", "مجموع الرهانات", M(S.totalBets, cur)))
        : T("", "البونصات", S.count) + T("", "مجموع الرهانات", M(S.totalBets, cur)) + (opening || ended ? T("", "إجمالي الربح", M(S.totalWin, cur)) : T("", "متوسط الرهان", M(S.count ? S.totalBets / S.count : null, cur)));
      card.innerHTML = `<div class="top"><img src="img/logo.png" alt=""><span class="tag"><i class="dot ${opening ? "wait" : ""}"></i>${opening ? "جاري التفتيح" : ended ? "انتهى الهانت" : "جمع البونصات"}</span><span class="sp tag" id="gs"></span></div>
        <h1>🎯 ${esc(h.title)}</h1>
        <div class="stats">${tiles}</div>
        <div class="glance"><span>البونصات <b>${opening || ended ? S.openedCount + "/" + S.count : S.count}</b></span>${opening || ended ? `<span>الإجمالي <b>${M(S.totalWin, cur)}</b></span><span>متوسط <b>${X(S.avgX)}</b></span>` : `<span>مجموع الرهانات <b>${M(S.totalBets, cur)}</b></span>`}</div>
        <div class="lst" id="lst">${rows || '<div class="row" style="grid-template-columns:1fr;text-align:center;color:#9fb0d6">لسا ما انضاف أي بونص</div>'}</div>`;
      const l = document.getElementById("lst"), nx = document.getElementById("nxt");
      if (l) { if (nx) l.scrollTop = Math.max(0, nx.offsetTop - l.clientHeight / 2); else l.scrollTop = l.scrollHeight; }
    }
    const gs = document.getElementById("gs");
    if (gs) gs.innerHTML = h.phase === "collecting" ? (open ? `التخمين <b style="color:#34f5b0">مفتوح${left !== null ? " " + fmt(left) : ""}</b>` : `التخمين <b>مقفول</b>`) : "";
  }
  setInterval(render, 1000);
})();
