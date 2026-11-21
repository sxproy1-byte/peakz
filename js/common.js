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
    if (!u) { App.user = null; }
    else {
      const res = await u.getIdTokenResult(true);
      let avatar = ""; try { avatar = localStorage.getItem("avatar") || ""; } catch (e) {}
      App.user = { uid: u.uid, name: res.claims.kickName || "user", admin: res.claims.admin === true, avatar };
      verRef = db.ref("verified/" + u.uid + "/ok");
      verRef.on("value", (x) => { App.verified = x.val() === true; App.listeners.forEach((fn) => fn(App.user)); renderUserBox(); }, () => {});
      db.ref("users/" + u.uid).update({ name: App.user.name, avatar, lastLogin: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    }
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
    ["tournaments.html", "⚔️", "البطولات", "tournaments", true]
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
    renderUserBox();
  };

  function renderUserBox() {
    const box = document.getElementById("userbox");
    if (!box) return;
    const u = App.user;
    if (!u) { box.innerHTML = `<button class="btn primary" id="loginBtn">تسجيل الدخول بكيك</button>`; document.getElementById("loginBtn").onclick = () => App.login(location.pathname.split("/").pop() || ""); return; }
    const av = u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : `<div class="av">${esc(u.name[0].toUpperCase())}</div>`;
    box.innerHTML = `${u.admin ? '<a class="btn ghost small" href="admin.html">لوحة التحكم</a>' : ""}
      <a class="userchip" href="profile.html" title="ملفي الشخصي">${av}<div><b>${esc(u.name)}</b><small>${u.admin ? "أدمن · " : ""}${App.verified ? "موثّق ✅" : "غير موثّق ⚠️"}</small></div></a>
      <button class="btn ghost small" id="logoutBtn">خروج</button>`;
    document.getElementById("logoutBtn").onclick = App.logout;
  }

  consumeToken();
})();
