// تنظيف الرابط: يخفي .html من شريط العنوان (الصفحة تفتح بالطريقتين)
(function () {
  try {
    if (!/^https?:$/.test(location.protocol)) return;
    const p = location.pathname;
    if (!/\.html$/.test(p)) return;
    const np = p.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
    history.replaceState(history.state, "", np + location.search + location.hash);
  } catch (e) {}
})();

// شاشة لودينج: مرة وحدة بالجلسة، الاسم بيتعبّى بالأزرق ثم تتلاشى. (بدون أي اعتماد على باقي السكربتات)
(function () {
  try {
    if (/overlay/.test(location.pathname)) return;
    if (sessionStorage.getItem("pkLoad")) return;
    sessionStorage.setItem("pkLoad", "1");
    if (!(window.CSS && CSS.registerProperty) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try { CSS.registerProperty({ name: "--pkp", syntax: "<number>", inherits: false, initialValue: "0" }); } catch (e) {}
    const root = document.documentElement;
    const css = document.createElement("style");
    css.textContent = `#pkLoad{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;background:linear-gradient(180deg,#0b1430,#0a1026 55%,#0b1a3d);transition:opacity .5s ease,visibility .5s}
#pkLoad.out{opacity:0;visibility:hidden}
#pkLoad .o{position:absolute;border-radius:50%;filter:blur(80px)}
#pkLoad .t{position:relative;font-family:Anton,Impact,sans-serif;font-size:clamp(64px,24vw,150px);line-height:1;letter-spacing:.1em;padding-inline-start:.1em;direction:ltr;opacity:0}
#pkLoad.go .t{animation:pkin .6s ease both}
#pkLoad .t b{display:block;font-weight:400;-webkit-text-stroke:1.5px rgba(150,185,255,.55);color:transparent}
#pkLoad .t u{text-decoration:none;position:absolute;inset:0;display:block;padding-inline-start:.1em;font-weight:400;background:linear-gradient(to top,#2563eb 0%,#5b9bff 55%,#cfe1ff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-mask:linear-gradient(to top,#000 0,#000 calc(var(--pkp)*1%),transparent calc(var(--pkp)*1%));mask:linear-gradient(to top,#000 0,#000 calc(var(--pkp)*1%),transparent calc(var(--pkp)*1%))}
#pkLoad.go .t u{animation:pkfill 2.2s cubic-bezier(.45,.05,.25,1) .3s both}
@keyframes pkfill{to{--pkp:100}}@keyframes pkin{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}`;
    const lk = document.createElement("link");
    lk.rel = "stylesheet"; lk.href = "https://fonts.googleapis.com/css2?family=Anton&text=PEAKZ&display=block";
    const box = document.createElement("div");
    box.id = "pkLoad"; box.setAttribute("aria-hidden", "true");
    box.innerHTML = '<div class="o" style="width:520px;height:520px;background:#2563eb;opacity:.35;left:-120px;top:-120px"></div><div class="o" style="width:460px;height:460px;background:#38bdf8;opacity:.12;right:-80px;bottom:-100px"></div><div class="t"><b>PEAKZ</b><u>PEAKZ</u></div>';
    root.appendChild(css); document.head.appendChild(lk); root.appendChild(box);
    const t0 = Date.now(); let loaded = false, closed = false;
    const close = () => { if (closed) return; closed = true; box.classList.add("out"); setTimeout(() => { box.remove(); css.remove(); }, 700); };
    const check = () => { if (closed) return; const el = Date.now() - t0; if (loaded && el >= 2600) close(); else if (el >= 3500) close(); else setTimeout(check, 100); };
    const start = () => { if (!box.classList.contains("go")) box.classList.add("go"); };
    (document.fonts && document.fonts.load ? document.fonts.load("100px Anton", "PEAKZ").catch(() => {}) : Promise.resolve()).then(start);
    setTimeout(start, 700);
    addEventListener("load", () => { loaded = true; });
    if (document.readyState === "complete") loaded = true;
    check();
  } catch (e) {}
})();
