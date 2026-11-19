// صفحة المسابقات للمستخدمين
(function () {
  const { db, esc, C } = App;
  App.shell("giveaways");

  let tab = "current";
  let all = {};                 // giveaways
  const entries = {};           // gid -> {uid: entry}
  const entryRefs = {};         // gid -> ref (مستمعات الدخول)

  document.querySelectorAll(".tabs button").forEach((b) => {
    b.onclick = () => {
      tab = b.dataset.tab;
      document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
      render();
    };
  });

  db.ref("giveaways").orderByChild("createdAt").limitToLast(60).on("value", (s) => {
    all = s.val() || {};
    // استمع لدخول المسابقات الحالية فقط
    Object.keys(all).forEach((gid) => {
      if (isDone(all[gid]) || entryRefs[gid]) return;
      entryRefs[gid] = db.ref("entries/" + gid);
      entryRefs[gid].on("value", (es) => { entries[gid] = es.val() || {}; render(); });
    });
    render();
  });
  App.onUser(render);

  const isDone = (g) => g.status === "drawn" || g.status === "closed";
  const isOpen = (g) => g.status === "open" && g.endsAt > App.now();
  const fmt = (ms) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? String(h).padStart(2, "0") + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };

  function card(gid, g) {
    const done = isDone(g), open = isOpen(g);
    const ent = entries[gid] || {};
    const count = done ? (g.entriesCount ?? 0) : Object.keys(ent).length;
    const winners = g.winners ? Object.values(g.winners) : [];
    const mine = App.user && ent[App.user.uid];
    const badge = done ? '<span class="badge">COMPLETED</span>' : open ? '<span class="badge open">LIVE</span>' : '<span class="badge wait">PENDING DRAW</span>';
    let action = "";
    if (!done) {
      if (open) {
        const btn = !App.user ? `<button class="btn primary" data-login="1">سجّل دخول بكيك للمشاركة</button>`
          : mine ? `<button class="btn ghost" disabled>✓ تم دخولك السحب</button>`
          : `<button class="btn primary" data-enter="${gid}">ادخل السحب</button>`;
        action = `<div class="timer" data-end="${g.endsAt}">${fmt(g.endsAt - App.now())}</div>${btn}
          <div class="hint">أو اكتب <code>${esc(g.keyword || C.defaultKeyword)}</code> بشات ${esc(C.streamerSlug)} على كيك</div>`;
      } else {
        action = `<div class="timer wait">انتهى وقت الدخول — بانتظار السحب على البث</div>`;
      }
    } else {
      action = winners.length
        ? `<div class="winners"><small>الفائزون</small><div class="chips">${winners.map((w) => `<span class="chip">🏆 ${esc(w.name)}</span>`).join("")}</div></div>`
        : `<div class="hint">لا يوجد فائزون</div>`;
    }
    return `<div class="ticket">
      <div class="t-stub">${badge}<div class="big">${esc(g.prize || "🎁")}</div><small>الجائزة</small></div>
      <div class="t-body"><h3>${esc(g.title)}</h3>
        <div class="meta"><span>👥 <b>${count}</b> مشارك</span><span>🏆 <b>${g.winnersCount || 1}</b> فائز</span></div>
        ${action}</div></div>`;
  }

  function render() {
    const ids = Object.keys(all).sort((a, b) => all[b].createdAt - all[a].createdAt);
    const list = ids.filter((id) => (tab === "past") === isDone(all[id]));
    const el = document.getElementById("list");
    if (!list.length) {
      el.innerHTML = `<div class="empty"><span class="em">🎟️</span><div>${tab === "current" ? "ما في سحوبات حالياً، ترقّب البث قريباً" : "لا توجد مسابقات سابقة"}</div></div>`;
      return;
    }
    el.innerHTML = `<div class="tickets">${list.map((id) => card(id, all[id])).join("")}</div>`;
    el.querySelectorAll("[data-login]").forEach((b) => (b.onclick = () => App.login("index.html")));
    el.querySelectorAll("[data-enter]").forEach((b) => (b.onclick = () => enter(b.dataset.enter, b)));
  }

  async function enter(gid, btn) {
    btn.disabled = true;
    try {
      await db.ref(`entries/${gid}/${App.user.uid}`).set({ name: App.user.name, source: "site", at: firebase.database.ServerValue.TIMESTAMP });
      App.toast("تم دخولك السحب، بالتوفيق!");
    } catch (e) {
      console.error(e);
      App.toast("ما قدرنا ندخلك — يمكن انتهى الوقت");
      btn.disabled = false;
    }
  }

  // العدّاد: تحديث كل ثانية، وإعادة رسم لما يخلص الوقت
  setInterval(() => {
    let expired = false;
    document.querySelectorAll(".timer[data-end]").forEach((t) => {
      const left = Number(t.dataset.end) - App.now();
      if (left <= 0) expired = true; else t.textContent = fmt(left);
    });
    if (expired) render();
  }, 1000);
})();
