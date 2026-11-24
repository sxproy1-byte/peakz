// البروفايل العام: user.html?id=kick_123
(function () {
  const { db, esc } = App;
  App.shell("");
  const root = document.getElementById("root");
  const id = new URLSearchParams(location.search).get("id") || "";
  if (!/^kick_\d+$/.test(id)) { root.innerHTML = '<div class="empty">بروفايل غير موجود</div>'; return; }
  const get = (p) => db.ref(p).once("value").then((s) => s.val()).catch(() => null);

  async function load() {
    const [u, lv, cs0, st, tops] = await Promise.all([get("users/" + id), Lv.loadLevel(id), get("cosmetics/" + id), Lv.loadStats(id).catch(() => ({})), Lv.top(200).catch(() => [])]);
    if (!u && !lv.xp) { root.innerHTML = '<div class="empty">بروفايل غير موجود</div>'; return; }
    const cs = { ...(cs0 || {}) }; if (!Cos.ok(cs.avatar)) delete cs.avatar; if (!Cos.ok(cs.banner)) delete cs.banner; if (typeof cs.bio !== "string") delete cs.bio;
    const name = (u && u.name) || lv.name || id, av = cs.avatar || (u && u.avatar) || "";
    const xp = lv.xp || 0, pr = Lv.progress(xp), i = xp > 0 ? tops.findIndex((x) => x.uid === id) : -1;
    const stats = { ...st, level: pr.level, ab: lv.ab, subMonths: lv.subMonths || 0, msgs: lv.msgs || 0, hours: Math.floor((lv.mins || 0) / 60) };
    const all = Lv.badges(stats), got = all.filter((b) => b.ok);
    const adm = App.user && App.user.admin;
    root.innerHTML = `
      <div class="uprof">
        <div class="ubanner" style="${cs.banner ? `background-image:url('${cs.banner}')` : ""}"></div>
        <div class="uhead">
          ${av ? `<img class="uav" src="${esc(av)}" alt="">` : `<div class="uav ph">${esc(name[0].toUpperCase())}</div>`}
          <div class="uinfo"><h1 class="uname">${esc(name)} <span class="kbs">${Cos.kickBadges(lv.kb)}</span></h1>
            ${cs.bio ? `<p class="ubio">${esc(cs.bio)}</p>` : ""}</div>
          <div class="ulv"><b>${pr.level}</b><small>المستوى</small></div>
        </div>
      </div>
      ${adm ? `<div class="hint" style="margin:8px 0">أدمن: <a class="btn primary small" href="admin-profiles.html?id=${esc(id)}">تعديل البروفايل</a> <button class="btn ghost small" id="rmAv">حذف الصورة</button> <button class="btn ghost small" id="rmBn">حذف البانر</button> <button class="btn ghost small" id="rmBio">حذف النبذة</button></div>` : ""}
      <div class="panel"><div class="lvtop"><span>${xp.toLocaleString("en")} XP</span><span class="m">${pr.level >= Lv.MAX ? "المستوى الأقصى" : "باقي " + pr.left.toLocaleString("en") + " للمستوى " + (pr.level + 1)}</span></div>
        <div class="bar"><i style="width:${pr.pct}%"></i></div>
        <div class="lvstats"><span>الرتبة <b>${i >= 0 ? `<span dir="ltr" style="unicode-bidi:isolate">#${i + 1}</span>` : "—"}</b></span><span>الرسائل <b>${stats.msgs.toLocaleString("en")}</b></span><span>ساعات التواجد <b>${stats.hours}</b></span><span>الاشتراك <b>${stats.subMonths ? stats.subMonths + " شهر" : "—"}</b></span></div></div>
      <div class="panel"><h2>البادجات <small id="bdCount"><span dir="ltr" style="unicode-bidi:isolate">${got.length} / ${all.length}</span></small></h2>
        <div class="bdgs">${got.length ? Lv.html(got, esc) : '<div class="hint">لسا ما عنده بادجات</div>'}</div></div>`;
    document.title = name;
    if (adm) {
      const rm = (btn, key) => { const b = document.getElementById(btn); if (b) b.onclick = () => confirm("تأكيد الحذف؟") && db.ref("cosmetics/" + id + "/" + key).remove().then(() => { App.toast("تم الحذف"); load(); }).catch(() => App.toast("فشل الحذف")); };
      rm("rmAv", "avatar"); rm("rmBn", "banner"); rm("rmBio", "bio");
    }
  }
  App.onUser(() => load().catch((e) => { console.error(e); root.innerHTML = '<div class="empty">تعذّر تحميل البروفايل</div>'; }));
  window.addEventListener("langchange", () => load().catch(() => {}));
})();
