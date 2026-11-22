// قاعدة البيانات: المستخدمين والتوثيق، الحماية (Alts)، ربط الشات، أوامر البوت
(function () {
  const { db, esc, C } = App;
  App.shell("giveaways");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("root");
  const $ = (id) => document.getElementById(id);

  let users = {}, profiles = {}, verifiedMap = {}; const shown = new Set();
  let blocked = {}, cleared = {}, guardCfg = {};
  let cmds = {}, botLast = null;
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


  /* ---------- الحماية من الحسابات المكررة (Alts) ---------- */
  const REASON = { ip: "نفس الـ IP", dev: "نفس الجهاز/المتصفح", fp: "نفس بصمة الجهاز", stake: "نفس يوزر ستيك", wallet: "نفس عنوان المحفظة", discord: "نفس الديسكورد" };
  function groupsOf() {
    // نجمع الحسابات المتشابهة بمجموعات (union-find) من سجل blocked
    const parent = {}; const find = (x) => (parent[x] === undefined ? (parent[x] = x) : parent[x] === x ? x : (parent[x] = find(parent[x])));
    const uni = (a, b) => { parent[find(a)] = find(b); };
    Object.keys(blocked).forEach((uid) => { find(uid); Object.values((blocked[uid] || {}).reasons || {}).forEach((arr) => (arr || []).forEach((o) => uni(uid, o))); });
    const g = {};
    Object.keys(parent).forEach((uid) => { (g[find(uid)] = g[find(uid)] || []).push(uid); });
    return Object.values(g).filter((m) => m.length > 0).sort((a, b) => Math.max(...b.map((x) => (blocked[x] || {}).at || 0)) - Math.max(...a.map((x) => (blocked[x] || {}).at || 0)));
  }
  function renderAlts() {
    const el = $("altsList"); if (!el) return;
    const gs = groupsOf();
    $("altsCount").textContent = gs.length ? `(${gs.length} مجموعة)` : "";
    el.innerHTML = gs.length ? gs.map((m, i) => `<div class="altg"><div class="alth">مجموعة ${i + 1} <button class="btn ghost small" data-clrall="${esc(m.join(","))}">اعتماد الكل ✓</button></div>
      ${m.map((uid) => {
        const u = users[uid] || {}, p = profiles[uid] || {}, b = blocked[uid] || {}, d = p.discord || {};
        const why = Object.keys(b.reasons || {}).filter((k) => (b.reasons[k] || []).length).map((k) => REASON[k] || k).join(" · ");
        return `<div class="arow"><div class="ainfo"><b>${esc(u.name || uid)}</b> <span class="vt bad">${b.at ? "موقوف" : "مرتبط"}</span>
          <div style="color:var(--muted);font-size:13px">ديسكورد: ${esc(d.name) || "—"} · ستيك: <span dir="ltr">${esc(p.stake) || "—"}</span>${why ? " · السبب: " + esc(why) : ""}</div></div>
          <div class="row"><button class="btn primary small" data-clr="${esc(uid)}">اعتماد ✓</button></div></div>`;
      }).join("")}</div>`).join("") : '<div class="empty" style="padding:14px">ما في حسابات مكررة مكتشفة 👍</div>';
    el.querySelectorAll("[data-clr]").forEach((b) => (b.onclick = () => clearAlt([b.dataset.clr])));
    el.querySelectorAll("[data-clrall]").forEach((b) => (b.onclick = () => clearAlt(b.dataset.clrall.split(","))));
  }
  async function clearAlt(uids) {
    if (!confirm("اعتماد هذا الحساب (مو حساب مكرر)؟ رح يرجع توثيقه حسب الديسكورد، وما رح ينفحص تشابهه مرة ثانية.")) return;
    try {
      const up = {};
      uids.forEach((id) => { up["cleared/" + id] = true; up["blocked/" + id] = null; });
      await db.ref().update(up);
      await Promise.all(uids.map((id) => adminApi("/discord/check?uid=" + encodeURIComponent(id)).catch(() => null)));
      App.toast("تم الاعتماد ✓");
    } catch (e) { console.error(e); App.toast("فشل — تأكد من قواعد Firebase"); }
  }
  function renderGuardCfg() {
    const f = { ip: guardCfg.ip !== false, dev: guardCfg.dev !== false, fp: guardCfg.fp === true };
    Object.keys(f).forEach((k) => { const el = $("gc_" + k); if (el) el.checked = f[k]; });
  }
  function saveGuardCfg() {
    db.ref("config/guard").set({ ip: $("gc_ip").checked, dev: $("gc_dev").checked, fp: $("gc_fp").checked }).then(() => App.toast("تم الحفظ ✓"), () => App.toast("فشل الحفظ"));
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    root.innerHTML = `
      <h1 class="plain">لوحة التحكم</h1><div class="atabs"><a href="admin.html">🎟️ المسابقات</a><a href="admin-bonus.html">🎯 البونص هانت</a><a href="admin-tournaments.html">⚔️ البطولات</a><a href="admin-database.html" class="on">🗄️ قاعدة البيانات</a></div>

      <div class="panel"><h2>🕵️ Alts — الحسابات المكررة <small id="altsCount" style="color:var(--muted);font-weight:400;font-size:13px"></small></h2>
        <p class="hint" style="text-align:start;margin-bottom:12px">أي حسابين بنفس يوزر ستيك / عنوان المحفظة / الديسكورد، أو بنفس الـ IP أو نفس الجهاز، بينلغى توثيقهم تلقائياً وبيظهروا هون. لو الحسابين لأشخاص مختلفين فعلاً (إخوة بنفس البيت مثلاً) اضغط <b>اعتماد</b>.</p>
        <div class="row" style="margin-bottom:12px;gap:18px">
          <label class="row" style="gap:6px"><input type="checkbox" id="gc_ip"> نفس الـ IP</label>
          <label class="row" style="gap:6px"><input type="checkbox" id="gc_dev"> نفس الجهاز/المتصفح</label>
          <label class="row" style="gap:6px"><input type="checkbox" id="gc_fp"> بصمة الجهاز (ممكن تغلط مع نفس نوع الجوال)</label>
        </div>
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

      <div class="panel"><h2>👥 المستخدمين <small id="uCount" style="color:var(--muted);font-weight:400;font-size:13px"></small></h2>
        <div class="row" style="margin-bottom:12px"><input id="uSearch" placeholder="ابحث بالاسم / ستيك / ديسكورد..." style="flex:1;min-width:180px;padding:10px 14px;border-radius:12px;border:1px solid var(--line);background:rgba(5,7,15,.5)">
          <button class="btn ghost small" id="uCsv">⬇️ تصدير CSV</button></div>
        <div class="utable-wrap"><table class="utable"><thead><tr><th>كيك</th><th>الحالة</th><th>ديسكورد</th><th>ستيك</th><th>USDT (BSC)</th><th></th></tr></thead><tbody id="uBody"></tbody></table></div>
        <p class="hint" style="text-align:start;margin-top:10px">العناوين مخفية افتراضياً عشان ما تظهر لو كنت عامل مشاركة شاشة بالبث.</p>
      </div>`;

    $("cSave").onclick = saveCmd;
    $("uSearch").oninput = renderUsers;
    $("uCsv").onclick = exportCsv;
    ["ip", "dev", "fp"].forEach((k) => ($("gc_" + k).onchange = saveGuardCfg));
    $("crConnect").onclick = () => { location.href = C.workerUrl + "/connect?r=admin-database.html"; };
    db.ref("commands").on("value", (x) => { cmds = x.val() || {}; renderCmds(); });
    db.ref("config/botLast").on("value", (x) => { botLast = x.val(); renderBot(); });
    db.ref("config/guard").on("value", (x) => { guardCfg = x.val() || {}; renderGuardCfg(); });
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
    const tag = (r) => r.ok ? '<span class="vt ok">موثّق</span>' : r.status === "norole" ? '<span class="vt bad">بدون رول</span>' : r.status === "nomember" ? '<span class="vt bad">مو بالسيرفر</span>' : r.status === "alt" ? '<span class="vt bad">حساب مكرر</span>' : '<span class="vt">غير مربوط</span>';
    body.innerHTML = list.length ? list.map((r) => `<tr>
      <td>${esc(r.kick)}</td><td>${tag(r)}</td><td>${esc(r.discord) || "—"}</td><td dir="ltr">${esc(r.stake) || "—"}</td>
      <td dir="ltr">${r.wallet ? `<span class="wal">${shown.has(r.uid) ? esc(r.wallet) : mask(r.wallet)}</span>
        <button class="btn ghost small" data-eye="${r.uid}">${shown.has(r.uid) ? "إخفاء" : "إظهار"}</button><button class="btn ghost small" data-copy="${esc(r.wallet)}">نسخ</button>` : "—"}</td>
      <td><button class="btn primary small" data-edit="${r.uid}">تعديل</button></td></tr>`).join("")
      : `<tr><td colspan="6" class="msg">لا يوجد نتائج</td></tr>`;
    body.querySelectorAll("[data-eye]").forEach((b) => (b.onclick = () => { const k = b.dataset.eye; shown.has(k) ? shown.delete(k) : shown.add(k); renderUsers(); }));
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
