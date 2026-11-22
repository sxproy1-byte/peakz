// السلوت كول (أدمن): تشغيل/إيقاف، كول واحد أو متعدد لكل شخص، قائمة الكولات
(function () {
  const { db, esc } = App;
  App.shell("giveaways");
  const root = document.getElementById("root");
  const $ = (id) => document.getElementById(id);
  let cfg = {}, list = {}, started = false;

  App.onUser((u) => {
    if (!u) {
      root.innerHTML = `<div class="empty"><div>سجّل دخولك بحساب الأدمن على كيك للوصول للوحة التحكم</div><div class="center"><button class="btn primary" id="l">تسجيل الدخول بكيك</button></div></div>`;
      $("l").onclick = () => App.login("admin-slots.html");
    } else if (!u.admin) {
      root.innerHTML = `<div class="empty"><div>حسابك (${esc(u.name)}) مو أدمن</div></div>`;
    } else start();
  });

  const sorted = () => Object.entries(list).filter(([, c]) => c && c.game).map(([id, c]) => ({ id, ...c })).sort((a, b) => (a.at || 0) - (b.at || 0));
  const setCfg = (o) => db.ref("slotcalls/config").update(o).catch(() => App.toast("فشل الحفظ — تأكد من قواعد Firebase"));

  function start() {
    if (started) return; started = true;
    root.innerHTML = `
      <h1 class="plain">لوحة التحكم</h1><div class="atabs"><a href="admin.html">🎟️ المسابقات</a><a href="admin-bonus.html">🎯 البونص هانت</a><a href="admin-tournaments.html">⚔️ البطولات</a><a href="admin-slots.html" class="on">🎰 السلوت كول</a><a href="admin-database.html">🗄️ قاعدة البيانات</a></div>
      ${App.overlayPanel("overlay-slots.html", "السلوت كول", "بـ OBS: Sources ← Browser ← الصق الرابط. الحجم 440×320 (أو أي حجم بنفس النسبة). بيعرض اللعبة الحالية وقائمة الكولات.")}
      <div class="panel"><h2>🎰 الإعدادات</h2>
        <div class="arow" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div class="ainfo"><b>السلوت كول</b> <span style="color:var(--muted)" id="onTxt"></span></div><div class="row"><button class="btn small" id="onBtn"></button></div></div>
        <div class="arow" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div class="ainfo"><b>كولات متعددة لكل شخص</b> <span style="color:var(--muted)" id="mTxt"></span></div><div class="row"><button class="btn small" id="mBtn"></button></div></div>
        <div class="arow" id="maxRow" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div class="ainfo"><b>الحد الأقصى لكل شخص</b> <span style="color:var(--muted)">عدد الكولات اللي بيقدر يحطها بنفس الوقت</span></div><div class="row"><div class="field" style="margin:0;width:90px"><input id="maxN" type="number" min="1" max="20"></div><button class="btn ghost small" id="maxSave">حفظ</button></div></div>
        <div class="hint">أمر الشات: <bdi dir="ltr"><b>!sr</b></bdi> متبوعاً باسم اللعبة — البوت بيرد عليه بتأكيد الحفظ. لما تقفل السلوت كول البوت بيقول إنه مقفول.</div>
      </div>
      <div class="panel"><h2>➕ إضافة كول يدوياً</h2><div class="form">
        <div class="field"><label>اسم المشاهد</label><input id="mUser" maxlength="30" autocomplete="off"></div>
        <div class="field"><label>اللعبة</label><input id="mGame" maxlength="60" autocomplete="off"></div>
        <button class="btn primary" id="mAdd">إضافة</button></div></div>
      <div class="panel"><h2>📋 الكولات <span id="cnt" style="color:var(--muted);font-weight:400"></span></h2><div id="lst"></div>
        <div class="row" style="margin-top:12px"><button class="btn ghost small" id="clrDone">مسح المنتهية</button><button class="btn danger small" id="clrAll">مسح الكل</button></div></div>`;
    $("onBtn").onclick = () => setCfg({ on: cfg.on !== true });
    $("mBtn").onclick = () => setCfg({ multi: cfg.multi !== true });
    $("maxSave").onclick = () => { const n = Math.max(1, Math.min(20, parseInt($("maxN").value, 10) || 3)); setCfg({ max: n }).then(() => App.toast("تم الحفظ ✓")); };
    $("mAdd").onclick = async () => {
      const user = $("mUser").value.trim(), game = $("mGame").value.trim();
      if (!user || !game) return App.toast("اكتب الاسم واللعبة");
      await db.ref("slotcalls/list").push({ uid: "manual", user, game, at: Date.now(), status: "pending", source: "admin" });
      $("mUser").value = ""; $("mGame").value = ""; App.toast("تمت الإضافة ✓");
    };
    $("clrDone").onclick = async () => { const up = {}; sorted().filter((c) => c.status === "done").forEach((c) => (up[c.id] = null)); if (!Object.keys(up).length) return; await db.ref("slotcalls/list").update(up); App.toast("تم المسح"); };
    $("clrAll").onclick = async () => { if (!confirm("مسح كل الكولات؟")) return; await db.ref("slotcalls/list").remove(); App.toast("تم المسح"); };
    db.ref("slotcalls/config").on("value", (s) => { cfg = s.val() || {}; renderCfg(); });
    db.ref("slotcalls/list").on("value", (s) => { list = s.val() || {}; renderList(); });
  }

  function renderCfg() {
    const on = cfg.on === true, multi = cfg.multi === true;
    $("onTxt").innerHTML = on ? "— شغّال، المشاهدين بيقدروا يكتبوا <bdi dir=\"ltr\">!sr</bdi>" : "— مقفول";
    $("onBtn").textContent = on ? "⏹ إيقاف" : "▶ تشغيل"; $("onBtn").className = "btn small " + (on ? "danger" : "primary");
    $("mTxt").textContent = multi ? "— شغّال" : "— مطفي: كول واحد لكل شخص";
    $("mBtn").textContent = multi ? "إيقاف المتعدد" : "تشغيل المتعدد"; $("mBtn").className = "btn small " + (multi ? "danger" : "primary");
    $("maxRow").style.display = multi ? "" : "none";
    if (document.activeElement !== $("maxN")) $("maxN").value = cfg.max || 3;
  }

  function renderList() {
    const all = sorted(), act = all.filter((c) => c.status !== "done"), done = all.filter((c) => c.status === "done");
    $("cnt").textContent = `(${act.length} بالانتظار${done.length ? " · " + done.length + " منتهي" : ""})`;
    const row = (c, i) => `<div class="arow" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div class="ainfo"><span style="color:var(--muted)">${c.status === "done" ? "✓" : i + 1}</span> <b>${esc(c.game)}</b> <span style="color:var(--muted)">— ${esc(c.user)}</span>${c.status === "playing" ? ' <span class="chip">🎮 الآن</span>' : ""}</div>
      <div class="row">${c.status === "done" ? "" : (c.status === "playing" ? "" : `<button class="btn primary small" data-play="${c.id}">▶ الآن</button>`) + `<button class="btn ghost small" data-done="${c.id}">✓ خلص</button>`}<button class="btn danger small" data-del="${c.id}">حذف</button></div></div>`;
    $("lst").innerHTML = all.length ? [...act.filter((c) => c.status === "playing"), ...act.filter((c) => c.status !== "playing"), ...done].map((c, i) => row(c, i)).join("") : '<div class="empty" style="padding:14px">ما في كولات لسا.</div>';
    $("lst").querySelectorAll("[data-play]").forEach((b) => (b.onclick = async () => {
      const up = {}; sorted().forEach((c) => { if (c.status === "playing") up[c.id + "/status"] = "pending"; }); up[b.dataset.play + "/status"] = "playing";
      await db.ref("slotcalls/list").update(up);
    }));
    $("lst").querySelectorAll("[data-done]").forEach((b) => (b.onclick = () => db.ref("slotcalls/list/" + b.dataset.done + "/status").set("done")));
    $("lst").querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => db.ref("slotcalls/list/" + b.dataset.del).remove()));
  }
})();
