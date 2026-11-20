// لوحة تحكم الأدمن: إنشاء المسابقات، استقبال الدخول من شات كيك، السحب
(function () {
  const { db, esc, C } = App;
  App.shell("giveaways");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("root");

  let all = {};
  const entries = {};      // gid -> {uid: entry}
  const entryRefs = {};
  let users = {}, profiles = {}, verifiedMap = {}; const shown = new Set();
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
      <div class="panel"><h2>📜 المنتهية</h2><div class="alist" id="done"></div></div>

      <div class="panel"><h2>👥 المستخدمين <small id="uCount" style="color:var(--muted);font-weight:400;font-size:13px"></small></h2>
        <div class="row" style="margin-bottom:12px"><input id="uSearch" placeholder="ابحث بالاسم / ستيك / ديسكورد..." style="flex:1;min-width:180px;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:rgba(5,7,15,.5)">
          <button class="btn ghost small" id="uCsv">⬇️ تصدير CSV</button></div>
        <div class="utable-wrap"><table class="utable"><thead><tr><th>كيك</th><th>الحالة</th><th>ديسكورد</th><th>ستيك</th><th>USDT (BSC)</th></tr></thead><tbody id="uBody"></tbody></table></div>
        <p class="hint" style="text-align:start;margin-top:10px">العناوين مخفية افتراضياً عشان ما تظهر لو كنت عامل مشاركة شاشة بالبث.</p>
      </div>`;

    document.getElementById("fCreate").onclick = create;
    document.getElementById("uSearch").oninput = renderUsers;
    document.getElementById("uCsv").onclick = exportCsv;
    db.ref("users").on("value", (x) => { users = x.val() || {}; renderUsers(); });
    db.ref("profiles").on("value", (x) => { profiles = x.val() || {}; renderUsers(); });
    db.ref("verified").on("value", (x) => { verifiedMap = x.val() || {}; renderUsers(); });
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
      try {
        await db.ref("giveaways/" + b.dataset.del).remove();
        await db.ref("entries/" + b.dataset.del).remove();
        App.toast("تم الحذف");
      } catch (e) { console.error(e); App.toast("فشل الحذف — حدّث قواعد Firebase (الخطوة المشروحة)"); }
    }));
  }

  // ---------------- المستخدمين ----------------
  const mask = (w) => (w ? w.slice(0, 6) + "…" + w.slice(-4) : "—");
  function rows() {
    return Object.keys(users).map((uid) => {
      const u = users[uid] || {}, p = profiles[uid] || {}, v = verifiedMap[uid] || {}, d = p.discord || {};
      return { uid, kick: u.name || uid, discord: d.name || "", stake: p.stake || "", wallet: p.wallet || "", ok: v.ok === true, status: v.status || (d.id ? "" : "none"), last: u.lastLogin || 0 };
    }).sort((a, b) => Number(b.ok) - Number(a.ok) || b.last - a.last);
  }
  function renderUsers() {
    const body = document.getElementById("uBody"); if (!body) return;
    const q = (document.getElementById("uSearch").value || "").trim().toLowerCase();
    const all = rows(), list = all.filter((r) => !q || [r.kick, r.discord, r.stake].some((x) => String(x).toLowerCase().includes(q)));
    document.getElementById("uCount").textContent = `(${all.length} مسجّل · ${all.filter((r) => r.ok).length} موثّق)`;
    const tag = (r) => r.ok ? '<span class="vt ok">موثّق</span>' : r.status === "norole" ? '<span class="vt bad">بدون رول</span>' : r.status === "nomember" ? '<span class="vt bad">مو بالسيرفر</span>' : '<span class="vt">غير مربوط</span>';
    body.innerHTML = list.length ? list.map((r) => `<tr>
      <td>${esc(r.kick)}</td><td>${tag(r)}</td><td>${esc(r.discord) || "—"}</td><td dir="ltr">${esc(r.stake) || "—"}</td>
      <td dir="ltr">${r.wallet ? `<span class="wal">${shown.has(r.uid) ? esc(r.wallet) : mask(r.wallet)}</span>
        <button class="btn ghost small" data-eye="${r.uid}">${shown.has(r.uid) ? "إخفاء" : "إظهار"}</button><button class="btn ghost small" data-copy="${esc(r.wallet)}">نسخ</button>` : "—"}</td></tr>`).join("")
      : `<tr><td colspan="5" class="msg">لا يوجد نتائج</td></tr>`;
    body.querySelectorAll("[data-eye]").forEach((b) => (b.onclick = () => { const k = b.dataset.eye; shown.has(k) ? shown.delete(k) : shown.add(k); renderUsers(); }));
    body.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => App.toast("تم النسخ ✓"), () => App.toast("تعذّر النسخ"))));
  }
  function exportCsv() {
    const cell = (v) => { v = String(v ?? ""); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    const out = [["Kick", "Verified", "Discord", "Stake", "USDT_BSC"].map(cell).join(",")]
      .concat(rows().map((r) => [r.kick, r.ok ? "yes" : "no", r.discord, r.stake, r.wallet].map(cell).join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + out.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "peakz-users.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  async function adminApi(path) {
    const t = await firebase.auth().currentUser.getIdToken();
    const r = await fetch(C.workerUrl + path, { headers: { Authorization: "Bearer " + t } });
    return r.json();
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
      // الاختيار قبل الأنيميشن، وبنتأكد إن الفائز لسا عنده رول التوثيق (وإلا بنستبعده وبنسحب غيره)
      let pick = null;
      while (pool.length && !pick) {
        const c = Fair.pickWinners(pool, 1)[0];
        pool = pool.filter((p) => p.uid !== c.uid);
        let st;
        try { st = (await adminApi("/discord/check?uid=" + encodeURIComponent(c.uid))).status; } catch (e) { st = "error"; }
        if (st === "ok") pick = c;
        else if (st === "error") { spinning = false; $("dStart").disabled = $("dMore").disabled = false; return App.toast("تعذّر التحقق من توثيق " + c.name + " — جرّب مرة ثانية"); }
        else App.toast("تم استبعاد " + c.name + " (ما عنده رول التوثيق) وسحب غيره");
      }
      if (!pick) { App.toast("ما في مشاركين موثّقين متبقين"); break; }
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
