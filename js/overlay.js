// أوفرلاي OBS: يعرض المسابقة الجارية (الاسم، الجائزة، عدد الفائزين، الوقت المتبقي، عدد المشاركين)
// الرابط بـ OBS (Browser Source):  .../overlay.html   (مصمّم 440×320 ويتكيّف مع حجم المصدر)
(function () {
  const C = window.CONFIG;
  firebase.initializeApp(C.firebase);
  const db = firebase.database();
  const card = document.getElementById("card");

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let offset = 0, all = {}, counts = {}, refs = {}, idx = 0, lastKey = "";
  const now = () => Date.now() + offset;
  db.ref(".info/serverTimeOffset").on("value", (s) => (offset = s.val() || 0));

  db.ref("giveaways").orderByChild("createdAt").limitToLast(15).on("value", (s) => {
    all = s.val() || {};
    Object.keys(all).forEach((gid) => {
      if (refs[gid]) return;
      refs[gid] = db.ref("entries/" + gid);
      refs[gid].on("value", (es) => { counts[gid] = es.numChildren(); render(); });
    });
    render();
  });

  // المسابقات الجارية (الدخول مفتوح)، وإن ما في، المنتهي دخولها وبانتظار السحب
  function list() {
    const open = Object.entries(all).filter(([, g]) => g.status === "open");
    const live = open.filter(([, g]) => g.endsAt > now()).sort((a, b) => a[1].endsAt - b[1].endsAt);
    const wait = open.filter(([, g]) => g.endsAt <= now()).sort((a, b) => b[1].endsAt - a[1].endsAt);
    return live.length ? live.map((x) => [...x, "live"]) : wait.map((x) => [...x, "wait"]);
  }
  function fmt(ms) {
    const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60, p = (n) => String(n).padStart(2, "0");
    return (h ? h + ":" : "") + p(m) + ":" + p(s);
  }

  function render() {
    const items = list();
    if (!items.length) {
      const k = "none";
      if (lastKey !== k) { lastKey = k; card.innerHTML = `<div class="top"><img src="img/logo.png" alt=""><span class="tag">${esc(C.siteName)}</span></div>
        <div class="none"><b>لا يوجد مسابقات نشطة حالياً</b><small>ترقّبوا المسابقة القادمة</small></div>`; }
      return;
    }
    idx = idx % items.length;
    const [gid, g, state] = items[idx];
    const key = gid + state + items.length + idx;
    const left = g.endsAt - now();
    if (lastKey !== key) {                      // بنعيد بناء الكرت فقط عند تغيّر المسابقة/الحالة
      lastKey = key;
      card.style.animation = "none"; void card.offsetWidth; card.style.animation = "";
      card.innerHTML = `
        <div class="top"><img src="img/logo.png" alt=""><span class="tag"><i class="dot ${state === "wait" ? "wait" : ""}"></i>${state === "wait" ? "انتهى الدخول — بانتظار السحب" : "مسابقة جارية الآن"}</span></div>
        <h1>${esc(g.title)}</h1>
        <div class="prize">${g.prize ? esc(g.prize) : "&nbsp;"}</div>
        <div class="stats">
          <div class="st"><b>${esc(g.winnersCount)}</b><small>${g.winnersCount > 1 ? "فائزين" : "فائز"}</small></div>
          <div class="st time"><b id="oTime">--:--</b><small>الوقت المتبقي</small></div>
          <div class="st"><b id="oCnt">0</b><small>مشارك</small></div>
        </div>
        ${state === "live" ? `<div class="kw">اكتب بالشات <span>${esc(g.keyword)}</span></div>` : ""}
        ${items.length > 1 ? `<div class="pager">${items.map((_, i) => `<i class="${i === idx ? "on" : ""}"></i>`).join("")}</div>` : ""}`;
    }
    const t = document.getElementById("oTime"), c = document.getElementById("oCnt");
    if (t) t.textContent = state === "live" ? fmt(left) : "00:00";
    if (c) c.textContent = counts[gid] ?? 0;
  }
  setInterval(render, 500);                         // عدّاد الوقت + اكتشاف انتهاء المسابقة
  setInterval(() => { if (list().length > 1) { idx++; render(); } }, 9000);   // لو في أكثر من مسابقة: تتبدل كل 9 ثواني
})();
