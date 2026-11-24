// الملف الشخصي: ربط ديسكورد (توثيق بالرول) + يوزر ستيك + عنوان USDT (BSC)
(function () {
  const { db, esc, C } = App;
  App.shell("");
  const root = document.getElementById("root");
  let prof = null, ver = null, started = false;

  const MSG = {
    ok: "تم التوثيق بنجاح",
    banned: "حسابك محظور — بتقدر تتفرّج بس",
    vpn: "أوقف الـ VPN/البروكسي وحدّث الصفحة عشان يرجع توثيقك",
    alt: "تم إيقاف توثيق حسابك بسبب تشابه مع حساب آخر، تواصل مع الإدارة",
    norole: "حسابك انربط، بس ما عندك رول التوثيق بالسيرفر",
    nomember: "حساب الديسكورد هذا مو موجود بسيرفرنا — انضم للسيرفر وجرّب مرة ثانية",
    dup: "حساب الديسكورد هذا مربوط بحساب ثاني على الموقع",
    locked: "حسابك مربوط بديسكورد مسبقاً، التغيير بس عن طريق الإدارة",
    denied: "ألغيت الربط", err: "صار خطأ بالربط، جرّب مرة ثانية",
  };
  // رجوع من ديسكورد
  const qs = new URLSearchParams(location.search), dc = qs.get("dc"), who = qs.get("who");
  if (dc) { history.replaceState(null, "", location.pathname); setTimeout(() => App.toast((MSG[dc] || MSG.err) + (dc === "dup" && who ? " (" + who + ")" : "")), 600); }

  App.onUser((u) => {
    if (!u) {
      started = false;
      root.innerHTML = `<div class="empty"><div>سجّل دخولك بكيك لتشوف ملفك وتوثّق حسابك</div><div class="center"><button class="btn primary" id="l">تسجيل الدخول بكيك</button></div></div>`;
      document.getElementById("l").onclick = () => App.login("profile.html");
    } else start();
    if (u) paintStatus();
  });

  async function api(path, method) {
    const t = await firebase.auth().currentUser.getIdToken();
    const r = await fetch(C.workerUrl + path, { method: method || "GET", headers: { Authorization: "Bearer " + t } });
    return r.json();
  }

  function start() {
    if (started) return; started = true;
    root.innerHTML = `
      <h1 class="plain">ملفي الشخصي</h1>
      <div class="panel" id="lvPanel"><h2>مستواي</h2><div class="hint" id="lvBox">جاري التحميل...</div></div>
      <div class="panel" id="bdPanel"><h2>بادجاتي <small id="bdCount"></small></h2><div id="bdBox" class="bdgs"></div>
        <details class="bdmore"><summary>كل البادجات</summary><div id="bdAll" class="bdgs"></div></details></div>
      <div class="panel"><h2>توثيق الحساب (ديسكورد)</h2>
        <p class="hint" style="text-align:start;margin-bottom:12px;font-size:14px"><span class="dot" id="vDot"></span> <span id="vText">جاري الفحص...</span></p>
        <p class="hint" style="text-align:start;margin-bottom:14px">لازم تربط حسابك بالديسكورد وتكون موثّق بسيرفرنا (عندك رول التوثيق) عشان تقدر تدخل المسابقات. <b>بعد الربط ما بتقدر تغيّره</b> (الحسابات المتعددة ممنوعة)، وأي تعديل لازم يتم عن طريق الإدارة.</p>
        <div class="row"><button class="btn primary" id="dLink">ربط ديسكورد</button>
          <button class="btn ghost" id="dRe">تحديث الحالة</button>
          ${C.discordInvite ? `<a class="btn ghost" href="${esc(C.discordInvite)}" target="_blank" rel="noopener">انضم للسيرفر</a>` : ""}</div>
      </div>
      <div class="panel"><h2>بيانات الجوائز</h2>
        <div class="form">
          <div class="field"><label>يوزر ستيك (Stake)</label><input id="pStake" dir="ltr" placeholder="username" maxlength="40" autocomplete="off"></div>
          <div class="field" style="grid-column:span 2"><label>عنوان USDT — شبكة BSC (BEP20)</label><input id="pWallet" dir="ltr" placeholder="0x..." maxlength="42" autocomplete="off" spellcheck="false"></div>
          <div class="field"><label>&nbsp;</label><button class="btn primary" id="pSave" style="width:100%">حفظ</button></div>
        </div>
        <p class="hint" id="lockNote" style="text-align:start;margin-top:12px;color:var(--gold)"></p>
        <p class="hint" style="text-align:start;margin-top:12px">تأكد إن العنوان على شبكة <b>BSC (BEP20)</b> بالتحديد. الإرسال لعنوان غلط أو شبكة ثانية ما بيرجع. بياناتك ما بتظهر لأي مستخدم، بس لك وللإدارة. <b>بعد الحفظ ما بتقدر تعدّلها</b> وأي تغيير لازم عن طريق الإدارة (الحسابات المتعددة ممنوعة).</p>
      </div>`;
    document.getElementById("dLink").onclick = linkDiscord;
    document.getElementById("dRe").onclick = recheck;
    document.getElementById("pSave").onclick = save;
    db.ref("profiles/" + App.user.uid).on("value", (s) => {
      prof = s.val() || {};
      const st = document.getElementById("pStake"), w = document.getElementById("pWallet");
      if (st && document.activeElement !== st) st.value = prof.stake || "";
      if (w && document.activeElement !== w) w.value = prof.wallet || "";
      if (st) { st.disabled = !!prof.stake; w.disabled = !!prof.wallet; }
      const sv = document.getElementById("pSave"); if (sv) sv.style.display = prof.stake && prof.wallet ? "none" : "";
      const ln = document.getElementById("lockNote");
      if (ln) ln.textContent = prof.stake || prof.wallet ? "الحقول المحفوظة مقفولة. لتعديلها تواصل مع الإدارة." : "";
      paintStatus();
    });
    db.ref("verified/" + App.user.uid).on("value", (s) => { ver = s.val(); paintStatus(); });
    recheck(true);
    paintLevel();
  }

  // اللفل والبادجات
  async function paintLevel() {
    const uid = App.user.uid, box = document.getElementById("lvBox");
    try {
      const [lv, st, tops] = await Promise.all([Lv.loadLevel(uid), Lv.loadStats(uid).catch(() => ({})), Lv.top(200).catch(() => [])]);
      const xp = lv.xp || 0, pr = Lv.progress(xp), i = tops.findIndex((x) => x.uid === uid);
      const stats = { ...st, level: pr.level, subMonths: lv.subMonths || 0, msgs: lv.msgs || 0, hours: Math.floor((lv.mins || 0) / 60) };
      box.className = "";
      box.innerHTML = `<div class="lvrow"><div class="lvnum"><b>${pr.level}</b><small>المستوى</small></div>
        <div class="lvmain"><div class="lvtop"><span>${xp.toLocaleString("en")} XP</span><span class="m">${pr.level >= Lv.MAX ? "المستوى الأقصى" : "باقي " + pr.left.toLocaleString("en") + " للمستوى " + (pr.level + 1)}</span></div>
          <div class="bar"><i style="width:${pr.pct}%"></i></div>
          <div class="lvstats"><span>الرتبة <b>${i >= 0 ? `<span dir="ltr" style="unicode-bidi:isolate">#${i + 1}</span>` : "—"}</b></span><span>الرسائل <b>${stats.msgs.toLocaleString("en")}</b></span><span>ساعات التواجد <b>${stats.hours}</b></span><span>الاشتراك <b>${stats.subMonths ? stats.subMonths + " شهر" : "—"}</b></span></div></div></div>
        <p class="hint" style="text-align:start;margin-top:12px">النقاط من الرسائل بالبث، وتواجدك أثناء البث، واشتراكك بالقناة (كل شهر اشتراك بيرفعك). الأوامر بالشات <span dir="ltr" style="unicode-bidi:isolate">!level</span> <span dir="ltr" style="unicode-bidi:isolate">!top</span></p>`;
      const all = Lv.badges(stats), got = all.filter((b) => b.ok);
      document.getElementById("bdCount").innerHTML = `<span dir="ltr" style="unicode-bidi:isolate">${got.length} / ${all.length}</span>`;
      document.getElementById("bdBox").innerHTML = got.length ? Lv.html(got, esc) : '<div class="hint">لسا ما عندك بادجات — شارك وخمّن وتفاعل بالبث</div>';
      document.getElementById("bdAll").innerHTML = Lv.html(all.filter((b) => !b.ok), esc);
    } catch (e) { console.error(e); box.textContent = "تعذّر تحميل المستوى"; }
  }

  function paintStatus() {
    const dot = document.getElementById("vDot"), tx = document.getElementById("vText"), link = document.getElementById("dLink"), re = document.getElementById("dRe");
    if (!dot) return;
    const d = prof && prof.discord;
    const ok = !!(ver && ver.ok);
    dot.classList.toggle("on", ok);
    link.style.display = d ? "none" : "";                 // بعد الربط مقفول
    link.textContent = "ربط ديسكورد";
    re.style.display = d ? "" : "none";
    tx.textContent = ok ? `موثّق ✓ — ديسكورد: ${d ? d.name : ""}`
      : !d ? "غير مربوط — اربط حساب الديسكورد"
      : ver && ver.status === "banned" ? "حسابك محظور — بتقدر تتفرّج بس."
      : ver && ver.status === "vpn" ? "أوقف الـ VPN/البروكسي وحدّث الصفحة عشان يرجع توثيقك."
      : ver && ver.status === "alt" ? "تم إيقاف توثيق حسابك بسبب تشابه مع حساب آخر. تواصل مع الإدارة لو هذا خطأ."
      : ver && ver.status === "nomember" ? `مربوط (${d.name}) بس حسابك مو موجود بالسيرفر`
      : `مربوط (${d.name}) بس ما عندك رول التوثيق`;
  }

  async function linkDiscord() {
    const b = document.getElementById("dLink"); b.disabled = true;
    try { const r = await api("/discord/start"); if (!r.url) throw new Error(r.error); location.href = r.url; }
    catch (e) { console.error(e); App.toast(String(e.message) === "locked" ? MSG.locked : String(e.message) === "banned" ? MSG.banned : "تعذّر بدء الربط"); b.disabled = false; }
  }
  async function recheck(silent) {
    try {
      const r = await api("/discord/recheck", "POST");
      if (r.error) throw new Error(r.error);
      if (silent !== true) App.toast(r.status === "ok" ? MSG.ok : r.status === "none" ? "اربط حساب الديسكورد أولاً" : MSG[r.status] || MSG.err);
    } catch (e) { if (silent !== true) App.toast("تعذّر تحديث الحالة"); }
  }

  const keyOf = (v) => v.toLowerCase().replace(/\./g, ",");   // مفاتيح Firebase ما تقبل النقطة

  async function save() {
    const sEl = document.getElementById("pStake"), wEl = document.getElementById("pWallet");
    const stake = prof && prof.stake ? "" : sEl.value.trim();       // بنرسل بس الحقول اللي لسا فاضية (المحفوظ مقفول)
    const wallet = prof && prof.wallet ? "" : wEl.value.trim();
    if (!stake && !wallet) return App.toast("اكتب بيانات جديدة أولاً");
    if (stake && !/^[A-Za-z0-9_.-]{2,40}$/.test(stake)) return App.toast("يوزر ستيك غير صالح (أحرف إنجليزية وأرقام فقط)");
    if (wallet && !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return App.toast("عنوان المحفظة غير صالح — لازم يبدأ بـ 0x وطوله 42 خانة");
    if (!confirm("بعد الحفظ ما بتقدر تعدّل هالبيانات، وأي تغيير بيتم عن طريق الإدارة فقط.\nتأكد إنها صحيحة:" + (stake ? "\n\nستيك: " + stake : "") + (wallet ? "\n\nالعنوان: " + wallet : ""))) return;
    const uid = App.user.uid, up = { ["profiles/" + uid + "/updatedAt"]: firebase.database.ServerValue.TIMESTAMP };
    if (stake) { up["profiles/" + uid + "/stake"] = stake; up["stakeIndex/" + keyOf(stake)] = uid; }     // الفهرس يمنع استعمال نفس اليوزر بحساب ثاني
    if (wallet) { up["profiles/" + uid + "/wallet"] = wallet; up["walletIndex/" + keyOf(wallet)] = uid; }
    try { await db.ref().update(up); App.toast("تم الحفظ ✓"); }
    catch (e) {
      console.error(e);
      const [sT, wT] = await Promise.all([stake ? db.ref("stakeIndex/" + keyOf(stake)).once("value").catch(() => null) : null, wallet ? db.ref("walletIndex/" + keyOf(wallet)).once("value").catch(() => null) : null]);
      const dupT = sT && sT.val() && sT.val() !== uid ? "stake" : wT && wT.val() && wT.val() !== uid ? "wallet" : "";
      if (dupT) { try { const tok = await firebase.auth().currentUser.getIdToken(); fetch(C.workerUrl + "/guard/dup", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ type: dupT, key: keyOf(dupT === "stake" ? stake : wallet) }) }).catch(() => {}); } catch (e2) {} }
      App.toast(sT && sT.val() && sT.val() !== uid ? "يوزر ستيك هذا مستخدم بحساب ثاني" : wT && wT.val() && wT.val() !== uid ? "هذا العنوان مستخدم بحساب ثاني" : "فشل الحفظ — يمكن البيانات مقفولة");
    }
  }
})();
