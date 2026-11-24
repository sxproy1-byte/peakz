// أوفرلاي OBS للسلوت كول (440×320): اللعبة الحالية + قائمة الكولات
// الرابط:  .../overlay-slots.html
(function () {
  const C = window.CONFIG;
  firebase.initializeApp(C.firebase);
  const db = firebase.database();
  const card = document.getElementById("card");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let cfg = {}, list = {};
  function render() {
    const all = Object.entries(list).filter(([, c]) => c && c.game && c.status !== "done").map(([id, c]) => ({ id, ...c })).sort((a, b) => (a.at || 0) - (b.at || 0));
    const cur = all.find((c) => c.status === "playing"), q = all.filter((c) => c !== cur);
    const on = cfg.on === true, MAX = cur ? 5 : 6;
    const rows = q.slice(0, MAX).map((c, i) => `<div class="row"><span class="n">${i + 1}</span><span class="s">${esc(c.game)}</span><span class="bt">${esc(c.user)}</span></div>`).join("");
    card.innerHTML = `
      <div class="top"><img src="img/favicon.png" alt=""><span class="tag"><span class="dot ${on ? "" : "wait"}"></span>${on ? "السلوت كول مفتوح" : "السلوت كول مقفول"}</span><span class="tag sp">${all.length}</span></div>
      ${cur ? `<div class="now"><small>يلعب الآن</small><b>${esc(cur.game)}</b><em>${esc(cur.user)}</em></div>` : ""}
      ${rows ? `<div class="lst">${rows}</div>${q.length > MAX ? `<div class="kw">+${q.length - MAX} كولات ثانية</div>` : ""}`
        : (cur ? "" : `<div class="none"><b>${on ? "ما في كولات لسا" : "السلوت كول مقفول"}</b><small>${on ? 'اكتب بالشات: <span dir="ltr" style="unicode-bidi:isolate">!sr</span> اسم اللعبة' : "ارجع بعد شوي"}</small></div>`)}
      ${on && (rows || cur) ? `<div class="kw">بالشات اكتب <span dir="ltr" style="unicode-bidi:isolate;direction:ltr">!sr</span> واسم اللعبة</div>` : ""}`;
  }
  db.ref("slotcalls/config").on("value", (s) => { cfg = s.val() || {}; render(); });
  db.ref("slotcalls/list").on("value", (s) => { list = s.val() || {}; render(); });
  render();
})();
