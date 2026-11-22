// لوحة تحكم المسابقات: إنشاء، متابعة، سحب
(function () {
  const { db, esc, C } = App;
  App.shell("giveaways");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("root");

  let all = {};
  const entries = {};      // gid -> {uid: entry}
  const entryRefs = {};

  const isOpen = (g) => g.status === "open" && g.endsAt > App.now();

  App.onUser((u) => {
    if (!u) {
      root.innerHTML = `<div class="empty"><div>سجّل دخولك بحساب الأدمن على كيك للوصول للوحة التحكم</div><div class="center"><button class="btn primary" id="l">تسجيل الدخول بكيك</button></div></div>`;
      document.getElementById("l").onclick = () => App.login("admin.html");
    } else if (!u.admin) {
      root.innerHTML = `<div class="empty"><div>حسابك (${esc(u.name)}) مو أدمن</div></div>`;
    } else start();
  });


  let started = false;
  function start() {
    if (started) return;
    started = true;
    root.innerHTML = `
      <h1 class="plain">لوحة التحكم</h1><div class="atabs"><a href="admin.html" class="on">🎟️ المسابقات</a><a href="admin-bonus.html">🎯 البونص هانت</a><a href="admin-tournaments.html">⚔️ البطولات</a><a href="admin-slots.html">🎰 السلوت كول</a><a href="admin-database.html">🗄️ قاعدة البيانات</a></div>

      ${App.overlayPanel("overlay.html", "المسابقات", "بـ OBS: Sources ← Browser ← الصق الرابط. الحجم 440×320 (أو أي حجم بنفس النسبة، بيتكيّف تلقائياً). بيعرض المسابقة الجارية (الاسم، الجائزة، الفائزين، الوقت، المشاركين) أو \"لا يوجد مسابقات نشطة\".")}
      <div class="panel"><h2>🎁 مسابقة جديدة</h2>
        <div class="form">
          <div class="field"><label>العنوان</label><input id="fTitle" placeholder="سحب البث"></div>
          <div class="field"><label>الجائزة</label><input id="fPrize" placeholder="$50"></div>
          <div class="field"><label>الكلمة بالشات</label><input id="fKey" value="${esc(C.defaultKeyword)}"></div>
          <div class="field"><label>مدة الدخول (دقائق)</label><input id="fMin" type="number" min="1" value="10"></div>
          <div class="field"><label>عدد الفائزين</label><input id="fWin" type="number" min="1" value="1"></div>
          <div class="field"><label>&nbsp;</label><button class="btn primary" id="fCreate" style="width:100%">ابدأ المسابقة</button></div>
        </div>
      </div>

      <div class="panel"><h2>🟢 المسابقات الجارية / بانتظار السحب</h2><div class="alist" id="active"></div></div>
      <div class="panel"><h2>📜 المنتهية</h2><div class="alist" id="done"></div></div>`;

    document.getElementById("fCreate").onclick = create;

    db.ref("giveaways").orderByChild("createdAt").limitToLast(60).on("value", (s) => {
      all = s.val() || {};
      Object.keys(all).forEach((gid) => {
        if (entryRefs[gid]) return;
        entryRefs[gid] = db.ref("entries/" + gid);
        entryRefs[gid].on("value", (es) => { entries[gid] = es.val() || {}; renderLists(); });
      });
      renderLists();
    });
    setInterval(renderLists, 1000);
  }

  async function create() {
    const title = val("fTitle").trim() || "سحب البث";
    const min = Math.max(1, Number(val("fMin")) || 10);
    const g = {
      title, prize: val("fPrize").trim(),
      keyword: (val("fKey").trim() || C.defaultKeyword).toLowerCase(),
      winnersCount: Math.max(1, Number(val("fWin")) || 1),
      status: "open", createdAt: SV.TIMESTAMP,
      endsAt: App.now() + min * 60000,
    };
    try { await db.ref("giveaways").push(g); App.toast("انطلقت المسابقة 🎉"); }
    catch (e) { console.error(e); App.toast("فشل الإنشاء — تأكد من قواعد Firebase وصلاحية الأدمن"); }
  }
  const val = (id) => document.getElementById(id).value;

  function renderLists() {
    const a = document.getElementById("active"), d = document.getElementById("done");
    if (!a) return;
    const ids = Object.keys(all).sort((x, y) => all[y].createdAt - all[x].createdAt);
    const act = ids.filter((id) => all[id].status === "open");
    const fin = ids.filter((id) => all[id].status !== "open");
    a.innerHTML = act.length ? act.map((id) => {
      const g = all[id], n = Object.keys(entries[id] || {}).length, open = isOpen(g);
      const left = Math.max(0, Math.floor((g.endsAt - App.now()) / 1000));
      const t = open ? `⏱ ${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}` : "انتهى الوقت";
      return `<div class="aitem"><div class="info"><b>${esc(g.title)}</b><small>${esc(g.prize || "")} · كلمة: ${esc(g.keyword)} · ${t} · ${n} مشارك · ${g.winnersCount} فائز</small></div>
        ${open ? `<button class="btn ghost small" data-add="${id}">+5 دقائق</button><button class="btn ghost small" data-end="${id}">إنهاء الدخول الآن</button>` : ""}
        <button class="btn ghost small" data-man="${id}">➕ مشارك</button>
        <button class="btn primary small" data-draw="${id}" ${open ? "disabled title='أنهِ الدخول أولاً'" : ""}>🎲 سحب</button>
        <button class="btn danger small" data-del="${id}">حذف</button></div>`;
    }).join("") : `<div class="msg">ما في مسابقات جارية.</div>`;
    d.innerHTML = fin.length ? fin.map((id) => {
      const g = all[id], w = g.winners ? Object.values(g.winners).map((x) => x.name).join("، ") : "—";
      return `<div class="aitem"><div class="info"><b>${esc(g.title)}</b><small>${esc(g.prize || "")} · ${g.entriesCount ?? 0} مشارك · الفائزون: ${esc(w)}</small></div>
        <button class="btn danger small" data-del="${id}">حذف</button></div>`;
    }).join("") : `<div class="msg">لسا ما في مسابقات منتهية.</div>`;

    root.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => db.ref("giveaways/" + b.dataset.add + "/endsAt").set(all[b.dataset.add].endsAt + 300000)));
    root.querySelectorAll("[data-end]").forEach((b) => (b.onclick = () => db.ref("giveaways/" + b.dataset.end + "/endsAt").set(App.now())));
    root.querySelectorAll("[data-man]").forEach((b) => (b.onclick = () => App.addManualEntry(b.dataset.man).catch(() => App.toast("فشل — تأكد من الصلاحيات"))));
    root.querySelectorAll("[data-draw]").forEach((b) => (b.onclick = () => openDraw(b.dataset.draw)));
    root.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("متأكد من الحذف؟")) return;
      try {
        await db.ref("giveaways/" + b.dataset.del).remove();
        await db.ref("entries/" + b.dataset.del).remove();
        App.toast("تم الحذف");
      } catch (e) { console.error(e); App.toast("فشل الحذف — حدّث قواعد Firebase (الخطوة المشروحة)"); }
    }));
  }

  // ---------------- السحب ----------------
  const $ = (id) => document.getElementById(id);

  let dGid = null, winners = [], spinning = false;

  function openDraw(gid) {
    dGid = gid; const g = all[gid];
    winners = g.winners ? Object.entries(g.winners).map(([uid, w]) => ({ uid, name: w.name })) : [];
    $("dTitle").textContent = g.title;
    $("dPrize").textContent = g.prize ? "الجائزة: " + g.prize : "";
    $("dInfo").textContent = `${Object.keys(entries[gid] || {}).length} مشارك · ${g.winnersCount} فائز`;
    $("track").innerHTML = ""; $("case").classList.remove("done", "spinning");
    $("reveal").classList.remove("show"); $("reveal").textContent = "";
    renderWinners();
    $("dStart").style.display = winners.length >= g.winnersCount ? "none" : "";
    $("dMore").style.display = winners.length ? "" : "none";
    $("draw").classList.add("show");
  }
  $("drawClose").onclick = () => $("draw").classList.remove("show");
  $("dStart").onclick = () => runDraw(all[dGid].winnersCount - winners.length);
  $("dMore").onclick = () => runDraw(1);

  function renderWinners() {
    $("wlist").innerHTML = winners.map((w, i) => `<div>🏆 الفائز ${i + 1}: <span>${esc(w.name)}</span></div>`).join("");
  }

  let muted = false;
  $("dSound").onclick = () => { muted = !muted; Reel.setMuted(muted); $("dSound").textContent = muted ? "🔇 صامت" : "🔊 الصوت"; };

  async function runDraw(count) {
    if (spinning) return;
    const g = all[dGid];
    if (!g || isOpen(g)) return App.toast("أنهِ الدخول أولاً");      // ما بنسحب والدخول لسا مفتوح
    const live = Object.entries(entries[dGid] || {}).map(([uid, e]) => ({ uid, name: e.name }));
    const names = live.map((p) => p.name);
    let pool = live.filter((p) => !winners.some((w) => w.uid === p.uid));
    if (!pool.length) return App.toast("ما في مشاركين متبقين للسحب");
    spinning = true; $("dStart").disabled = $("dMore").disabled = true;
    count = Math.min(count, pool.length);
    for (let i = 0; i < count; i++) {
      // الاختيار قبل الأنيميشن (Fair.pickWinners)، والشريط بس يعرضه. المشاركين كلهم موثّقين أصلاً لأن الدخول مقفول على غير الموثّقين.
      const pick = Fair.pickWinners(pool, 1)[0];
      pool = pool.filter((p) => p.uid !== pick.uid);
      $("reveal").classList.remove("show");
      await Reel.spin($("case"), $("track"), names, pick.name);
      $("reveal").textContent = "🏆 " + pick.name; $("reveal").classList.add("show");
      winners.push(pick); renderWinners();
      const obj = {}; winners.forEach((w) => (obj[w.uid] = { name: w.name }));   // نحفظ كل فائز فور طلوعه
      db.ref("giveaways/" + dGid).update({ winners: obj, status: "drawn", drawnAt: SV.TIMESTAMP, entriesCount: live.length }).catch(() => App.toast("تعذّر حفظ الفائز — تحقق من الاتصال"));
      await new Promise((r) => setTimeout(r, 2800));
    }
    spinning = false; $("dStart").disabled = $("dMore").disabled = false;
    $("dStart").style.display = "none"; $("dMore").style.display = "";
    App.toast("تم حفظ الفائزين ✓");
  }
})();
