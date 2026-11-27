// ليدر بورد CrownCases: بوديوم أول 3 + عدّاد تنتهي فيه + جدول 4-10، بيحدّثها الأدمن يدوياً (ccBoard)
(function () {
  const { db, esc } = App;
  App.shell("leaderboard");
  const root = document.getElementById("ccb");
  const DAY = 86400000, WEEK = 7 * DAY, JO = 3 * 3600000;          // توقيت الأردن ثابت UTC+3
  const money = (x) => { x = String(x || "").trim(); if (!x) return ""; const n = Number(x.replace(/[$,\s]/g, "")); return isFinite(n) && /\d/.test(x) ? "$" + n.toLocaleString("en", { maximumFractionDigits: 2 }) : x; };
  const defaultEnd = () => { const sh = new Date(Date.now() + JO), mid = Date.UTC(sh.getUTCFullYear(), sh.getUTCMonth(), sh.getUTCDate()); let k = (5 - sh.getUTCDay() + 7) % 7; if (k === 0) k = 7; return mid + k * DAY - JO; };   // نهاية يوم الخميس (الجمعة 00:00) بتوقيت الأردن
  const target = (v) => { let t = Number(v.endsAt) || 0; if (!t) return defaultEnd(); if (Date.now() > t && v.weekly !== false) t += Math.ceil((Date.now() - t) / WEEK) * WEEK; return t; };
  const av = (name, cls) => `<span class="ccl-av ${cls || ""}">${esc((name || "").trim().charAt(0).toUpperCase())}</span>`;
  const crown = '<svg class="ccl-crown" viewBox="0 0 48 32" aria-hidden="true"><path d="M4 28 L2 8 l12 9 L24 2 l10 15 L46 8 l-2 20z" fill="currentColor"/></svg>';
  let v = {}, timer = null;
  const pod = (r, i) => `<div class="ccl-pod p${i}">${i === 1 ? crown : ""}${av(r.name, "big")}<span class="ccl-rank">${i}</span><div class="ccl-name">${r.name ? esc(r.name) : "—"}</div>${r.wager ? `<small>الويجر</small><b dir="ltr">${esc(money(r.wager))}</b>` : ""}${r.prize ? `<span class="ccl-prize" dir="ltr">${esc(money(r.prize))}</span>` : ""}</div>`;
  function render() {
    const rows = v.rows || {}, L = []; for (let i = 1; i <= 10; i++) { const r = rows[i] || {}; L.push({ name: r.name || "", wager: r.wager || "", prize: r.prize || "" }); }
    const hasW = L.some((r) => r.wager);
    root.innerHTML = `<div class="ccl-podium">${pod(L[1], 2)}${pod(L[0], 1)}${pod(L[2], 3)}</div>
      <div class="ccl-end"><div class="ccl-title" id="cclT">ينتهي الليدر بورد بعد</div><div class="ccl-cd" dir="ltr" id="cclCd"></div>
      ${v.updatedAt ? `<div class="ccl-upd">آخر تحديث: <span dir="ltr">${new Date(v.updatedAt).toLocaleDateString("en-GB")}</span></div>` : ""}${v.period ? `<div class="ccl-upd">${esc(v.period)}</div>` : ""}</div>
      <div class="ccl-table"><div class="ccl-th"><span>المركز</span><span>اللاعب</span>${hasW ? "<span>الويجر</span>" : "<span></span>"}<span>الجائزة</span></div>
      ${L.slice(3).map((r, k) => `<div class="ccl-tr"><span class="ccl-pl">${k + 4}</span><span class="ccl-us">${av(r.name)}${r.name ? esc(r.name) : "—"}</span><span class="ccl-w" dir="ltr">${esc(money(r.wager))}</span><span class="ccl-rw">${r.prize ? `<i dir="ltr">${esc(money(r.prize))}</i>` : ""}</span></div>`).join("")}</div>`;
    tick(); clearInterval(timer); timer = setInterval(tick, 1000);
  }
  function tick() {
    const el = document.getElementById("cclCd"); if (!el) return;
    let ms = target(v) - Date.now(), t = document.getElementById("cclT");
    if (ms <= 0) { el.innerHTML = ""; t.textContent = "انتهى الليدر بورد"; return; }
    t.textContent = "ينتهي الليدر بورد بعد";
    const d = Math.floor(ms / DAY), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    el.innerHTML = [[d, "الأيام"], [h, "الساعات"], [m, "الدقائق"], [s, "الثواني"]].map(([n, l]) => `<div><b>${String(n).padStart(2, "0")}</b><small>${l}</small></div>`).join("");
  }
  db.ref("ccBoard").on("value", (s) => { v = s.val() || {}; render(); }, () => { root.innerHTML = '<div class="empty">تعذّر التحميل</div>'; });
})();
