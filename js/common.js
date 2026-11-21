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
      try { localStorage.setItem("lastUser", JSON.stringify({ name: App.user.name, admin: App.user.admin, avatar })); } catch (e) {}
      verRef = db.ref("verified/" + u.uid + "/ok");
      verRef.on("value", (x) => { App.verified = x.val() === true; App.listeners.forEach((fn) => fn(App.user)); renderUserBox(); }, () => {});
      db.ref("users/" + u.uid).update({ name: App.user.name, avatar, lastLogin: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    }
    App.ready = true; document.body.classList.add("ready");
    renderUserBox();
    App.listeners.forEach((fn) => fn(App.user));
  });

  const ICONS = {
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>'
  };
  App.icon = (n) => ICONS[n] || "";

  const NAV = [
    ["index.html", "🏠", "الرئيسية", "home"],
    ["giveaways.html", "🎟️", "المسابقات", "giveaways"],
    ["bonus.html", "🎯", "البونص هانت", "bonus"],
    ["tournaments.html", "⚔️", "البطولات", "tournaments"]
  ];

  App.shell = function (active) {
    const nav = document.getElementById("nav");
    if (nav) {
      nav.innerHTML = NAV.map(([href, ico, label, key, soon]) =>
        `<a href="${href}" class="${key === active ? "active" : ""}"><span>${ico}</span>${label}${soon ? '<span class="soon">قريباً</span>' : ""}</a>`
      ).join("");
    }
    const b = document.querySelector(".brand");
    if (b) b.innerHTML = `<img class="mark" src="img/logo.png" alt=""><span>${esc(C.siteName)}</span>`;
    const f = document.getElementById("follow");
    if (f) { f.href = "https://kick.com/" + C.streamerSlug; f.target = "_blank"; f.rel = "noopener"; f.textContent = "تابع على كيك"; }
    const te = document.querySelector(".top-end");
    if (te && window.I18N && I18N.enabled && !document.getElementById("langBtn")) {
      const lb = document.createElement("button");
      lb.id = "langBtn"; lb.className = "btn ghost small"; lb.type = "button"; lb.setAttribute("translate", "no");
      const upd = () => { lb.textContent = I18N.lang === "en" ? "ع" : "EN"; lb.title = I18N.lang === "en" ? "العربية" : "English"; };
      lb.onclick = () => I18N.set(I18N.lang === "en" ? "ar" : "en"); upd();
      window.addEventListener("langchange", () => { upd(); renderUserBox(); });
      te.insertBefore(lb, te.firstChild);
    }
    renderUserBox();
  };

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
    box.innerHTML = `${u.admin ? '<a class="btn ghost small" href="admin.html">لوحة التحكم</a>' : ""}
      <a class="userchip" href="profile.html" title="ملفي الشخصي">${av}<div><b>${esc(u.name)}</b><small>${u.admin ? "أدمن · " : ""}${App.ready ? (App.verified ? "موثّق ✅" : "غير موثّق ⚠️") : ""}</small></div></a>
      <button class="btn ghost small" id="logoutBtn">خروج</button>`;
    document.getElementById("logoutBtn").onclick = App.logout;
  }

  // لوحة رابط أوفرلاي OBS مع زر نسخ (تُستعمل بصفحات الأدمن)
  App.overlayPanel = (file, title, hint) => {
    const url = new URL(file, location.href).href;
    return `<div class="panel"><h2>📺 ${esc(title)} — أوفرلاي OBS</h2><div class="ovl"><input readonly value="${esc(url)}" onclick="this.select()"><button class="btn primary small" data-copyurl="${esc(url)}">نسخ الرابط</button><a class="btn ghost small" href="${esc(url)}" target="_blank" rel="noopener">معاينة</a></div><div class="hint" style="margin-top:8px">${hint}</div></div>`;
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copyurl]"); if (!b) return;
    const u = b.dataset.copyurl;
    (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => App.toast("تم نسخ الرابط ✓"), () => { const i = b.parentNode.querySelector("input"); i.select(); document.execCommand("copy"); App.toast("تم نسخ الرابط ✓"); });
  });

  consumeToken();
})();
