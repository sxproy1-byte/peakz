// أدمن: البروفايلات — ابحث عن أي شخص وعدّل اللفل والبادجات والصورة والبانر والنبذة
(function () {
  const { db, esc } = App;
  App.shell("giveaways");
  const root = document.getElementById("root");
  const $ = (id) => document.getElementById(id);
  const TABS = (on) => `<h1 class="plain">لوحة التحكم</h1><div class="atabs"><a href="admin.html">🎟️ المسابقات</a><a href="admin-bonus.html">🎯 البونص هانت</a><a href="admin-tournaments.html">⚔️ البطولات</a><a href="admin-slots.html">🎰 السلوت كول</a><a href="admin-profiles.html" class="on">👤 البروفايلات</a><a href="admin-database.html">🗄️ قاعدة البيانات</a></div>`;
  let users = {}, levels = {}, id = new URLSearchParams(location.search).get("id") || "", newImg = {};

  App.onUser((u) => {
    if (!u) {
      root.innerHTML = `<div class="empty"><div>سجّل دخولك بحساب الأدمن على كيك للوصول للوحة التحكم</div><div class="center"><button class="btn primary" id="l">تسجيل الدخول بكيك</button></div></div>`;
      $("l").onclick = () => App.login("admin-profiles.html");
    } else if (!u.admin) root.innerHTML = `<div class="empty"><div>حسابك (${esc(u.name)}) مو أدمن</div></div>`;
    else start();
  });
  let started = false;
  function start() {
    if (started) return; started = true;
    root.innerHTML = TABS() + '<div id="ed"></div><div class="panel"><h2>ابحث عن شخص</h2><div class="field"><input id="q" placeholder="اسم كيك أو المعرّف (kick_123)..." autocomplete="off"></div><div class="tscroll"><table class="utable"><thead><tr><th>الاسم</th><th>المستوى</th><th>XP</th><th>الاشتراك</th><th></th></tr></thead><tbody id="body"></tbody></table></div></div>';
    $("q").oninput = list;
    db.ref("users").on("value", (s) => { users = s.val() || {}; list(); });
    db.ref("levels").on("value", (s) => { levels = s.val() || {}; list(); if (id && !$("ed").dataset.id) edit(id); });
    if (id) db.ref("users/" + id).once("value").then((s) => { users[id] = users[id] || s.val() || {}; edit(id); });
  }
  const nm = (uid) => (users[uid] || {}).name || (levels[uid] || {}).name || uid;
  function list() {
    const body = $("body"); if (!body) return;
    const q = ($("q").value || "").trim().toLowerCase();
    const ids = [...new Set([...Object.keys(users), ...Object.keys(levels)])];
    const rows = ids.map((uid) => ({ uid, name: nm(uid), xp: (levels[uid] || {}).xp || 0, sub: (levels[uid] || {}).subMonths || 0 }))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.uid.toLowerCase().includes(q)).sort((a, b) => b.xp - a.xp).slice(0, 60);
    body.innerHTML = rows.length ? rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${Lv.levelOf(r.xp)}</td><td>${r.xp.toLocaleString("en")}</td><td>${r.sub ? r.sub + " شهر" : "—"}</td>
      <td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn primary small" data-e="${esc(r.uid)}">تعديل</button><a class="btn ghost small" href="user.html?id=${esc(r.uid)}">عرض</a></div></td></tr>`).join("") : '<tr><td colspan="5" class="msg">لا يوجد نتائج</td></tr>';
    body.querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => { history.replaceState(null, "", "?id=" + b.dataset.e); edit(b.dataset.e); scrollTo({ top: 0, behavior: "smooth" }); }));
  }

  async function edit(uid) {
    if (!/^kick_\d+$/.test(uid) && !users[uid] && !levels[uid]) { $("ed").innerHTML = '<div class="panel"><div class="hint">معرّف غير صحيح</div></div>'; return; }
    id = uid; newImg = {};
    const [cs0] = await Promise.all([db.ref("cosmetics/" + uid).once("value").then((s) => s.val() || {}).catch(() => ({}))]);
    const lv = levels[uid] || {}, ab = lv.ab || {}, xp = lv.xp || 0;
    const ed = $("ed"); ed.dataset.id = uid;
    ed.innerHTML = `<div class="panel"><h2>تعديل: ${esc(nm(uid))} <small style="color:var(--muted);font-weight:400" dir="ltr">${esc(uid)}</small></h2>
      <div class="row" style="gap:8px;margin-bottom:14px;flex-wrap:wrap"><a class="btn ghost small" href="user.html?id=${esc(uid)}">عرض البروفايل العام</a><a class="btn ghost small" href="admin-database.html">بياناته وحظره (قاعدة البيانات)</a></div>
      <h3 style="margin:6px 0 10px">اللفل</h3>
      <div class="form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
        <div class="field"><label>المستوى (0–100)</label><input id="eL" type="number" min="0" max="100" value="${Lv.levelOf(xp)}"></div>
        <div class="field"><label>XP</label><input id="eX" type="number" min="0" value="${xp}"></div>
        <div class="field"><label>شهور الاشتراك</label><input id="eS" type="number" min="0" max="120" value="${lv.subMonths || 0}"></div>
        <div class="field"><label>الرسائل</label><input id="eM" type="number" min="0" value="${lv.msgs || 0}"></div>
        <div class="field"><label>ساعات التواجد</label><input id="eH" type="number" min="0" step="0.1" value="${Math.round(((lv.mins || 0) / 60) * 10) / 10}"></div></div>
      <div class="row" style="margin-top:12px;gap:8px"><button class="btn primary" id="eSave">حفظ اللفل</button><button class="btn danger small" id="eReset">تصفير اللفل</button></div>
      <p class="hint" style="text-align:start;margin-top:8px">لما تغيّر المستوى بيتحدّث الـXP لأقل نقطة بهاد المستوى، ولما تغيّر الـXP بيتحدّث المستوى. الرسائل والساعات بتأثر على بادجات الشات والتواجد.</p></div>
    <div class="panel"><h3 style="margin-bottom:10px">بادجات يدوية</h3>
      <div class="bdgs" id="abL">${Object.entries(ab).map(([k, b]) => `<div class="bdg t${b.t || 1} ok"><span>${esc(b.n)}</span><button class="btn ghost small" data-rm="${esc(k)}" style="padding:0 7px;margin-inline-start:4px">×</button></div>`).join("") || '<div class="hint">ما في بادجات يدوية</div>'}</div>
      <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><div class="field" style="margin:0;flex:1;min-width:160px"><input id="abN" maxlength="24" placeholder="اسم البادج (مثلاً: مساهم)"></div>
        <select id="abT" style="min-width:120px"><option value="1">برونز</option><option value="2">فضي</option><option value="3" selected>ذهبي</option><option value="4">ماسي</option></select><button class="btn primary" id="abAdd">إضافة</button></div></div>
    <div class="panel"><h3 style="margin-bottom:10px">الصورة والبانر والنبذة</h3>
      <div class="csprev"><div class="ubanner" id="aBn"></div><div class="csav" id="aAv"></div></div>
      <div class="row" style="margin:12px 0;gap:8px;flex-wrap:wrap"><label class="btn ghost small">رفع صورة<input type="file" id="aAvF" accept="image/*" hidden></label><label class="btn ghost small">رفع بانر<input type="file" id="aBnF" accept="image/*" hidden></label>
        <button class="btn danger small" id="aRmAv">حذف الصورة</button><button class="btn danger small" id="aRmBn">حذف البانر</button></div>
      <div class="field"><label>النبذة</label><input id="aBio" maxlength="80" value="${esc(typeof cs0.bio === "string" ? cs0.bio : "")}"></div>
      <div class="row" style="margin-top:12px;gap:8px"><button class="btn primary" id="aSave">حفظ</button><button class="btn danger small" id="aRmAll">حذف كل التخصيص</button></div></div>`;

    // صور المعاينة
    const paint = (cs) => {
      const bn = newImg.banner || cs.banner, av = newImg.avatar || cs.avatar;
      $("aBn").style.backgroundImage = Cos.ok(bn) ? `url('${bn}')` : "";
      $("aAv").style.backgroundImage = Cos.ok(av) ? `url('${av}')` : ""; $("aAv").textContent = Cos.ok(av) ? "" : nm(uid)[0].toUpperCase();
    };
    let cs = { ...cs0 }; paint(cs);
    const toast = (t) => App.toast(t), fail = (e) => { console.error(e); toast("فشل — تأكد إنك نشرت قواعد Firebase الجديدة"); };
    // اللفل: المستوى ↔ XP
    $("eL").oninput = () => { const L = Math.max(0, Math.min(100, parseInt($("eL").value, 10) || 0)); $("eX").value = L ? Lv.xpFor(L) : 0; };
    $("eX").oninput = () => { $("eL").value = Lv.levelOf(Math.max(0, parseInt($("eX").value, 10) || 0)); };
    const num = (x, d) => Math.max(0, Number($(x).value) || d || 0);
    $("eSave").onclick = () => db.ref("levels/" + uid).update({ name: nm(uid), xp: Math.floor(num("eX")), subMonths: Math.min(120, Math.floor(num("eS"))), msgs: Math.floor(num("eM")), mins: Math.round(num("eH") * 60) }).then(() => toast("تم الحفظ ✓")).catch(fail);
    $("eReset").onclick = () => confirm("تصفّر اللفل (XP والرسائل والتواجد) لـ " + nm(uid) + "؟") && db.ref("levels/" + uid).update({ name: nm(uid), xp: 0, msgs: 0, mins: 0, dm: 0, dp: 0 }).then(() => { toast("تم"); edit(uid); }).catch(fail);
    // بادجات يدوية
    $("abAdd").onclick = () => { const n = $("abN").value.replace(/[<>"&]/g, "").trim().slice(0, 24); if (!n) return toast("اكتب اسم البادج"); db.ref("levels/" + uid + "/name").set(nm(uid)).then(() => db.ref("levels/" + uid + "/ab").push({ n, t: Number($("abT").value) || 1 })).then(() => { toast("تمت الإضافة ✓"); edit(uid); }).catch(fail); };
    ed.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => db.ref("levels/" + uid + "/ab/" + b.dataset.rm).remove().then(() => edit(uid)).catch(fail)));
    // التخصيص
    const pick = (inp, key, dim) => ($(inp).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { newImg[key] = await Cos.toDataUrl(f, dim[0], dim[1], dim[2]); paint(cs); toast("جاهزة، اضغط حفظ"); } catch (err) { toast("الصورة غير مدعومة أو كبيرة"); } e.target.value = ""; });
    pick("aAvF", "avatar", Cos.AV); pick("aBnF", "banner", Cos.BN);
    $("aSave").onclick = () => { const up = { bio: $("aBio").value.replace(/<[^>]*>/g, "").replace(/[<>"&]/g, "").trim().slice(0, Cos.BIO), updatedAt: firebase.database.ServerValue.TIMESTAMP }; if (newImg.avatar) up.avatar = newImg.avatar; if (newImg.banner) up.banner = newImg.banner; db.ref("cosmetics/" + uid).update(up).then(() => { cs = { ...cs, ...up }; newImg = {}; toast("تم الحفظ ✓"); }).catch(fail); };
    const rm = (btn, key) => ($(btn).onclick = () => db.ref("cosmetics/" + uid + "/" + key).remove().then(() => { delete cs[key]; delete newImg[key]; paint(cs); toast("تم الحذف"); }).catch(fail));
    rm("aRmAv", "avatar"); rm("aRmBn", "banner");
    $("aRmAll").onclick = () => confirm("تحذف الصورة والبانر والنبذة؟") && db.ref("cosmetics/" + uid).remove().then(() => { toast("تم"); edit(uid); }).catch(fail);
  }
})();
