// إدارة البونص هانت (أدمن): إنشاء، جمع البونصات، فتح/قفل/تمديد التخمين، التفتيح، إنهاء وإعلان الفائزين
(function () {
  const { db, esc, C } = App;
  App.shell("bonus");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("root");
  const M = Hunt.money, X = Hunt.xfmt;
  let hunts = {}, started = false;
  const guesses = {}, gRefs = {};
  const keep = {};                                   // قيم حقول الإدخال اللي ما انحفظت لسا

  App.onUser((u) => {
    if (!u) {
      root.innerHTML = `<div class="empty"><div>سجّل دخولك بحساب الأدمن على كيك</div><div class="center"><button class="btn primary" id="l">تسجيل الدخول بكيك</button></div></div>`;
      document.getElementById("l").onclick = () => App.login("admin-bonus.html");
    } else if (!u.admin) root.innerHTML = `<div class="empty"><div>حسابك (${esc(u.name)}) مو أدمن</div></div>`;
    else start();
  });

  function start() {
    if (started) return; started = true;
    root.innerHTML = `
      <h1 class="plain">لوحة التحكم</h1><div class="atabs"><a href="admin.html">🎟️ المسابقات</a><a href="admin-bonus.html" class="on">🎯 البونص هانت</a><a href="admin-tournaments.html">⚔️ البطولات</a></div>
      ${App.overlayPanel("overlay-bonus.html", "البونص هانت", "بـ OBS: Sources ← Browser ← الصق الرابط. الحجم 440×320 (أو أي حجم بنفس النسبة). بيعرض آخر هانت شغّال تلقائياً: الرصيد، البريك إيفن، قائمة البونصات مع الملاحظات.")}
      <div class="panel"><h2>➕ هانت جديد</h2><div class="form">
        <div class="field"><label>العنوان</label><input id="cTitle" placeholder="بونص هانت الجمعة"></div>
        <div class="field"><label>العملة</label><input id="cCur" value="$" maxlength="4"></div>
        <div class="field"><label>رصيد البداية (اختياري)</label><input id="cStart" type="number" min="0" step="any" placeholder="1000"></div>
        <div class="field"><label>جائزة المركز 1</label><input id="cP1" placeholder="$100"></div>
        <div class="field"><label>جائزة المركز 2</label><input id="cP2" placeholder="$50"></div>
        <div class="field"><label>جائزة المركز 3</label><input id="cP3" placeholder="$25"></div>
        <div class="field"><label>&nbsp;</label><button class="btn primary" id="cGo" style="width:100%">إنشاء</button></div></div></div>
      <datalist id="notes"><option value="سوبر"><option value="إيبيك"><option value="ميغا"><option value="3 سكاتر"><option value="4 سكاتر"><option value="5 سكاتر"><option value="6 سكاتر"></datalist><div id="active"></div>
      <div class="panel"><h2>📜 المنتهية</h2><div class="alist" id="done"></div></div>`;
    document.getElementById("cGo").onclick = create;
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.keep) keep[e.target.id] = e.target.value; });
    db.ref("hunts").orderByChild("createdAt").limitToLast(30).on("value", (s) => { hunts = s.val() || {}; attach(); renderAll(); });
    setInterval(tickTimers, 1000);
  }

  function attach() {
    Object.entries(hunts).forEach(([hid, h]) => {
      if (gRefs[hid]) return;
      gRefs[hid] = db.ref("huntGuesses/" + hid);
      gRefs[hid].on("value", (s) => { guesses[hid] = s.val() || {}; renderGuesses(hid); }, () => {});
    });
  }

  async function create() {
    const v = (id) => document.getElementById(id).value.trim();
    const title = v("cTitle") || "بونص هانت";
    const st = v("cStart");
    try {
      await db.ref("hunts").push({
        title, currency: v("cCur") || "$", startBalance: st === "" ? null : Math.max(0, Number(st) || 0),
        prizes: [v("cP1"), v("cP2"), v("cP3")], phase: "collecting", guessOpen: false, createdAt: SV.TIMESTAMP,
      });
      ["cTitle", "cStart", "cP1", "cP2", "cP3"].forEach((id) => (document.getElementById(id).value = ""));
      App.toast("تم إنشاء الهانت 🎯");
    } catch (e) { console.error(e); App.toast("فشل الإنشاء — تأكد من قواعد Firebase"); }
  }

  // ------------------------------------------------ الرسم
  const guessOpen = (h) => h.phase === "collecting" && h.guessOpen === true && (!h.guessEndsAt || h.guessEndsAt > App.now());
  const fmt = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };
  const PH = { collecting: "جمع البونصات", opening: "جاري التفتيح", ended: "انتهى" };

  function panel(hid, h) {
    const S = Hunt.stats(h.bonuses, h.startBalance), open = guessOpen(h);
    const timer = open && h.guessEndsAt ? ` <b class="gtimer" data-end="${h.guessEndsAt}">${fmt(h.guessEndsAt - App.now())}</b>` : "";
    let ctl = h.phase !== "ended" ? `<button class="btn ghost small" data-act="manualGuess" data-hid="${hid}">➕ تخمين يدوي</button>` : "";
    if (h.phase === "collecting") {
      ctl += open
        ? `<button class="btn danger small" data-act="closeGuess" data-hid="${hid}">🔒 قفل التخمين</button>
           <input id="ex-${hid}" data-keep="1" type="number" min="1" step="any" placeholder="دقائق" style="width:90px;padding:7px 10px;border-radius:11px;border:1px solid var(--line);background:rgba(5,7,15,.6)">
           <button class="btn ghost small" data-act="extend" data-hid="${hid}">⏱ تمديد</button>`
        : `<input id="gm-${hid}" data-keep="1" type="number" min="1" placeholder="دقائق (فاضي = بدون مؤقت)" style="width:210px;padding:7px 12px;border-radius:11px;border:1px solid var(--line);background:rgba(5,7,15,.6)">
           <button class="btn primary small" data-act="openGuess" data-hid="${hid}">🔓 فتح / إعادة فتح التخمين</button>`;
      ctl += `<button class="btn primary small" data-act="startOpening" data-hid="${hid}">▶ إنهاء جمع البونصات وبدء التفتيح</button>`;
    } else if (h.phase === "opening") {
      ctl += `<button class="btn ghost small" data-act="backCollect" data-hid="${hid}">↩ رجوع لمرحلة الجمع</button>
              <button class="btn primary small" data-act="endHunt" data-hid="${hid}">🏁 إنهاء الهانت وإعلان الفائزين</button>`;
    }
    const rows = S.list.map((b, i) => {
      const x = b.payout !== null && b.bet > 0 ? b.payout / b.bet : null;
      return `<tr class="${b.id === S.nextId && h.phase === "opening" ? "next" : ""}"><td>${i + 1}</td>
        <td><input class="ci" data-fld="slot" data-hid="${hid}" data-bid="${b.id}" value="${esc(b.slot)}" maxlength="60"></td>
        <td><input class="ci n" type="number" min="0" step="any" data-fld="bet" data-hid="${hid}" data-bid="${b.id}" value="${b.bet}"></td>
        <td style="white-space:nowrap"><input class="ci" list="notes" data-fld="note" data-hid="${hid}" data-bid="${b.id}" value="${esc(b.note)}" maxlength="30" style="min-width:110px;width:130px" placeholder="—"> <select class="ci" data-fld="nc" data-hid="${hid}" data-bid="${b.id}" style="width:62px;min-width:0;padding:7px 4px">${["g","p","k","r","b"].map((c) => `<option value="${c}" ${b.nc === c ? "selected" : ""}>${{g:"🟡",p:"🟣",k:"🟢",r:"🔴",b:"🔵"}[c]}</option>`).join("")}</select></td>
        <td><input class="ci n" type="number" min="0" step="any" data-fld="payout" data-hid="${hid}" data-bid="${b.id}" value="${b.payout === null ? "" : b.payout}" placeholder="${b.id === S.nextId && h.phase === "opening" ? "اكتب الربح ◀" : "—"}"></td>
        <td>${X(x)}</td><td><button class="btn danger small" data-act="delBonus" data-hid="${hid}" data-bid="${b.id}">✕</button></td></tr>`;
    }).join("");
    return `<div class="panel" id="p-${hid}">
      <div class="hh"><h3>${esc(h.title)} <span class="badge ${h.phase === "ended" ? "" : "open"}">${PH[h.phase]}</span></h3>
        <span>${h.phase === "collecting" ? `التخمين: ${open ? '<span class="badge open">مفتوح</span>' + timer : '<span class="badge">مقفول</span>'}` : ""}</span></div>
      <div class="tiles"><div class="tile"><small>البونصات</small><b>${S.openedCount}/${S.count}</b></div><div class="tile"><small>إجمالي الربح</small><b>${M(S.totalWin, h.currency)}</b></div>
        <div class="tile"><small>متوسط x</small><b>${X(S.avgX)}</b></div>
        ${h.startBalance != null ? `<div class="tile"><small>للتعادل</small><b>${S.beX === null ? "—" : X(S.beX)}</b></div>${S.openedCount ? `<div class="tile"><small>الربح/الخسارة</small><b class="${S.profit >= 0 ? "up" : "down"}">${M(S.profit, h.currency)}</b></div>` : ""}` : ""}</div>
      <div class="row" style="margin:12px 0">${ctl}<button class="btn danger small" data-act="delHunt" data-hid="${hid}" style="margin-inline-start:auto">حذف الهانت</button></div>
      <h4 class="sub">البونصات</h4>
      <div class="row" style="margin-bottom:10px"><input class="ci" id="bs-${hid}" data-keep="1" placeholder="اسم السلوت" style="flex:1;min-width:160px" maxlength="60">
        <input class="ci n" id="bb-${hid}" data-keep="1" type="number" min="0" step="any" placeholder="الرهان" style="width:110px">
        <input class="ci" id="bn-${hid}" data-keep="1" list="notes" placeholder="ملاحظة (اختياري): سوبر، إيبيك، 4 سكاتر..." style="flex:1;min-width:150px" maxlength="30">
        <select class="ci" id="bc-${hid}" data-keep="1" style="width:110px;min-width:0"><option value="g">🟡 ذهبي</option><option value="p">🟣 بنفسجي</option><option value="k">🟢 أخضر</option><option value="r">🔴 أحمر</option><option value="b">🔵 أزرق</option></select>
        <button class="btn primary small" data-act="addBonus" data-hid="${hid}">+ أضف بونص</button></div>
      ${S.count ? `<div class="tw"><table class="btable"><thead><tr><th>#</th><th>السلوت</th><th>الرهان</th><th>ملاحظة</th><th>الربح (فتحه)</th><th>x</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="msg">أضف أول بونص.</div>`}
      <h4 class="sub">التخمينات <small id="gc-${hid}" style="color:var(--muted);font-weight:400"></small></h4>
      <div id="gt-${hid}"></div></div>`;
  }

  function renderAll() {
    if (!started) return;
    const act = document.getElementById("active"); if (!act) return;
    const ids = Object.keys(hunts).sort((a, b) => hunts[b].createdAt - hunts[a].createdAt);
    const run = ids.filter((id) => hunts[id].phase !== "ended"), fin = ids.filter((id) => hunts[id].phase === "ended");
    act.innerHTML = run.length ? run.map((id) => panel(id, hunts[id])).join("") : `<div class="panel"><div class="msg">ما في هانت نشط. أنشئ واحد من فوق.</div></div>`;
    Object.entries(keep).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });   // رجّع اللي كان مكتوب
    run.forEach(renderGuesses);
    document.getElementById("done").innerHTML = fin.length ? fin.map((id) => {
      const h = hunts[id], f = h.final || {}, w = (f.winners || []).map((x) => `${x.rank}) ${esc(x.name)}${x.prize ? " (" + esc(x.prize) + ")" : ""}`).join(" · ") || "—";
      return `<div class="aitem"><div class="info"><b>${esc(h.title)}</b><small>الإجمالي ${M(f.totalWin, h.currency)} · ${f.guessCount ?? 0} تخمين · ${w}</small></div>
        <button class="btn ghost small" data-act="reopenEnded" data-hid="${id}">↩ تراجع (رجوع للتفتيح)</button><button class="btn danger small" data-act="delHunt" data-hid="${id}">حذف</button></div>`;
    }).join("") : `<div class="msg">لسا ما في هانت منتهي.</div>`;
  }

  function renderGuesses(hid) {
    const h = hunts[hid], box = document.getElementById("gt-" + hid); if (!h || !box) return;
    const g = guesses[hid] || {}, n = Object.keys(g).length;
    document.getElementById("gc-" + hid).textContent = `(${n})`;
    if (!n) { box.innerHTML = `<div class="msg">لسا ما في تخمينات.</div>`; return; }
    if (h.phase === "opening") {                                   // ترتيب مباشر حسب الإجمالي الحالي
      const S = Hunt.stats(h.bonuses, h.startBalance), rk = Hunt.rank(g, S.totalWin, h.prizes);
      box.innerHTML = `<div class="hint" style="margin-bottom:8px">الترتيب حسب الإجمالي الحالي (${M(S.totalWin, h.currency)}) ويتحدّث مع كل بونص.</div><div class="tw"><table class="btable"><thead><tr><th>المركز</th><th>الاسم</th><th>التخمين</th><th>الفرق</th></tr></thead><tbody>` +
        rk.map((r) => `<tr class="${r.rank <= 3 ? "good" : ""}"><td>${r.rank}</td><td>${esc(r.name)}</td><td>${M(r.value, h.currency)}</td><td>${M(r.diff, h.currency)}</td></tr>`).join("") + `</tbody></table></div>`;
    } else {
      const arr = Object.entries(g).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      box.innerHTML = `<div class="tw"><table class="btable"><thead><tr><th>الاسم</th><th>التخمين</th><th>الوقت</th></tr></thead><tbody>` +
        arr.map(([, x]) => `<tr><td>${esc(x.name)}</td><td>${M(x.value, h.currency)}</td><td>${x.at ? new Date(x.at).toLocaleTimeString(window.I18N && I18N.lang === "en" ? "en-US" : "ar", { hour: "2-digit", minute: "2-digit" }) : ""}</td></tr>`).join("") + `</tbody></table></div>`;
    }
  }

  function tickTimers() {
    let expired = false;
    root.querySelectorAll(".gtimer[data-end]").forEach((t) => { const l = Number(t.dataset.end) - App.now(); if (l <= 0) expired = true; else t.textContent = fmt(l); });
    if (expired) renderAll();
  }

  // ------------------------------------------------ الإجراءات
  const ref = (hid, p) => db.ref("hunts/" + hid + (p ? "/" + p : ""));
  const fail = (e) => { console.error(e); App.toast("فشل — تأكد من الصلاحيات"); };

  async function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, hid = b.dataset.hid, h = hunts[hid];
    try {
      if (act === "openGuess") {
        const m = Number(document.getElementById("gm-" + hid).value);
        await ref(hid).update({ guessOpen: true, guessEndsAt: m > 0 ? App.now() + m * 60000 : null }); delete keep["gm-" + hid];
      } else if (act === "manualGuess") {
        const name = (prompt("اسم المخمّن:") || "").trim().slice(0, 40); if (!name) return;
        const v = Number((prompt("تخمين " + name + " (إجمالي الربح):") || "").replace(/,/g, ""));
        if (!(v >= 0) || !isFinite(v) || String(v) === "") return App.toast("اكتب رقم صحيح");
        await db.ref("huntGuesses/" + hid + "/" + App.manualKey(name)).set({ name, value: v, at: SV.TIMESTAMP, source: "manual" });
        App.toast("تمت إضافة تخمين " + name + " ✓");
      } else if (act === "closeGuess") await ref(hid).update({ guessOpen: false });
      else if (act === "extend") { const m = Number(document.getElementById("ex-" + hid).value); if (!(m > 0)) return App.toast("اكتب عدد الدقائق"); delete keep["ex-" + hid]; await ref(hid).update({ guessOpen: true, guessEndsAt: Math.max(App.now(), h.guessEndsAt || 0) + m * 60000 }); }
      else if (act === "startOpening") {
        if (confirm("إنهاء جمع البونصات وبدء التفتيح؟ التخمين رح ينقفل.")) await ref(hid).update({ phase: "opening", guessOpen: false, guessEndsAt: null, openingAt: SV.TIMESTAMP });
      } else if (act === "backCollect") await ref(hid).update({ phase: "collecting" });
      else if (act === "endHunt") await endHunt(hid, h);
      else if (act === "reopenEnded") { if (confirm("تراجع عن الإنهاء ورجوع الهانت لمرحلة التفتيح؟")) await ref(hid).update({ phase: "opening", final: null, endedAt: null }); }
      else if (act === "delHunt") { if (confirm("حذف الهانت وكل تخميناته؟ ما في رجعة.")) { await ref(hid).remove(); await db.ref("huntGuesses/" + hid).remove(); } }
      else if (act === "addBonus") {
        const slot = document.getElementById("bs-" + hid).value.trim(), bet = Number(document.getElementById("bb-" + hid).value);
        if (!slot || !isFinite(bet) || bet < 0 || document.getElementById("bb-" + hid).value === "") return App.toast("اكتب اسم السلوت والرهان");
        const note = document.getElementById("bn-" + hid).value.trim(), nc = document.getElementById("bc-" + hid).value, nb = { slot, bet };
        if (note) { nb.note = note; nb.nc = nc; }
        await ref(hid, "bonuses").push(nb);
        delete keep["bn-" + hid]; document.getElementById("bn-" + hid).value = "";
        delete keep["bs-" + hid]; delete keep["bb-" + hid]; document.getElementById("bs-" + hid).value = ""; document.getElementById("bb-" + hid).value = ""; document.getElementById("bs-" + hid).focus();
      } else if (act === "delBonus") { if (confirm("حذف هذا البونص؟")) await ref(hid, "bonuses/" + b.dataset.bid).remove(); }
    } catch (err) { fail(err); }
  }

  async function onChange(e) {
    const el = e.target, f = el.dataset && el.dataset.fld; if (!f) return;
    const path = "bonuses/" + el.dataset.bid + "/" + f, v = el.value.trim();
    try {
      if (f === "note") { if (v) await ref(el.dataset.hid, path).set(v); else await ref(el.dataset.hid, path).remove(); }
      else if (f === "nc") await ref(el.dataset.hid, path).set(el.value);
      else if (f === "slot") { if (!v) return renderAll(); await ref(el.dataset.hid, path).set(v); }
      else if (f === "bet") { const n = Number(v); if (v === "" || !isFinite(n) || n < 0) return renderAll(); await ref(el.dataset.hid, path).set(n); }
      else { const n = Number(v); if (v === "") await ref(el.dataset.hid, path).remove(); else if (isFinite(n) && n >= 0) await ref(el.dataset.hid, path).set(n); else renderAll(); }
    } catch (err) { fail(err); }
  }

  async function endHunt(hid, h) {
    const S = Hunt.stats(h.bonuses, h.startBalance), g = guesses[hid] || {}, rk = Hunt.rank(g, S.totalWin, h.prizes);
    const left = S.count - S.openedCount;
    const top = rk.slice(0, 3).map((r) => `${r.rank}) ${r.name} — ${M(r.value, h.currency)}${r.prize ? " (" + r.prize + ")" : ""}`).join("\n") || "ما في تخمينات";
    if (!confirm((left ? `⚠️ فيه ${left} بونص لسا ما انفتح (ما اتحسب).\n\n` : "") + `الإجمالي النهائي: ${M(S.totalWin, h.currency)}\nعدد التخمينات: ${rk.length}\n\nالفائزون:\n${top}\n\nتثبيت النتيجة وإنهاء الهانت؟`)) return;
    const winners = rk.slice(0, 3).map(({ rank, uid, name, value, diff, prize }) => ({ rank, uid, name, value, diff, prize: prize || "" }));
    await ref(hid).update({ phase: "ended", guessOpen: false, guessEndsAt: null, endedAt: SV.TIMESTAMP, final: { totalWin: S.totalWin, guessCount: rk.length, winners } });
    App.toast("تم إنهاء الهانت وإعلان الفائزين 🏆");
  }
})();
