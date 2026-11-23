// الصفحة الرئيسية: حالة البث (من الـ Worker) + عدد المسابقات الجارية
(function () {
  const { db, C } = App;
  App.shell("home");
  const $ = (id) => document.getElementById(id);
  const url = "https://kick.com/" + C.streamerSlug;
  $("hWatch").href = url; $("stream").href = url;
  $("hName").innerHTML = `<em>${C.siteName}</em>`;

  function setStatus(d) {
    const live = !!(d && d.live);
    const st = $("hSt");
    st.className = "st" + (live ? " live" : "");
    st.lastElementChild.textContent = !d ? "حالة البث غير متاحة" : live ? "مباشر الآن" : "أوفلاين";
    if (d && d.avatar) $("pfp").src = d.avatar;
    const box = $("stream"), tag = $("tag");
    box.classList.toggle("off", !live);
    tag.className = "tag" + (live ? " live" : "");
    tag.textContent = live ? "● LIVE · " + (d.viewers || 0) + " مشاهد" : "OFFLINE";
    const old = box.querySelector("img.th");
    if (live && d.thumbnail) {
      $("ph").style.display = "none";
      if (!old) { const i = document.createElement("img"); i.className = "th"; box.prepend(i); }
      box.querySelector("img.th").src = d.thumbnail + (d.thumbnail.includes("?") ? "&" : "?") + "t=" + Math.floor(Date.now() / 60000);
    } else { if (old) old.remove(); $("ph").style.display = ""; }
    $("sTitle").textContent = live ? d.title || "" : "البث متوقف حالياً";
    $("sSub").textContent = live ? d.category || "" : "";
  }

  async function poll() {
    try {
      const r = await fetch(C.workerUrl + "/channel");
      if (!r.ok) throw 0;
      setStatus(await r.json());
    } catch (e) { setStatus(null); }
  }
  poll(); setInterval(poll, 60000);

  let gvs = [];
  const pad = (n) => String(n).padStart(2, "0");
  function tickCd() {
    const now = App.now();
    const next = gvs.filter((g) => g.status === "open" && g.endsAt > now).sort((a, b) => a.endsAt - b.endsAt)[0];
    const box = $("cd");
    if (!next) { box.hidden = true; return; }
    const t = Math.floor((next.endsAt - now) / 1000), d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    $("cdT").textContent = next.title || "";
    $("cdV").textContent = (d ? d + "d " : "") + pad(h) + ":" + pad(m) + ":" + pad(sec);
    box.classList.toggle("soon", t < 600);
    box.hidden = false;
  }
  setInterval(tickCd, 1000);
  db.ref("giveaways").orderByChild("createdAt").limitToLast(20).on("value", (s) => {
    gvs = Object.values(s.val() || {});
    const n = gvs.filter((g) => g.status === "open" && g.endsAt > App.now()).length;
    $("hCount").textContent = n ? "(" + n + ")" : "";
    tickCd();
  });
})();
