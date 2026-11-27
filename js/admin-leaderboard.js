// أدمن: ليدر بورد CrownCases — أول 10 مراكز (الفراغات مسموحة)
(function () {
  const { db, esc } = App;
  App.shell("giveaways");
  const root = document.getElementById("root");
  const TABS = `<h1 class="plain">لوحة التحكم</h1><div class="atabs"><a href="admin.html">🎟️ المسابقات</a><a href="admin-bonus.html">🎯 البونص هانت</a><a href="admin-tournaments.html">⚔️ البطولات</a><a href="admin-slots.html">🎰 السلوت كول</a><a href="admin-profiles.html">👤 البروفايلات</a><a href="admin-leaderboard.html" class="on">🏅 ليدر بورد</a><a href="admin-stats.html">📊 الإحصائيات</a><a href="admin-database.html">🗄️ قاعدة البيانات</a></div>`;
  App.onUser((u) => {
    if (!u) {
      root.innerHTML = `<div class="empty"><div>سجّل دخولك بحساب الأدمن على كيك للوصول للوحة التحكم</div><div class="center"><button class="btn primary" id="l">تسجيل الدخول بكيك</button></div></div>`;
      document.getElementById("l").onclick = () => App.login("admin-leaderboard.html");
    } else if (!u.admin) root.innerHTML = `<div class="empty"><div>حسابك (${esc(u.name)}) مو أدمن</div></div>`;
    else load();
  });
  async function load() {
    const v = (await db.ref("ccBoard").once("value").then((s) => s.val()).catch(() => null)) || {}, rows = v.rows || {};
    let h = "";
    for (let i = 1; i <= 10; i++) { const r = rows[i] || { prize: i === 1 ? "$100" : "" };
      h += `<div class="ccr"><b>${i}</b><input data-k="name" data-i="${i}" maxlength="30" placeholder="اسم اللاعب" value="${esc(r.name || "")}"><input data-k="wager" data-i="${i}" maxlength="20" dir="ltr" placeholder="الويجر (اختياري)" value="${esc(r.wager || "")}"><input data-k="prize" data-i="${i}" maxlength="20" dir="ltr" placeholder="الجائزة (اختياري)" value="${esc(r.prize || "")}"></div>`; }
    root.innerHTML = TABS + `<div class="panel"><h2>🏅 ليدر بورد CrownCases</h2>
      <div class="field" style="margin-bottom:12px"><label>العنوان أو الفترة (اختياري)</label><input id="ccPeriod" maxlength="80" placeholder="مثلاً: ليدر بورد هذا الأسبوع" value="${esc(v.period || "")}"></div>
      <div class="form" style="margin-bottom:12px"><div class="field"><label>ينتهي في (بتوقيت الأردن)</label><input id="ccEnd" type="datetime-local" dir="ltr" value="${v.endsAt ? new Date(v.endsAt + 10800000).toISOString().slice(0, 16) : ""}"></div><div class="field"><label>التكرار</label><label class="chk"><input type="checkbox" id="ccWeekly" ${v.weekly === false ? "" : "checked"}> يتجدد أسبوعياً تلقائياً</label></div></div>
      <p class="hint" style="text-align:start;margin:-4px 0 12px">إذا تركت الوقت فاضي، بيعدّ للخميس القادم عند منتصف الليل (نهاية يوم الخميس) بتوقيت الأردن.</p>
      <div class="ccr ccr-h"><b>#</b><span>اللاعب</span><span>الويجر</span><span>الجائزة</span></div>${h}
      <div class="row" style="margin-top:14px"><button class="btn primary" id="ccSave">حفظ</button><button class="btn danger" id="ccClear">تفريغ الكل</button></div>
      <p class="hint" style="text-align:start;margin-top:10px">الفراغات بتظهر شرطة بالموقع. عمود الويجر والجائزة بيظهروا بس لو عبّيت وحدة على الأقل.</p></div>`;
    document.getElementById("ccSave").onclick = async () => {
      const rows = {}; root.querySelectorAll("input[data-i]").forEach((e) => { const i = e.dataset.i; (rows[i] = rows[i] || {})[e.dataset.k] = e.value.trim(); });
      try { await db.ref("ccBoard").set({ rows, period: document.getElementById("ccPeriod").value.trim(), updatedAt: Date.now(), weekly: document.getElementById("ccWeekly").checked, endsAt: document.getElementById("ccEnd").value ? new Date(document.getElementById("ccEnd").value + ":00+03:00").getTime() : null }); App.toast("تم الحفظ ✓"); }
      catch (e) { App.toast("فشل الحفظ — انشر قواعد Firebase الجديدة"); }
    };
    document.getElementById("ccClear").onclick = () => { if (!confirm("تفريغ كل المراكز؟")) return; root.querySelectorAll("input[data-i]").forEach((e) => (e.value = e.dataset.k === "prize" && e.dataset.i === "1" ? "$100" : "")); };
  }
})();
