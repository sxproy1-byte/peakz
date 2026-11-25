// قاعدة البيانات: المستخدمين والتوثيق، الحماية (Alts)، ربط الشات، أوامر البوت
(function () {
  const { db, esc, C } = App;
  App.shell("giveaways");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("root");
  const $ = (id) => document.getElementById(id);

  let users = {}, profiles = {}, verifiedMap = {}; const shown = new Set();
  let blocked = {}, cleared = {}, guardCfg = {}, bans = {}, vpn = {};
  let cmds = {}, botLast = null, timers = {};
  let hook = null, lastChatAt = 0;   // حالة ربط الشات (Webhook)

  App.onUser((u) => {
    if (!u) {
      root.innerHTML = `<div class="empty"><div>سجّل دخولك بحساب الأدمن على كيك للوصول للوحة التحكم</div><div class="center"><button class="btn primary" id="l">تسجيل الدخول بكيك</button></div></div>`;
      document.getElementById("l").onclick = () => App.login("admin-database.html");
    } else if (!u.admin) {
      root.innerHTML = `<div class="empty"><div>حسابك (${esc(u.name)}) مو أدمن</div></div>`;
    } else start();
  });

  /* ---------- أوامر البوت المخصصة ---------- */
  function renderBot() {
    const el = document.getElementById("botState"); if (!el) return;
    if (!botLast) el.innerHTML = "لسا ما صار أي إرسال من البوت.";
    else if (botLast.status === 200) el.innerHTML = `<span class="dot on"></span> آخر رد انرسل بنجاح من <b dir="ltr">${esc(botLast.as || "")}</b>`;
    else el.innerHTML = `<span class="dot"></span> آخر محاولة إرسال فشلت (${esc(botLast.status || "")} ${esc(botLast.error || botLast.resp || "")})`;
  }
  async function saveCmd() {
    const name = document.getElementById("cName").value.trim().replace(/^!/, "").toLowerCase();
    const reply = document.getElementById("cReply").value.trim();
    if (!/^[a-z0-9_\u0600-\u06FF]{1,20}$/.test(name)) return App.toast("اسم الأمر: حروف وأرقام فقط (بدون مسافات)");
    if (name === "g" || name === "mg") return App.toast("هذا الأمر محجوز للبونص هانت");
    if (!reply) return App.toast("اكتب الرد");
    try { await db.ref("commands/" + name).set({ reply, at: SV.TIMESTAMP }); App.toast("تم حفظ !" + name + " ✓"); document.getElementById("cName").value = ""; document.getElementById("cReply").value = ""; }
    catch (e) { App.toast("فشل الحفظ — تأكد من قواعد Firebase"); }
  }
  function renderCmds() {
    const el = document.getElementById("cmdList"); if (!el) return;
    const ks = Object.keys(cmds).sort();
    el.innerHTML = ks.length ? ks.map((k) => `<div class="arow"><div class="ainfo"><b dir="ltr">!${esc(k)}</b> <span style="color:var(--muted)">${esc(cmds[k].reply)}</span></div>
      <div class="row"><button class="btn ghost small" data-cedit="${esc(k)}">تعديل</button><button class="btn danger small" data-cdel="${esc(k)}">حذف</button></div></div>`).join("") : '<div class="empty" style="padding:14px">ما في أوامر لسا.</div>';
    el.querySelectorAll("[data-cedit]").forEach((b) => (b.onclick = () => { document.getElementById("cName").value = b.dataset.cedit; document.getElementById("cReply").value = cmds[b.dataset.cedit].reply; document.getElementById("cReply").focus(); }));
    el.querySelectorAll("[data-cdel]").forEach((b) => (b.onclick = async () => { if (!confirm("متأكد من الحذف؟")) return; await db.ref("commands/" + b.dataset.cdel).remove(); App.toast("تم الحذف"); }));
  }


  /* ---------- رسائل البوت المؤقتة (كل N دقيقة) ---------- */
  async function saveTimer() {
    const text = $("tText").value.trim(), every = Math.max(1, Math.min(720, parseInt($("tEvery").value, 10) || 0));
    if (!text) return App.toast("اكتب نص الرسالة");
    if (!every) return App.toast("اكتب كل كم دقيقة");
    const id = $("tSave").dataset.id || db.ref("timers").push().key;
    try { await db.ref("timers/" + id).update({ text, every, on: true }); App.toast("تم الحفظ ✓"); $("tText").value = ""; $("tSave").dataset.id = ""; $("tSave").textContent = "إضافة رسالة"; }
    catch (e) { App.toast("فشل الحفظ — انشر قواعد Firebase الجديدة"); }
  }
  function renderTimers() {
    const el = $("tList"); if (!el) return;
    const ks = Object.keys(timers);
    el.innerHTML = ks.length ? ks.map((k) => { const t = timers[k]; return `<div class="arow"><div class="ainfo"><b dir="ltr">⏱ ${esc(t.every)}m</b> ${t.on === false ? '<span class="chip">متوقفة</span>' : ""}<div style="color:var(--muted);margin-top:4px">${esc(t.text)}</div></div>
      <div class="row"><button class="btn ghost small" data-tt="${esc(k)}">${t.on === false ? "تشغيل" : "إيقاف"}</button><button class="btn ghost small" data-te="${esc(k)}">تعديل</button><button class="btn danger small" data-td="${esc(k)}">حذف</button></div></div>`; }).join("")
      : '<div class="empty" style="padding:14px"><div>ما في رسائل محفوظة. البوت حالياً بيرسل رابط الديسكورد والموقع بالتناوب كل 10 دقائق.</div><div class="center" style="margin-top:10px"><button class="btn ghost small" id="tDefaults">إضافة الرسالتين الافتراضيتين</button></div></div>';
    const dfl = $("tDefaults");
    if (dfl) dfl.onclick = async () => {
      const site = location.origin + location.pathname.replace(/[^/]*$/, ""), dc = "https://discord.gg/y8bqeNZqy9";
      try { await db.ref("timers").update({ [db.ref("timers").push().key]: { text: "💬 انضموا لسيرفر الديسكورد " + dc, every: 10, on: true }, [db.ref("timers").push().key]: { text: "🌐 موقعنا للمسابقات والبونص هانت والبطولات " + site, every: 10, on: true } }); App.toast("تمت الإضافة ✓"); }
      catch (e) { App.toast("فشل الحفظ — انشر قواعد Firebase الجديدة"); }
    };
    el.querySelectorAll("[data-tt]").forEach((b) => (b.onclick = () => db.ref("timers/" + b.dataset.tt + "/on").set(timers[b.dataset.tt].on === false)));
    el.querySelectorAll("[data-te]").forEach((b) => (b.onclick = () => { const t = timers[b.dataset.te]; $("tText").value = t.text; $("tEvery").value = t.every; $("tSave").dataset.id = b.dataset.te; $("tSave").textContent = "حفظ التعديل"; $("tText").focus(); }));
    el.querySelectorAll("[data-td]").forEach((b) => (b.onclick = async () => { if (!confirm("متأكد من الحذف؟")) return; await db.ref("timers/" + b.dataset.td).remove(); App.toast("تم الحذف"); }));
  }

  /* ---------- الحماية من الحسابات المكررة (Alts) + الحظر ---------- */
  const REASON = { ip: "نفس الـ IP", dev: "نفس الجهاز/المتصفح", fp: "نفس بصمة الجهاز", stake: "نفس يوزر ستيك", wallet: "نفس عنوان المحفظة", discord: "نفس الديسكورد" };
  const isBanned = (uid) => (bans[uid] || {}).active === true;
  const nm = (uid) => (users[uid] || {}).name || uid;
  async function adminPost(path, body) {
    const t = await firebase.auth().currentUser.getIdToken();
    const r = await fetch(C.workerUrl + path, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || r.status); return j;
  }
  function groupOrder() {
    // نرتب الحسابات بمجموعات (union-find) عشان الحسابات المرتبطة تكون ورا بعض بالجدول
    const ids = uniqIds([...Object.keys(blocked), ...Object.keys(bans).filter((k) => isBanned(k))]);
    const parent = {}; const find = (x) => (parent[x] === undefined ? (parent[x] = x) : parent[x] === x ? x : (parent[x] = find(parent[x])));
    ids.forEach((u) => { find(u); Object.values((blocked[u] || {}).reasons || {}).forEach((a) => (a || []).forEach((o) => parent[find(u)] = find(o))); if ((bans[u] || {}).via) parent[find(u)] = find(bans[u].via); });
    const g = {}; Object.keys(parent).forEach((u) => { (g[find(u)] = g[find(u)] || []).push(u); });
    return Object.values(g).sort((a, b) => b.length - a.length);
  }
  const uniqIds = (a) => [...new Set(a)];
  function statusTag(uid) {
    const b = bans[uid] || {};
    if (b.active === true) return '<span class="vt bad">محظور</span>' + (b.by === "auto" ? ' <small style="color:var(--muted)">(تلقائي)</small>' : "");
    if (vpn[uid]) return '<span class="vt bad">VPN</span>';
    if (blocked[uid]) return '<span class="vt bad">موقوف التوثيق</span>';
    if (b.active === false) return '<span class="vt">انرفع الحظر</span>';
    return "—";
  }
  function renderAlts() {
    const el = $("altsList"); if (!el) return;
    const gs = groupOrder();
    $("altsCount").textContent = gs.length ? `(${gs.reduce((n, m) => n + m.length, 0)} حساب)` : "";
    if (!gs.length) { el.innerHTML = '<div class="empty" style="padding:14px">ما في حسابات مكررة مكتشفة 👍</div>'; return; }
    el.innerHTML = `<div class="utable-wrap"><table class="utable"><thead><tr><th>#</th><th>الحساب</th><th>الحالة</th><th>ديسكورد</th><th>ستيك</th><th>مشترك مع</th><th></th></tr></thead><tbody>` +
      gs.map((m, i) => m.map((uid, k) => {
        const p = profiles[uid] || {}, d = p.discord || {}, b = blocked[uid] || {}, ban = bans[uid] || {};
        const links = Object.entries(b.reasons || {}).flatMap(([kind, arr]) => (arr || []).map((o) => `<span class="chip">${esc(nm(o))} <small>${esc(REASON[kind] || kind)}</small></span>`));
        if (ban.via) links.push(`<span class="chip">${esc(nm(ban.via))} <small>سبب الحظر التلقائي</small></span>`);
        return `<tr${k === 0 ? ' class="gstart"' : ""}><td>${k === 0 ? i + 1 : ""}</td><td><b>${esc(nm(uid))}</b></td><td>${statusTag(uid)}</td><td>${esc(d.name) || "—"}</td><td dir="ltr">${esc(p.stake) || "—"}</td>
          <td>${links.join(" ") || "—"}</td>
          <td><div class="row" style="gap:6px;flex-wrap:nowrap">${isBanned(uid) ? `<button class="btn ghost small" data-unban="${esc(uid)}">فك الحظر</button>` : `<button class="btn danger small" data-ban="${esc(uid)}">حظر</button>`}
            ${blocked[uid] || vpn[uid] ? `<button class="btn primary small" data-clr="${esc(uid)}">اعتماد ✓</button>` : ""}</div></td></tr>`;
      }).join("")).join("") + "</tbody></table></div>";
    bindBanBtns(el);
  }
  function bindBanBtns(el) {
    el.querySelectorAll("[data-ban]").forEach((b) => (b.onclick = () => banUser(b.dataset.ban, true)));
    el.querySelectorAll("[data-unban]").forEach((b) => (b.onclick = () => banUser(b.dataset.unban, false)));
    el.querySelectorAll("[data-clr]").forEach((b) => (b.onclick = () => clearAlt([b.dataset.clr])));
  }
  async function banUser(uid, ban) {
    if (ban ? !confirm("حظر " + nm(uid) + "؟ بيقدر يتفرّج بس، وكل حساباته المرتبطة بتنحظر كمان.") : !confirm("فك الحظر عن " + nm(uid) + " بس؟ حساباته الثانية بتضل محظورة، وأي حساب جديد بيسجّله بنفس الجهاز/الـ IP بينحظر.")) return;
    try { const r = await adminPost("/guard/ban", { uid, ban }); App.toast(ban ? "تم الحظر ✓ (" + r.banned + " حساب)" : "تم فك الحظر ✓"); }
    catch (e) { console.error(e); App.toast("فشل — تأكد إن الـ Worker محدّث"); }
  }
  async function clearAlt(uids) {
    if (!confirm("اعتماد هذا الحساب (مو حساب مكرر)؟ رح يرجع توثيقه حسب الديسكورد، وما رح ينفحص تشابهه مرة ثانية.")) return;
    try {
      const up = {};
      uids.forEach((id) => { up["cleared/" + id] = true; up["blocked/" + id] = null; up["vpn/" + id] = null; });
      await db.ref().update(up);
      await Promise.all(uids.map((id) => adminApi("/discord/check?uid=" + encodeURIComponent(id)).catch(() => null)));
      App.toast("تم الاعتماد ✓");
    } catch (e) { console.error(e); App.toast("فشل — تأكد من قواعد Firebase"); }
  }
  function renderGuardCfg() {
    const f = { ip: guardCfg.ip !== false, dev: guardCfg.dev !== false, fp: guardCfg.fp === true, vpn: guardCfg.vpn !== false };
    Object.keys(f).forEach((k) => { const el = $("gc_" + k); if (el) el.checked = f[k]; });
  }
  function saveGuardCfg() {
    db.ref("config/guard").set({ ip: $("gc_ip").checked, dev: $("gc_dev").checked, fp: $("gc_fp").checked, vpn: $("gc_vpn").checked }).then(() => App.toast("تم الحفظ ✓"), () => App.toast("فشل الحفظ"));
  }

  async function clearVpnCache() {
    if (!confirm("بتمسح نتائج فحص الـ VPN المخزّنة وعلامات الـ VPN عن الحسابات. الفحص بيتعاد عند أول دخول. متأكد؟")) return;
    try { const r = await adminPost("/guard/clear-vpn", {}); App.toast("تم المسح ✓ (" + (r.accounts || 0) + " حساب)"); }
    catch (e) { App.toast("فشل المسح — حدّث الـ Worker"); }
  }

  const ACT = { set: "تعديل", update: "تعديل", remove: "حذف", ban: "حظر", unban: "فك حظر", "clear-vpn": "مسح كاش VPN" };
  function renderAudit(rows) {
    const el = $("auBody"); if (!el) return;
    el.innerHTML = rows.length ? rows.map((r) => `<tr><td dir="ltr" style="white-space:nowrap">${new Date(r.at || 0).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td><td>${esc(r.name || r.uid)}</td><td>${esc(ACT[r.act] || r.act)}</td><td dir="ltr">${esc(r.path || "")}</td></tr>`).join("") : '<tr><td colspan="4" class="msg">لا يوجد نتائج</td></tr>';
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    root.innerHTML = `
      <h1 class="plain">لوحة التحكم</h1><div class="atabs"><a href="admin.html">🎟️ المسابقات</a><a href="admin-bonus.html">🎯 البونص هانت</a><a href="admin-tournaments.html">⚔️ البطولات</a><a href="admin-slots.html">🎰 السلوت كول</a><a href="admin-profiles.html">👤 البروفايلات</a><a href="admin-stats.html">📊 الإحصائيات</a><a href="admin-database.html" class="on">🗄️ قاعدة البيانات</a></div>

      <div class="panel"><h2>🕵️ Alts — الحسابات المكررة <small id="altsCount" style="color:var(--muted);font-weight:400;font-size:13px"></small></h2>
        <p class="hint" style="text-align:start;margin-bottom:12px">أي حسابين بنفس يوزر ستيك / عنوان المحفظة / الديسكورد، أو بنفس الـ IP أو نفس الجهاز، بينلغى توثيقهم تلقائياً وبيظهروا بالجدول. <b>حظر</b>: بيقدر يتفرّج بس، وكل حساباته المرتبطة بتنحظر معه. بعد <b>فك الحظر</b> عن حساب، أي حساب جديد بنفس الجهاز/الـ IP بينحظر لحاله. لو الحسابين لأشخاص مختلفين فعلاً (إخوة بنفس البيت مثلاً) اضغط <b>اعتماد</b>.</p>
        <div class="row" style="margin-bottom:12px;gap:18px">
          <label class="row" style="gap:6px"><input type="checkbox" id="gc_ip"> نفس الـ IP</label>
          <label class="row" style="gap:6px"><input type="checkbox" id="gc_dev"> نفس الجهاز/المتصفح</label>
          <label class="row" style="gap:6px"><input type="checkbox" id="gc_vpn"> منع VPN / بروكسي / Tor</label>
          <label class="row" style="gap:6px"><input type="checkbox" id="gc_fp"> بصمة الجهاز (ممكن تغلط مع نفس نوع الجوال)</label>
        </div>
        <div class="row" style="margin-bottom:12px"><button class="btn ghost small" id="vpnClear">🧹 مسح كاش الـ VPN</button></div>
        <div class="alist" id="altsList"></div>
      </div>

      <div class="panel"><h2>🔌 ربط شات كيك والبوت</h2>
        <p class="hint" style="text-align:start;margin-bottom:12px;font-size:14px"><span class="dot" id="dot"></span> <span id="chatState">جاري الفحص...</span></p>
        <div class="row"><button class="btn primary" id="crConnect">ربط الشات (للستريمر)</button></div>
        <p class="hint" style="margin-top:10px;text-align:start">الستريمر يضغط الزر مرة وحدة بحسابه على كيك ويسمح للتطبيق. بعدها كلمة الشات بتنحسب تلقائياً 24/7 بدون ما تفتحوا هذي الصفحة.</p>
      </div>

      <div class="panel"><h2>🤖 أوامر البوت</h2>
        <p class="hint" style="text-align:start;margin-bottom:12px;font-size:14px" id="botState">جاري الفحص...</p>
        <div class="form">
          <div class="field"><label>الأمر (بدون !)</label><input id="cName" dir="ltr" maxlength="20" placeholder="dc" autocomplete="off"></div>
          <div class="field" style="grid-column:span 2"><label>الرد (تقدر تكتب {user} لاسم الشخص)</label><input id="cReply" maxlength="300" placeholder="رابط الديسكورد: https://discord.gg/..."></div>
          <div class="field"><label>&nbsp;</label><button class="btn primary" id="cSave" style="width:100%">حفظ الأمر</button></div>
        </div>
        <div class="alist" id="cmdList" style="margin-top:12px"></div>
        <p class="hint" style="text-align:start;margin-top:10px">الأوامر <b dir="ltr">!g</b> و<b dir="ltr">!mg</b> محجوزة للبونص هانت. كل أمر بيرد مرة كل 10 ثواني بالكثير (عشان ما يتسبّم الشات).</p>
      </div>

      <div class="panel"><h2>⏱️ رسائل البوت المؤقتة</h2>
        <div class="form">
          <div class="field" style="grid-column:span 2"><label>نص الرسالة</label><input id="tText" maxlength="400" placeholder="💬 انضموا للديسكورد: https://discord.gg/..."></div>
          <div class="field"><label>كل كم دقيقة</label><input id="tEvery" type="number" min="1" max="720" value="10" dir="ltr"></div>
          <div class="field"><label>&nbsp;</label><button class="btn primary" id="tSave" style="width:100%">إضافة رسالة</button></div>
        </div>
        <div class="alist" id="tList" style="margin-top:12px"></div>
        <p class="hint" style="text-align:start;margin-top:10px">الرسائل بتنرسل بس لما يكون البث شغّال، وكل رسالة بتتكرر حسب وقتها. البوت بيفحص كل دقيقة، فالدقة بحدود دقيقة.</p>
      </div>

      <div class="panel"><h2>📣 تنبيهات الديسكورد</h2>
        <p class="hint" style="text-align:start;margin-bottom:12px;font-size:14px" id="ntState">جاري الفحص...</p>
        <div class="row" style="margin-bottom:12px;gap:18px">
          <label class="row" style="gap:6px"><input type="checkbox" id="nt_giveaway"> مسابقة جديدة</label>
          <label class="row" style="gap:6px"><input type="checkbox" id="nt_hunt"> بونص هانت جديد</label>
          <label class="row" style="gap:6px"><input type="checkbox" id="nt_tournament"> بطولة جديدة</label>
          <label class="row" style="gap:6px"><input type="checkbox" id="nt_live"> بدء البث</label>
        </div>
        <div class="row" style="gap:12px;align-items:center"><label class="row" style="gap:8px">منشن: <select id="nt_ping"><option value="">بدون منشن</option><option value="here">@here</option><option value="everyone">@everyone</option></select></label>
          <button class="btn primary small" id="ntTest">إرسال رسالة تجربة</button></div>
        <p class="hint" style="margin-top:10px;text-align:start">التنبيه بيوصل لقناة الديسكورد اللي عملت لها Webhook. تنبيه بدء البث بيتفحص كل دقيقة.</p>
      </div>

      <div class="panel"><h2>📜 سجل نشاط الأدمن</h2>
        <div class="utable-wrap"><table class="utable"><thead><tr><th>الوقت</th><th>الأدمن</th><th>العملية</th><th>المسار</th></tr></thead><tbody id="auBody"><tr><td colspan="4" class="msg">جاري التحميل...</td></tr></tbody></table></div>
        <p class="hint" style="text-align:start;margin-top:10px">آخر 150 عملية. الكتابات المتكررة على نفس الشي خلال 30 ثانية بتنسجّل مرة وحدة.</p>
      </div>

      <div class="panel"><h2>👥 المستخدمين <small id="uCount" style="color:var(--muted);font-weight:400;font-size:13px"></small></h2>
        <div class="row" style="margin-bottom:12px"><input id="uSearch" placeholder="ابحث بالاسم / ستيك / ديسكورد..." style="flex:1;min-width:180px;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:rgba(5,7,15,.5)">
          <button class="btn ghost small" id="uCsv">⬇️ تصدير CSV</button></div>
        <div class="utable-wrap"><table class="utable"><thead><tr><th>كيك</th><th>الحالة</th><th>ديسكورد</th><th>ستيك</th><th>USDT (BSC)</th><th></th></tr></thead><tbody id="uBody"></tbody></table></div>
        <p class="hint" style="text-align:start;margin-top:10px">العناوين مخفية افتراضياً عشان ما تظهر لو كنت عامل مشاركة شاشة بالبث.</p>
      </div>`;

    $("cSave").onclick = saveCmd;
    $("vpnClear").onclick = clearVpnCache;
    $("tSave").onclick = saveTimer;
    ["giveaway", "hunt", "tournament", "live"].forEach((k) => ($("nt_" + k).onchange = () => db.ref("config/notify/" + k).set($("nt_" + k).checked).catch(() => App.toast("فشل الحفظ"))));
    $("nt_ping").onchange = () => db.ref("config/notify/ping").set($("nt_ping").value).catch(() => App.toast("فشل الحفظ"));
    $("ntTest").onclick = async () => { $("ntTest").disabled = true; try { await adminPost("/guard/notify", { type: "test" }); App.toast("انرسلت رسالة التجربة ✓"); } catch (e) { App.toast("فشل الإرسال: " + String(e.message || e).slice(0, 80)); } $("ntTest").disabled = false; };
    db.ref("config/notify").on("value", (x) => { const c = { giveaway: true, hunt: true, tournament: true, live: true, ping: "", ...(x.val() || {}) }; ["giveaway", "hunt", "tournament", "live"].forEach((k) => ($("nt_" + k).checked = c[k] !== false)); $("nt_ping").value = c.ping || ""; });
    db.ref("config/notifyLast").on("value", (x) => { const l = x.val(); $("ntState").innerHTML = !l ? "لسا ما انرسل أي تنبيه. أضف Webhook بالـ Worker (DISCORD_WEBHOOK_URL) وجرّب رسالة التجربة." : l.ok ? `<span class="dot on"></span> آخر تنبيه انرسل بنجاح (${esc(l.type)})` : `<span class="dot"></span> آخر محاولة فشلت: ${esc(l.error || "")}`; });
    $("uSearch").oninput = renderUsers;
    $("uCsv").onclick = exportCsv;
    ["ip", "dev", "fp", "vpn"].forEach((k) => ($("gc_" + k).onchange = saveGuardCfg));
    $("crConnect").onclick = () => { location.href = C.workerUrl + "/connect?r=admin-database.html"; };
    db.ref("commands").on("value", (x) => { cmds = x.val() || {}; renderCmds(); });
    db.ref("audit").orderByChild("at").limitToLast(150).on("value", (x) => { const a = []; x.forEach((c) => { a.push(c.val()); }); renderAudit(a.reverse()); }, () => renderAudit([]));
    db.ref("timers").on("value", (x) => { timers = x.val() || {}; renderTimers(); });
    db.ref("config/botLast").on("value", (x) => { botLast = x.val(); renderBot(); });
    db.ref("config/guard").on("value", (x) => { guardCfg = x.val() || {}; renderGuardCfg(); });
    db.ref("bans").on("value", (x) => { bans = x.val() || {}; renderAlts(); renderUsers(); }, () => {});
    db.ref("vpn").on("value", (x) => { vpn = x.val() || {}; renderAlts(); renderUsers(); }, () => {});
    db.ref("blocked").on("value", (x) => { blocked = x.val() || {}; renderAlts(); }, () => {});
    db.ref("users").on("value", (x) => { users = x.val() || {}; renderUsers(); renderAlts(); });
    db.ref("profiles").on("value", (x) => { profiles = x.val() || {}; renderUsers(); renderAlts(); });
    db.ref("verified").on("value", (x) => { verifiedMap = x.val() || {}; renderUsers(); });
    db.ref("config/webhook").on("value", (x) => { hook = x.val(); renderChat(); });
    db.ref("config/lastChatAt").on("value", (x) => { lastChatAt = x.val() || 0; renderChat(); });
    setInterval(renderChat, 10000);
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
    const tag = (r) => r.ok ? '<span class="vt ok">موثّق</span>' : r.status === "norole" ? '<span class="vt bad">بدون رول</span>' : r.status === "nomember" ? '<span class="vt bad">مو بالسيرفر</span>' : r.status === "banned" ? '<span class="vt bad">محظور</span>' : r.status === "vpn" ? '<span class="vt bad">VPN</span>' : r.status === "alt" ? '<span class="vt bad">حساب مكرر</span>' : '<span class="vt">غير مربوط</span>';
    body.innerHTML = list.length ? list.map((r) => `<tr>
      <td>${esc(r.kick)}</td><td>${tag(r)}</td><td>${esc(r.discord) || "—"}</td><td dir="ltr">${esc(r.stake) || "—"}</td>
      <td dir="ltr">${r.wallet ? `<span class="wal">${shown.has(r.uid) ? esc(r.wallet) : mask(r.wallet)}</span>
        <button class="btn ghost small" data-eye="${r.uid}">${shown.has(r.uid) ? "إخفاء" : "إظهار"}</button><button class="btn ghost small" data-copy="${esc(r.wallet)}">نسخ</button>` : "—"}</td>
      <td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn primary small" data-edit="${r.uid}">تعديل</button><a class="btn ghost small" href="admin-profiles.html?id=${r.uid}">البروفايل</a>${isBanned(r.uid) ? `<button class="btn ghost small" data-unban="${r.uid}">فك الحظر</button>` : `<button class="btn danger small" data-ban="${r.uid}">حظر</button>`}</div></td></tr>`).join("")
      : `<tr><td colspan="6" class="msg">لا يوجد نتائج</td></tr>`;
    body.querySelectorAll("[data-eye]").forEach((b) => (b.onclick = () => { const k = b.dataset.eye; shown.has(k) ? shown.delete(k) : shown.add(k); renderUsers(); }));
    bindBanBtns(body);
    body.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openEdit(b.dataset.edit)));
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
  async function adminApi(path, method) {
    const t = await firebase.auth().currentUser.getIdToken();
    const r = await fetch(C.workerUrl + path, { method: method || "GET", headers: { Authorization: "Bearer " + t } });
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


  // ---------------- تعديل بيانات مستخدم (الأدمن فقط) ----------------
  const kOf = (v) => v.toLowerCase().replace(/\./g, ",");
  let editUid = null;
  function openEdit(uid) {
    editUid = uid;
    const u = users[uid] || {}, p = profiles[uid] || {}, d = p.discord;
    $("ueTitle").textContent = "تعديل: " + (u.name || uid);
    $("ueStake").value = p.stake || ""; $("ueWallet").value = p.wallet || "";
    $("ueDiscord").textContent = d ? "ديسكورد مربوط: " + d.name + " (" + d.id + ")" : "ما في ديسكورد مربوط";
    $("ueUnlink").style.display = d ? "" : "none";
    $("uEdit").classList.add("show");
  }
  $("ueClose").onclick = () => $("uEdit").classList.remove("show");
  $("ueSave").onclick = async () => {
    const uid = editUid, old = profiles[uid] || {};
    const stake = $("ueStake").value.trim(), wallet = $("ueWallet").value.trim();
    if (stake && !/^[A-Za-z0-9_.-]{2,40}$/.test(stake)) return App.toast("يوزر ستيك غير صالح");
    if (wallet && !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return App.toast("عنوان المحفظة غير صالح");
    const clash = (f, v) => v && Object.entries(profiles).some(([id, p]) => id !== uid && p[f] && p[f].toLowerCase() === v.toLowerCase());
    if (clash("stake", stake)) return App.toast("يوزر ستيك هذا مستخدم بحساب ثاني");
    if (clash("wallet", wallet)) return App.toast("هذا العنوان مستخدم بحساب ثاني");
    const up = {};
    if (old.stake) up["stakeIndex/" + kOf(old.stake)] = null;
    if (old.wallet) up["walletIndex/" + kOf(old.wallet)] = null;
    up["profiles/" + uid + "/stake"] = stake || null; up["profiles/" + uid + "/wallet"] = wallet || null;
    if (stake) up["stakeIndex/" + kOf(stake)] = uid;
    if (wallet) up["walletIndex/" + kOf(wallet)] = uid;
    up["profiles/" + uid + "/updatedAt"] = SV.TIMESTAMP;
    try { await db.ref().update(up); App.toast("تم الحفظ ✓"); $("uEdit").classList.remove("show"); }
    catch (e) { console.error(e); App.toast("فشل الحفظ"); }
  };
  $("ueUnlink").onclick = async () => {
    const uid = editUid, d = (profiles[uid] || {}).discord; if (!d) return;
    if (!confirm("فك ربط الديسكورد لهذا المستخدم؟ رح يفقد التوثيق لين يربط من جديد.")) return;
    try { await db.ref().update({ ["profiles/" + uid + "/discord"]: null, ["discordLinks/" + d.id]: null, ["verified/" + uid]: null }); App.toast("تم فك الربط ✓"); $("uEdit").classList.remove("show"); }
    catch (e) { console.error(e); App.toast("فشل فك الربط"); }
  };

})();
