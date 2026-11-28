// الصفحة الرئيسية: حالة البث + بطاقة ليدر بورد CrownCases الصغيرة + روابط التواصل
(function () {
  const { db, C, esc } = App;
  App.shell("home");
  const $ = (id) => document.getElementById(id);
  const url = "https://kick.com/" + C.streamerSlug;
  $("hSt").href = url; $("hKick").href = url;
  if (C.discordInvite) $("hDiscord").href = C.discordInvite; else $("hDiscord").hidden = true;

  async function poll() {
    let d = null;
    try { const r = await fetch(C.workerUrl + "/channel"); if (r.ok) d = await r.json(); } catch (e) {}
    const live = !!(d && d.live), st = $("hSt");
    st.className = "st" + (live ? " live" : "");
    st.lastElementChild.textContent = !d ? "حالة البث غير متاحة" : live ? "مباشر الآن" : "أوفلاين";
  }
  poll(); setInterval(poll, 60000);

  // بطاقة الليدر بورد (نفس بيانات صفحة الليدر بورد: ccBoard)
  const DAY = 86400000, WEEK = 7 * DAY, JO = 3 * 3600000;
  const money = (x) => { x = String(x || "").trim(); if (!x) return ""; const n = Number(x.replace(/[$,\s]/g, "")); return isFinite(n) && /\d/.test(x) ? "$" + n.toLocaleString("en", { maximumFractionDigits: 2 }) : x; };
  const defaultEnd = () => { const sh = new Date(Date.now() + JO), mid = Date.UTC(sh.getUTCFullYear(), sh.getUTCMonth(), sh.getUTCDate()); let k = (5 - sh.getUTCDay() + 7) % 7; if (k === 0) k = 7; return mid + k * DAY - JO; };
  const target = (v) => { let t = Number(v.endsAt) || 0; if (!t) return defaultEnd(); if (Date.now() > t && v.weekly !== false) t += Math.ceil((Date.now() - t) / WEEK) * WEEK; return t; };
  const pad = (n) => String(n).padStart(2, "0");
  let v = {}, timer = null;
  function tick() {
    const el = $("hlbCd"); if (!el) return;
    const ms = target(v) - Date.now();
    if (ms <= 0) { el.innerHTML = ""; return; }
    el.innerHTML = [[Math.floor(ms / DAY), "d"], [Math.floor(ms / 3600000) % 24, "h"], [Math.floor(ms / 60000) % 60, "m"], [Math.floor(ms / 1000) % 60, "s"]].map(([n, u]) => `<span><b>${pad(n)}</b>${u}</span>`).join("");
  }
  function render() {
    const rows = v.rows || {}, top = [1, 2, 3].map((i) => rows[i] || {});
    $("hlb").innerHTML = `<div class="hlb-h"><b>ليدر بورد CrownCases</b><span class="hlb-chip" dir="ltr">$100</span></div>
      <div class="hlb-cd" dir="ltr" id="hlbCd"></div>
      ${top.map((r, i) => `<div class="hlb-r"><span class="hlb-n ${i ? "" : "g"}">${i + 1}</span><span class="nm">${r.name ? esc(r.name) : "—"}</span>${r.wager ? `<b dir="ltr">${esc(money(r.wager))}</b>` : ""}</div>`).join("")}
      <a class="btn ghost" href="leaderboard.html">الليدر بورد كامل</a>`;
    tick(); clearInterval(timer); timer = setInterval(tick, 1000);
  }
  render();
  db.ref("ccBoard").on("value", (s) => { v = s.val() || {}; render(); }, () => {});
})();
