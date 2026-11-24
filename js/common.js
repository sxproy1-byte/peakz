// الأساس المشترك: Firebase + تسجيل الدخول بكيك + الشريط الجانبي
(function () {
  const C = window.CONFIG;
  firebase.initializeApp(C.firebase);
  const auth = firebase.auth();
  const db = firebase.database();

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const App = (window.App = { C, auth, db, esc, user: null, verified: null, offset: 0, listeners: [] });
  App.now = () => Date.now() + App.offset;
  db.ref(".info/serverTimeOffset").on("value", (s) => (App.offset = s.val() || 0));

  App.toast = (t) => {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = t;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  };

  App.login = (returnTo) => {
    const r = returnTo ? "?r=" + encodeURIComponent(returnTo) : "";
    location.href = C.workerUrl + "/login" + r;
  };
  App.logout = () => auth.signOut().then(() => location.reload());
  // تنبيه ديسكورد (للأدمن): يطلب من الـ Worker يرسل رسالة عن مسابقة/هانت/بطولة جديدة. فشله ما يأثر على الإنشاء
  App.notify = async (type, id) => {
    try {
      const t = await auth.currentUser.getIdToken();
      const r = await fetch(C.workerUrl + "/guard/notify", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ type, id }) });
      return await r.json().catch(() => ({}));
    } catch (e) { return null; }
  };
  // نافذة تأكيد تسجيل الخروج
  App.confirmLogout = () => {
    if (document.getElementById("logoutModal")) return;
    const m = document.createElement("div"); m.id = "logoutModal"; m.className = "lo-modal";
    m.innerHTML = `<div class="lo-box" role="dialog" aria-modal="true"><h3>تسجيل الخروج</h3><p>هل تريد حقاً تسجيل الخروج؟</p>
      <div class="lo-btns"><button type="button" class="btn ghost" id="loNo">إلغاء</button><button type="button" class="btn danger" id="loYes">تسجيل الخروج</button></div></div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    document.getElementById("loNo").onclick = close;
    document.getElementById("loYes").onclick = () => { close(); App.logout(); };
    m.addEventListener("click", (e) => { if (e.target === m) close(); });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", k); } });
  };
  document.addEventListener("click", (e) => { const m = document.getElementById("umenu"); if (m && !m.hidden && !e.target.closest(".uwrap")) { m.hidden = true; const c = document.getElementById("uchip"); if (c) c.setAttribute("aria-expanded", "false"); } });
  App.onUser = (fn) => App.listeners.push(fn);

  // التوكن العائد من الـ Worker يجي بالـ hash: #token=...&avatar=...
  async function consumeToken() {
    if (!location.hash.includes("token=")) return;
    const p = new URLSearchParams(location.hash.slice(1));
    const token = p.get("token");
    const avatar = p.get("avatar");
    history.replaceState(null, "", location.pathname + location.search);
    if (avatar) try { localStorage.setItem("avatar", avatar); } catch (e) {}
    if (token) {
      try { await auth.signInWithCustomToken(token); }
      catch (e) { App.toast("فشل تسجيل الدخول، حاول مرة ثانية"); console.error(e); }
    }
  }


  /* بصمة الجهاز/المتصفح: معرّف عشوائي ثابت بالمتصفح + بصمة عتاد، بتنبعث للـ Worker مرة بالجلسة لكشف الحسابات المكررة */
  async function sha256hex(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32); }
  function deviceId() {
    let id = ""; try { id = localStorage.getItem("did") || (document.cookie.match(/(?:^|; )did=([a-f0-9]{32})/) || [])[1] || ""; } catch (e) {}
    if (!/^[a-f0-9]{32}$/.test(id)) id = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem("did", id); } catch (e) {}
    try { document.cookie = "did=" + id + "; max-age=31536000; path=/; SameSite=Lax"; } catch (e) {}
    return id;
  }
  async function hwPrint() {
    const p = [screen.width, screen.height, screen.colorDepth, devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone, (navigator.languages || []).join(","), navigator.hardwareConcurrency, navigator.deviceMemory, navigator.platform, navigator.maxTouchPoints];
    try {
      const cv = document.createElement("canvas"); cv.width = 200; cv.height = 40; const g = cv.getContext("2d");
      g.textBaseline = "top"; g.font = "16px Arial"; g.fillStyle = "#f60"; g.fillRect(10, 5, 80, 20); g.fillStyle = "#069"; g.fillText("peakz fp 😀 ƒ", 4, 12); p.push(cv.toDataURL());
      const gl = document.createElement("canvas").getContext("webgl"), ex = gl && gl.getExtension("WEBGL_debug_renderer_info");
      if (ex) p.push(gl.getParameter(ex.UNMASKED_VENDOR_WEBGL), gl.getParameter(ex.UNMASKED_RENDERER_WEBGL));
    } catch (e) {}
    return sha256hex(p.join("|"));
  }
  async function trackDevice(u) {
    try {
      const last = sessionStorage.getItem("trk") || ""; const [lu, lt] = last.split("|");
      if (lu === u.uid && Date.now() - Number(lt || 0) < 20 * 60000) return;
      const tok = await firebase.auth().currentUser.getIdToken();
      const r = await fetch(C.workerUrl + "/guard/track", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ dev: deviceId(), fp: await hwPrint() }) });
      if (r.ok) sessionStorage.setItem("trk", u.uid + "|" + Date.now());
    } catch (e) {}
  }
  App.trackDevice = trackDevice;
  setInterval(() => { if (App.user && !App.user.admin) trackDevice(App.user); }, 5 * 60000);


  /* بوابة VPN: لو الزائر على VPN/بروكسي/Tor ما بيدخل الموقع لين يطفيه (الأدمن مستثنى، والفشل = سماح) */
  (function vpnGate() {
    if (/overlay/.test(location.pathname)) return;
    let adm = false; try { adm = JSON.parse(localStorage.getItem("lastUser") || "{}").admin === true; } catch (e) {}
    if (adm) return;
    const show = () => {
      if (document.getElementById("vpnGate") || (App.user && App.user.admin)) return;
      const d = document.createElement("div"); d.id = "vpnGate";
      d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#05070f;color:#eef3ff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-family:inherit";
      d.innerHTML = '<div style="max-width:420px"><h2 style="margin:10px 0">أوقف الـ VPN أو البروكسي</h2><p style="color:#9aa8c7;line-height:1.8">الموقع ما بيشتغل مع VPN أو بروكسي أو Tor. طفّيه وحدّث الصفحة عشان تدخل.</p><button class="btn primary" id="vpnRetry" style="margin-top:14px">حدّثت، جرّب مرة ثانية</button></div>';
      (document.body || document.documentElement).appendChild(d);
      document.getElementById("vpnRetry").onclick = () => { try { sessionStorage.removeItem("vpnok"); } catch (e) {} location.reload(); };
    };
    const hide = () => { const d = document.getElementById("vpnGate"); if (d) d.remove(); };
    App.hideVpnGate = hide;
    try { if (Date.now() - Number(sessionStorage.getItem("vpnok") || 0) < 5 * 60000) return; } catch (e) {}
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 5000);
    fetch(C.workerUrl + "/guard/vpn", { signal: ctl.signal }).then((r) => r.json()).then((j) => {
      if (j && j.blocked) { if (document.body) show(); else document.addEventListener("DOMContentLoaded", show); }
      else { try { sessionStorage.setItem("vpnok", String(Date.now())); } catch (e) {} }
    }).catch(() => {});
  })();

  let verRef = null;
  auth.onAuthStateChanged(async (u) => {
    if (verRef) { verRef.off(); verRef = null; }
    App.verified = null;
    if (!u) { App.user = null; try { localStorage.removeItem("lastUser"); } catch (e) {} }
    else {
      let res;
      try { res = await u.getIdTokenResult(true); } catch (e) { try { res = await u.getIdTokenResult(); } catch (e2) { res = { claims: {} }; } }   // لو انقطع النت ما نعلّق الواجهة
      let avatar = ""; try { avatar = localStorage.getItem("avatar") || ""; } catch (e) {}
      App.user = { uid: u.uid, name: res.claims.kickName || "user", admin: res.claims.admin === true, avatar };
      try { let prev = null; try { prev = JSON.parse(localStorage.getItem("lastUser") || "null"); } catch (e) {}
        const o = { name: App.user.name, admin: App.user.admin, avatar }; if (prev && prev.name === o.name && typeof prev.ver === "boolean") o.ver = prev.ver;   // نحتفظ بآخر حالة توثيق معروفة عشان ما تومض الواجهة
        localStorage.setItem("lastUser", JSON.stringify(o)); } catch (e) {}
      verRef = db.ref("verified/" + u.uid + "/ok");
      verRef.on("value", (x) => {
        App.verified = x.val() === true;
        try { const l = JSON.parse(localStorage.getItem("lastUser") || "null"); if (l && l.name === App.user.name) { l.ver = App.verified; localStorage.setItem("lastUser", JSON.stringify(l)); } } catch (e) {}
        App.listeners.forEach((fn) => fn(App.user)); renderUserBox();
      }, () => {});
      if (!App.user.admin) trackDevice(App.user);
      db.ref("users/" + u.uid).update({ name: App.user.name, avatar, lastLogin: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    }
    if (App.user && App.user.admin && App.hideVpnGate) App.hideVpnGate();
    App.ready = true; document.body.classList.add("ready");
    renderUserBox();
    App.listeners.forEach((fn) => fn(App.user));
  });

  const ICONS = {
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>'
  };
  App.icon = (n) => ICONS[n] || "";

  // أيقونات خطّية بسيطة (SVG) للتنقل
  const svg = (d) => `<svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const NI = {
    home: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
    gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v8H5v-8M7.5 8a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 1 1 0 5"/>'),
    target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
    bracket: svg('<path d="M4 5h5v5H4zM4 14h5v5H4zM15 9.5h5v5h-5zM9 7.5h2.5v9H9M11.5 12H15"/>'),
    trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    chev: svg('<path d="m6 9 6 6 6-6"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    grid: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),
    out: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  };
  // الصفحات: [الرابط، الأيقونة، الاسم، المفتاح، وصف قصير]
  const PAGES = {
    home: ["index.html", "home", "الرئيسية", "home"],
    giveaways: ["giveaways.html", "gift", "المسابقات", "giveaways", "سحوبات مباشرة على البث"],
    bonus: ["bonus.html", "target", "البونص هانت", "bonus", "خمّن الربح واربح الجوائز"],
    tournaments: ["tournaments.html", "bracket", "البطولات", "tournaments", "تحدّي لاعبين بشجرة مباشرة"],
    leaderboard: ["leaderboard.html", "trophy", "المتصدرين", "leaderboard"],
  };
  const EVENTS = ["giveaways", "bonus", "tournaments"];

  App.shell = function (active) {
    if (!document.getElementById("siteFoot")) {
      const f = document.createElement("footer"); f.id = "siteFoot"; f.className = "site-foot";
      f.innerHTML = `© ${new Date().getFullYear()} <b>peakz.live</b> — جميع الحقوق محفوظة<div style="margin-top:6px"><a href="legal.html#privacy">سياسة الخصوصية</a>·<a href="legal.html#terms">شروط الاستخدام</a></div>`;
      document.body.appendChild(f);
    }
    const link = (k, cls) => { const [href, ic, label] = PAGES[k]; return `<a href="${href}" class="${cls || ""} ${k === active ? "active" : ""}">${label}</a>`; };
    const nav = document.getElementById("nav");
    if (nav) {
      const evOn = EVENTS.includes(active);
      nav.innerHTML = link("home") +
        `<div class="dd ${evOn ? "active" : ""}"><button type="button" class="ddb" id="ddBtn" aria-haspopup="true" aria-expanded="false">الفعاليات ${NI.chev}</button>
          <div class="ddp" id="ddPanel" hidden>${EVENTS.map((k) => { const [href, ic, label, , sub] = PAGES[k]; return `<a href="${href}" class="ddi ${k === active ? "active" : ""}"><span class="ddic">${NI[ic]}</span><span><b>${label}</b></span></a>`; }).join("")}</div></div>` +
        link("leaderboard");
      const btn = document.getElementById("ddBtn"), pn = document.getElementById("ddPanel");
      btn.onclick = (e) => { e.stopPropagation(); const o = pn.hidden; pn.hidden = !o; btn.setAttribute("aria-expanded", String(o)); };
      document.addEventListener("click", (e) => { if (!pn.hidden && !e.target.closest(".dd")) { pn.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
    }
    // شريط سفلي بالجوال
    if (!document.getElementById("mbar")) {
      const m = document.createElement("nav"); m.id = "mbar"; m.className = "mbar";
      m.innerHTML = ["home", "giveaways", "bonus", "tournaments", "leaderboard"].map((k) => { const [href, ic, label] = PAGES[k]; return `<a href="${href}" class="${k === active ? "active" : ""}">${NI[ic]}<span>${k === "bonus" ? "هانت" : label}</span></a>`; }).join("");
      document.body.appendChild(m);
    }
    const b = document.querySelector(".brand");
    if (b) b.innerHTML = `<img class="mark" src="img/logo.png" alt=""><span>${esc(C.siteName)}</span>`;
    const te = document.querySelector(".top-end");
    if (te && window.I18N && I18N.enabled && !document.getElementById("langBtn")) {       // زر اللغة بالشريط
      const lb = document.createElement("button");
      lb.id = "langBtn"; lb.className = "langp"; lb.type = "button"; lb.setAttribute("translate", "no");
      const upd = () => { lb.innerHTML = NI.globe + `<span>${I18N.lang === "en" ? "English" : "العربية"}</span>`; lb.title = I18N.lang === "en" ? "العربية" : "English"; };
      lb.onclick = () => I18N.set(I18N.lang === "en" ? "ar" : "en"); upd();
      window.addEventListener("langchange", () => { upd(); renderUserBox(); });
      te.insertBefore(lb, te.firstChild);
    }
    renderUserBox();
  };

  // حالة التوثيق بالشريط: قبل ما توصل القيمة الحقيقية من Firebase نعرض آخر قيمة معروفة (أو لا شيء) بدل ما نومض "غير موثّق"
  function verLabel(u) {
    let v = null;
    if (App.ready && App.verified !== null) v = App.verified;
    else { try { const l = JSON.parse(localStorage.getItem("lastUser") || "null"); if (l && l.name === u.name && typeof l.ver === "boolean") v = l.ver; } catch (e) {} }
    return v === null ? "" : v ? "موثّق" : "غير موثّق";
  }
  function renderUserBox() {
    const box = document.getElementById("userbox");
    if (!box) return;
    let u = App.user;
    if (!App.ready) {                                    // قبل ما يتأكد Firebase: نعرض آخر مستخدم محفوظ (أو لا شيء) بدل زر تسجيل الدخول
      try { u = JSON.parse(localStorage.getItem("lastUser") || "null"); } catch (e) { u = null; }
      if (!u) { box.innerHTML = ""; return; }
    }
    if (!u) { box.innerHTML = `<button class="btn primary" id="loginBtn">تسجيل الدخول بكيك</button>`; document.getElementById("loginBtn").onclick = () => App.login(location.pathname.split("/").pop() || ""); return; }
    const av = u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : `<div class="av">${esc(u.name[0].toUpperCase())}</div>`;
    box.innerHTML = `<div class="uwrap">
        <button type="button" class="userchip ${verLabel(u) === "غير موثّق" ? "unv" : ""}" id="uchip" aria-haspopup="true" aria-expanded="false">${av}<div class="un"><b>${esc(u.name)}</b><small>${u.admin ? "أدمن · " : ""}${verLabel(u)}</small></div>${NI.chev}</button>
        <div class="umenu" id="umenu" hidden>
          <a href="user.html?id=${esc(u.uid)}" class="uitem">${NI.user}<span>بروفايلي</span></a>
          <a href="profile.html" class="uitem">${NI.gear}<span>الإعدادات</span></a>
          ${u.admin ? `<a href="admin.html" class="uitem">${NI.grid}<span>لوحة التحكم</span></a>` : ""}
          <div class="usep"></div>
          <button type="button" class="uitem out" id="logoutBtn">${NI.out}<span>تسجيل الخروج</span></button>
        </div>
      </div>`;
    const menu = document.getElementById("umenu"), chip = document.getElementById("uchip");
    chip.onclick = (e) => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; chip.setAttribute("aria-expanded", String(open)); };
    document.getElementById("logoutBtn").onclick = () => { menu.hidden = true; App.confirmLogout(); };
  }

  // لوحة رابط أوفرلاي OBS مع زر نسخ (تُستعمل بصفحات الأدمن)
  App.manualKey = (name) => "manual_" + (String(name).trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF_-]+/g, "") || Math.random().toString(36).slice(2, 8));
  App.addManualEntry = async (gid) => {
    const name = (prompt("اسم المشارك (اسم كيك):") || "").trim().slice(0, 40); if (!name) return;
    const key = App.manualKey(name), ref = db.ref("entries/" + gid + "/" + key);
    if ((await ref.once("value")).exists()) return App.toast("هذا الاسم مضاف أصلاً");
    await ref.set({ name, source: "manual", at: firebase.database.ServerValue.TIMESTAMP });
    App.toast("تمت إضافة " + name + " ✓");
  };
  App.overlayPanel = (file, title, hint) => {
    const url = new URL(file, location.href).href;
    return `<div class="panel"><h2>${esc(title)} — أوفرلاي OBS</h2><div class="ovl"><input readonly value="${esc(url)}" onclick="this.select()"><button class="btn primary small" data-copyurl="${esc(url)}">نسخ الرابط</button><a class="btn ghost small" href="${esc(url)}" target="_blank" rel="noopener">معاينة</a></div><div class="hint" style="margin-top:8px">${hint}</div></div>`;
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copyurl]"); if (!b) return;
    const u = b.dataset.copyurl;
    (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => App.toast("تم نسخ الرابط ✓"), () => { const i = b.parentNode.querySelector("input"); i.select(); document.execCommand("copy"); App.toast("تم نسخ الرابط ✓"); });
  });

  consumeToken();
})();
