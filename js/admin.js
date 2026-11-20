// لوحة تحكم الأدمن: إنشاء المسابقات، استقبال الدخول من شات كيك، السحب
(function () {
  const { db, esc, C } = App;
  App.shell("giveaways");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("root");

  let all = {};
  const entries = {};      // gid -> {uid: entry}
  const entryRefs = {};
  let hook = null, lastChatAt = 0;   // حالة ربط الشات (Webhook)

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
      <h1 class="plain">لوحة التحكم</h1>

      <div class="panel"><h2>🔌 ربط شات كيك</h2>
        <p class="hint" style="text-align:start;margin-bottom:12px;font-size:14px"><span class="dot" id="dot"></span> <span id="chatState">جاري الفحص...</span></p>
        <div class="row"><button class="btn primary" id="crConnect">ربط الشات (للستريمر)</button></div>
        <p class="hint" style="margin-top:10px;text-align:start">الستريمر يضغط الزر مرة وحدة بحسابه على كيك ويسمح للتطبيق. بعدها كلمة الشات بتنحسب تلقائياً 24/7 بدون ما تفتحوا هذي الصفحة.</p>
      </div>

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
    document.getElementById("crConnect").onclick = () => { location.href = C.workerUrl + "/connect?r=admin.html"; };
    db.ref("config/webhook").on("value", (x) => { hook = x.val(); renderChat(); });
    db.ref("config/lastChatAt").on("value", (x) => { lastChatAt = x.val() || 0; renderChat(); });
    setInterval(renderChat, 10000);

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
    root.querySelectorAll("[data-draw]").forEach((b) => (b.onclick = () => openDraw(b.dataset.draw)));
    root.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("متأكد من الحذف؟")) return;
      await db.ref("entries/" + b.dataset.del).remove(); await db.ref("giveaways/" + b.dataset.del).remove();
    }));
  }

  // ---------------- حالة ربط الشات ----------------
  function ago(ms) {
    const t = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (t < 60) return "ثواني";
    if (t < 3600) return Math.floor(t / 60) + " دقيقة";
    if (t < 86400) return Math.floor(t / 3600) + " ساعة";
    return Math.floor(t / 86400) + " يوم";
  }
  function renderChat() {
    const dot = document.getElementById("dot"), st = document.getElementById("chatState");
    if (!dot || !st) return;
    const ok = !!(hook && hook.ok);
    dot.classList.toggle("on", ok);
    st.textContent = !hook ? "غير مربوط — الستريمر لازم يضغط زر الربط"
      : !hook.ok ? "آخر محاولة ربط فشلت — جرّب الزر من جديد"
      : "مربوط ✓ (بواسطة " + hook.by + ")" + (lastChatAt ? " — آخر رسالة شات وصلت قبل " + ago(lastChatAt) : " — لسا ما وصلت أي رسالة");
  }

  // ---------------- السحب ----------------
  const $ = (id) => document.getElementById(id);
  let dGid = null, winners = [], spinning = false;

  function secureInt(n) {            // رقم عشوائي منتظم بدون انحياز
    const lim = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  }

  function openDraw(gid) {
    dGid = gid; const g = all[gid];
    winners = g.winners ? Object.entries(g.winners).map(([uid, w]) => ({ uid, name: w.name })) : [];
    $("dTitle").textContent = g.title;
    $("dPrize").textContent = g.prize ? "الجائزة: " + g.prize : "";
    $("dInfo").textContent = `${Object.keys(entries[gid] || {}).length} مشارك · ${g.winnersCount} فائز`;
    $("reel").textContent = "—"; $("reel").classList.remove("win");
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

  async function runDraw(count) {
    if (spinning) return;
    const pool = Object.entries(entries[dGid] || {}).map(([uid, e]) => ({ uid, name: e.name }))
      .filter((p) => !winners.some((w) => w.uid === p.uid));
    if (!pool.length) return App.toast("ما في مشاركين متبقين للسحب");
    spinning = true; $("dStart").disabled = $("dMore").disabled = true;
    count = Math.min(count, pool.length);
    for (let i = 0; i < count; i++) {
      const pick = pool.splice(secureInt(pool.length), 1)[0];
      const names = [pick, ...pool].map((p) => p.name);
      $("reel").classList.remove("win");
      const t0 = Date.now(), dur = 4500;
      await new Promise((res) => {
        (function tick() {
          const k = (Date.now() - t0) / dur;
          if (k >= 1) return res();
          $("reel").textContent = names[secureInt(names.length)];
          setTimeout(tick, 50 + k * k * 350);
        })();
      });
      $("reel").textContent = pick.name; $("reel").classList.add("win");
      winners.push(pick); renderWinners();
      await new Promise((r) => setTimeout(r, 1500));
    }
    const obj = {}; winners.forEach((w) => (obj[w.uid] = { name: w.name }));
    await db.ref("giveaways/" + dGid).update({ winners: obj, status: "drawn", drawnAt: SV.TIMESTAMP, entriesCount: Object.keys(entries[dGid] || {}).length });
    spinning = false; $("dStart").disabled = $("dMore").disabled = false;
    $("dStart").style.display = "none"; $("dMore").style.display = "";
    App.toast("تم حفظ الفائزين ✓");
  }
})();
