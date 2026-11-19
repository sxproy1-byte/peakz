// لوحة تحكم الأدمن: إنشاء المسابقات، استقبال الدخول من شات كيك، السحب
(function () {
  const { db, esc, C } = App;
  App.shell("giveaways");
  const SV = firebase.database.ServerValue;
  const root = document.getElementById("root");

  let all = {};
  const entries = {};      // gid -> {uid: entry}
  const entryRefs = {};
  let chatroomId = "";
  let ws = null, wsOn = false, wsTimer = null, wantChat = false;

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
        <div class="form">
          <div class="field"><label>Chatroom ID لقناة ${esc(C.streamerSlug)}</label><input id="crid" inputmode="numeric" placeholder="مثال: 12345678"></div>
          <div class="field"><label>&nbsp;</label><div class="row">
            <button class="btn primary" id="crSave">حفظ وتشغيل الربط</button>
            <button class="btn ghost" id="crStop">إيقاف</button></div></div>
        </div>
        <p class="hint" style="margin-top:10px;text-align:start"><span class="dot" id="dot"></span> <span id="chatState">غير متصل</span> — لازم تترك هذي الصفحة مفتوحة خلال البث حتى تنحسب كلمة الشات.</p>
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
      <div class="panel"><h2>📜 المنتهية</h2><div class="alist" id="done"></div></div>`;

    document.getElementById("fCreate").onclick = create;
    document.getElementById("crSave").onclick = saveChat;
    document.getElementById("crStop").onclick = () => { wantChat = false; closeChat(); };

    db.ref("config/chatroomId").once("value").then((s) => {
      chatroomId = s.val() || "";
      document.getElementById("crid").value = chatroomId;
      if (chatroomId) { wantChat = true; openChat(); }
    });

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
      await db.ref("entries/" + b.dataset.del).remove(); await db.ref("giveaways/" + b.dataset.del).remove();
    }));
  }

  // ---------------- شات كيك ----------------
  function setState(on, txt) {
    wsOn = on;
    const dot = document.getElementById("dot"), st = document.getElementById("chatState");
    if (dot) dot.classList.toggle("on", on);
    if (st) st.textContent = txt;
  }
  async function saveChat() {
    const id = val("crid").trim();
    if (!/^\d+$/.test(id)) return App.toast("Chatroom ID لازم يكون أرقام");
    chatroomId = id;
    await db.ref("config/chatroomId").set(id);
    wantChat = true; closeChat(); openChat();
  }
  function closeChat() { clearTimeout(wsTimer); if (ws) { ws.onclose = null; ws.close(); ws = null; } setState(false, "غير متصل"); }
  // مفاتيح Pusher العامة المعروفة لكيك (نجرّبها بالتناوب إذا ما اشتغل الأول)
  const PUSHER_KEYS = ["32cbd69e4b950bf97679", "eb1d5f283081a78b932c"];
  let keyIdx = 0, everUp = false, lastErr = "";
  function openChat() {
    if (!chatroomId || ws) return;
    const key = PUSHER_KEYS[keyIdx % PUSHER_KEYS.length];
    setState(false, "جاري الاتصال... (مفتاح " + ((keyIdx % PUSHER_KEYS.length) + 1) + ")");
    let opened = false;
    ws = new WebSocket("wss://ws-us2.pusher.com/app/" + key + "?protocol=7&client=js&version=8.4.0&flash=false");
    ws.onopen = () => { opened = true; };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.event === "pusher:connection_established") ws.send(JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel: `chatrooms.${chatroomId}.v2` } }));
      else if (m.event === "pusher_internal:subscription_succeeded") { everUp = true; lastErr = ""; setState(true, "متصل بالشات ✓"); }
      else if (m.event === "pusher:error") { lastErr = typeof m.data === "string" ? m.data : JSON.stringify(m.data); console.warn("pusher:error", lastErr); }
      else if (m.event === "pusher:ping") ws.send(JSON.stringify({ event: "pusher:pong", data: {} }));
      else if (m.event === "App\\Events\\ChatMessageEvent") { try { onChat(JSON.parse(m.data)); } catch (x) {} }
    };
    ws.onclose = (ev) => {
      ws = null;
      if (!everUp) keyIdx++;                       // ما اتصل أبداً: جرّب المفتاح الثاني
      const why = lastErr ? " — " + lastErr : (opened ? " — كود " + ev.code : " — تعذّر فتح الاتصال (حاجب إعلانات أو شبكة؟)");
      setState(false, "انقطع الاتصال" + why + " — إعادة المحاولة...");
      if (wantChat) wsTimer = setTimeout(openChat, 3000);
    };
    ws.onerror = () => { console.warn("WebSocket error"); };
  }
  function onChat(d) {
    const text = String(d.content || "").trim().toLowerCase();
    const sender = d.sender;
    if (!text || !sender?.id) return;
    Object.keys(all).forEach((gid) => {
      const g = all[gid];
      if (!isOpen(g) || g.keyword !== text) return;
      const uid = "kick_" + sender.id;
      if ((entries[gid] || {})[uid]) return;
      db.ref(`entries/${gid}/${uid}`).transaction((cur) => cur ? undefined : { name: sender.username, source: "chat", at: SV.TIMESTAMP }).catch(() => {});
    });
  }

  // ---------------- السحب ----------------
  const $ = (id) => document.getElementById(id);
  let dGid = null, winners = [], spinning = false;

  function secureInt(n) {            // رقم عشوائي منتظم بدون انحياز
    const lim = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  }

  function openDraw(gid) {
    dGid = gid; const g = all[gid];
    winners = g.winners ? Object.entries(g.winners).map(([uid, w]) => ({ uid, name: w.name })) : [];
    $("dTitle").textContent = g.title;
    $("dPrize").textContent = g.prize ? "الجائزة: " + g.prize : "";
    $("dInfo").textContent = `${Object.keys(entries[gid] || {}).length} مشارك · ${g.winnersCount} فائز`;
    $("reel").textContent = "—"; $("reel").classList.remove("win");
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

  async function runDraw(count) {
    if (spinning) return;
    const pool = Object.entries(entries[dGid] || {}).map(([uid, e]) => ({ uid, name: e.name }))
      .filter((p) => !winners.some((w) => w.uid === p.uid));
    if (!pool.length) return App.toast("ما في مشاركين متبقين للسحب");
    spinning = true; $("dStart").disabled = $("dMore").disabled = true;
    count = Math.min(count, pool.length);
    for (let i = 0; i < count; i++) {
      const pick = pool.splice(secureInt(pool.length), 1)[0];
      const names = [pick, ...pool].map((p) => p.name);
      $("reel").classList.remove("win");
      const t0 = Date.now(), dur = 4500;
      await new Promise((res) => {
        (function tick() {
          const k = (Date.now() - t0) / dur;
          if (k >= 1) return res();
          $("reel").textContent = names[secureInt(names.length)];
          setTimeout(tick, 50 + k * k * 350);
        })();
      });
      $("reel").textContent = pick.name; $("reel").classList.add("win");
      winners.push(pick); renderWinners();
      await new Promise((r) => setTimeout(r, 1500));
    }
    const obj = {}; winners.forEach((w) => (obj[w.uid] = { name: w.name }));
    await db.ref("giveaways/" + dGid).update({ winners: obj, status: "drawn", drawnAt: SV.TIMESTAMP, entriesCount: Object.keys(entries[dGid] || {}).length });
    spinning = false; $("dStart").disabled = $("dMore").disabled = false;
    $("dStart").style.display = "none"; $("dMore").style.display = "";
    App.toast("تم حفظ الفائزين ✓");
  }
})();
