// صفحة البونص هانت للمستخدمين: عرض الهانت + التخمين + النتائج
(function () {
  const { db, esc, C } = App;
  App.shell("bonus");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("list");
  const M = Hunt.money, X = Hunt.xfmt;

  let tab = "current", hunts = {};
  const guessAll = {}, guessRefs = {};     // hid -> {uid: guess}  (للمنتهي، قراءة عامة)
  const mine = {}, mineRef = {};           // hid -> تخميني
  const draft = {};                        // ما كتبه المستخدم ولسا ما أرسله

  document.querySelectorAll(".tabs button").forEach((b) => {
    b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b)); render(); };
  });
  App.onUser((u) => {
    document.getElementById("adminLink").style.display = u && u.admin ? "" : "none";
    Object.values(mineRef).forEach((r) => r.off()); for (const k in mineRef) delete mineRef[k]; for (const k in mine) delete mine[k];
    attach(); render();
  });

  db.ref("hunts").orderByChild("createdAt").limitToLast(30).on("value", (s) => { hunts = s.val() || {}; attach(); render(); });

  function attach() {
    Object.entries(hunts).forEach(([hid, h]) => {
      if (h.phase === "ended") {
        if (!guessRefs[hid]) { guessRefs[hid] = db.ref("huntGuesses/" + hid); guessRefs[hid].on("value", (s) => { guessAll[hid] = s.val() || {}; render(); }, () => {}); }
      } else if (App.user && !mineRef[hid]) {
        mineRef[hid] = db.ref("huntGuesses/" + hid + "/" + App.user.uid);
        mineRef[hid].on("value", (s) => { mine[hid] = s.val(); render(); }, () => {});
      }
    });
  }

  const guessOpen = (h) => h.phase === "collecting" && h.guessOpen === true && (!h.guessEndsAt || h.guessEndsAt > App.now());
  const fmt = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0"); };
  const PH = { collecting: ["جمع البونصات", "open"], opening: ["جاري التفتيح", "open"], ended: ["انتهى", ""] };

  function guessBox(hid, h) {
    if (h.phase !== "collecting") return "";
    const my = mine[hid], open = guessOpen(h);
    const timer = open && h.guessEndsAt ? `<span class="gtimer" data-end="${h.guessEndsAt}">${fmt(h.guessEndsAt - App.now())}</span>` : "";
    let body;
    if (!App.user) body = `<button class="btn primary" data-login="1">سجّل دخول بكيك للتخمين</button>`;
    else if (App.verified === false) body = `<a class="btn primary" href="profile.html">⚠️ وثّق حسابك أولاً لتخمّن</a>`;
    else if (open) body = `<div class="grow"><input type="number" inputmode="decimal" min="0" step="any" id="g-${hid}" placeholder="إجمالي الربح المتوقع ${esc(h.currency || "$")}" value="${esc(draft[hid] ?? (my ? my.value : ""))}">
        <button class="btn primary" data-guess="${hid}">${my ? "حدّث تخمينك" : "خمّن"}</button></div>`;
    else body = `<span class="hint">التخمين مقفول حالياً</span>`;
    return `<div class="gbox"><div class="gtop"><b>🎯 تخمينك</b>${open ? `<span class="badge open">التخمين مفتوح</span>${timer}` : `<span class="badge">مقفول</span>`}</div>
      ${my ? `<div class="mine">تخمينك الحالي: <b>${M(my.value, h.currency)}</b></div>` : ""}${body}
      <div class="hint">خمّن إجمالي ربح كل البونصات بعد التفتيح. تقدر تعدّل تخمينك لين ينقفل.</div></div>`;
  }

  function table(hid, h, S) {
    if (!S.count) return `<div class="msg">لسا ما انضافت بونصات.</div>`;
    return `<div class="tw"><table class="btable"><thead><tr><th>#</th><th>السلوت</th><th>الرهان</th><th>الربح</th><th>x</th></tr></thead><tbody>` +
      S.list.map((b, i) => {
        const opened = b.payout !== null, x = opened && b.bet > 0 ? b.payout / b.bet : null;
        const cls = (b.id === S.nextId && h.phase === "opening" ? "next " : "") + (x >= 100 ? "hot" : x >= 25 ? "good" : "");
        return `<tr class="${cls}"><td>${i + 1}</td><td>${esc(b.slot)}${b.note ? ` <span class="nchip" style="${Hunt.noteStyle(b.nc)}">${esc(b.note)}</span>` : ""}</td><td>${M(b.bet, h.currency)}</td><td>${opened ? M(b.payout, h.currency) : "—"}</td><td>${opened ? X(x) : b.id === S.nextId && h.phase === "opening" ? "التالي ▶" : "—"}</td></tr>`;
      }).join("") + `</tbody></table></div>`;
  }

  function ended(hid, h) {
    const f = h.final || {}, ws = f.winners || [];
    const medals = ["🥇", "🥈", "🥉"];
    let html = `<div class="result"><div class="rt">الإجمالي النهائي: <b>${M(f.totalWin, h.currency)}</b></div>
      <div class="podium">${ws.length ? ws.map((w, i) => `<div class="pod p${i + 1}"><div class="pm">${medals[i] || ""}</div><b>${esc(w.name)}</b>
        <small>تخمينه ${M(w.value, h.currency)} · فرق ${M(w.diff, h.currency)}</small>${w.prize ? `<span class="chip">${esc(w.prize)}</span>` : ""}</div>`).join("") : `<div class="msg">ما كان في تخمينات.</div>`}</div></div>`;
    const g = guessAll[hid];
    if (g && Object.keys(g).length) {
      const rk = Hunt.rank(g, f.totalWin, h.prizes);
      html += `<details class="gd"><summary>كل التخمينات (${rk.length})</summary><div class="tw"><table class="btable"><thead><tr><th>المركز</th><th>الاسم</th><th>التخمين</th><th>الفرق</th></tr></thead><tbody>` +
        rk.map((r) => `<tr class="${r.rank <= 3 ? "good" : ""}"><td>${r.rank}</td><td>${esc(r.name)}</td><td>${M(r.value, h.currency)}</td><td>${M(r.diff, h.currency)}</td></tr>`).join("") + `</tbody></table></div></details>`;
    }
    return html;
  }

  function card(hid, h) {
    const S = Hunt.stats(h.bonuses, h.startBalance), ph = PH[h.phase] || PH.collecting, hasStart = h.startBalance != null;
    const tiles = [
      ["البونصات", `${S.openedCount}/${S.count}`], ["إجمالي الربح", M(S.totalWin, h.currency)], ["متوسط x", X(S.avgX)],
      ...(hasStart ? [["البداية", M(h.startBalance, h.currency)], ["للتعادل", S.beX === null ? "—" : X(S.beX)], ["الربح/الخسارة", `<span class="${S.profit >= 0 ? "up" : "down"}">${M(S.profit, h.currency)}</span>`]] : []),
    ];
    return `<section class="hunt"><div class="hh"><h3>${esc(h.title)}</h3><span class="badge ${ph[1]}">${ph[0]}</span></div>
      <div class="tiles">${tiles.map(([k, v]) => `<div class="tile"><small>${k}</small><b>${v}</b></div>`).join("")}</div>
      ${S.best ? `<div class="best">⭐ أفضل بونص: <b>${esc(S.best.slot)}</b> — ${M(S.best.payout, h.currency)} (${X(S.best.x)})</div>` : ""}
      ${h.phase === "ended" ? ended(hid, h) : guessBox(hid, h)}
      <h4 class="sub">البونصات</h4>${table(hid, h, S)}</section>`;
  }

  function render() {
    // نحفظ ما كتبه المستخدم قبل إعادة الرسم
    root.querySelectorAll("input[id^=g-]").forEach((i) => (draft[i.id.slice(2)] = i.value));
    const ids = Object.keys(hunts).sort((a, b) => hunts[b].createdAt - hunts[a].createdAt);
    const list = ids.filter((id) => (tab === "past") === (hunts[id].phase === "ended"));
    root.innerHTML = list.length ? list.map((id) => card(id, hunts[id])).join("")
      : `<div class="empty"><span class="em">🎯</span>${tab === "past" ? "لسا ما في هانت منتهي." : "لا يوجد بونص هانت نشط حالياً."}</div>`;
    root.querySelectorAll("[data-login]").forEach((b) => (b.onclick = () => App.login("bonus.html")));
    root.querySelectorAll("[data-guess]").forEach((b) => (b.onclick = () => submit(b.dataset.guess, b)));
    root.querySelectorAll("input[id^=g-]").forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(i.id.slice(2)); }));
  }

  async function submit(hid, btn) {
    const el = document.getElementById("g-" + hid), v = Number(el && el.value);
    if (!el || el.value.trim() === "" || !isFinite(v) || v < 0 || v > 1e9) return App.toast("اكتب رقم صحيح");
    if (btn) btn.disabled = true;
    try { await db.ref("huntGuesses/" + hid + "/" + App.user.uid).set({ name: App.user.name, value: v, at: SV.TIMESTAMP }); delete draft[hid]; App.toast("تم حفظ تخمينك ✓"); }
    catch (e) { console.error(e); App.toast("ما انقبل التخمين — يمكن انقفل أو حسابك مو موثّق"); }
    if (btn) btn.disabled = false;
  }

  setInterval(() => {
    let expired = false;
    root.querySelectorAll(".gtimer[data-end]").forEach((t) => { const l = Number(t.dataset.end) - App.now(); if (l <= 0) expired = true; else t.textContent = fmt(l); });
    if (expired) render();
  }, 1000);
})();
