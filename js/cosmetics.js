// تخصيص البروفايل (صورة + بانر + نبذة) + عرض بادجات كيك. الصور بتتصغّر بالمتصفح وبتنحفظ كنص بقاعدة البيانات (cosmetics/{uid})
(function () {
  const KB = {
    broadcaster: ["Broadcaster", "#ef5b6b"], moderator: ["MOD", "#3ecf8e"], vip: ["VIP", "#e65bbd"], og: ["OG", "#9fc0ff"],
    founder: ["Founder", "#a78bfa"], subscriber: ["Sub", "#53fc18"], sub_gifter: ["Gifter", "#4aa8ff"], verified: ["Verified", "#3ecf8e"], staff: ["Staff", "#ef5b6b"],
  };
  const clean = (s) => String(s || "").replace(/[<>"&]/g, "");
  function kickBadges(list) {
    return (list || []).map((b) => {
      const k = KB[b.t], label = k ? k[0] : clean(b.x) || clean(b.t), col = k ? k[1] : "#8b909e";
      const extra = b.c ? (b.t === "subscriber" ? " · " + b.c + "m" : b.t === "sub_gifter" ? " · " + b.c : "") : "";
      return `<span class="kb" style="--c:${col}" title="${clean(b.x) || clean(b.t)}"><i></i>${clean(label)}${extra}</span>`;
    }).join("");
  }
  // قص الصورة بالنص (cover) وتصغيرها، وتقليل الجودة لين يصير الحجم صغير
  function toDataUrl(file, w, h, maxLen) {
    return new Promise((res, rej) => {
      if (!file || !/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return rej(new Error("type"));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d"), r = Math.max(w / img.width, h / img.height), dw = img.width * r, dh = img.height * r;
        x.fillStyle = "#0e1324"; x.fillRect(0, 0, w, h); x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        URL.revokeObjectURL(url);
        let q = 0.85, out = c.toDataURL("image/jpeg", q);
        while (out.length > maxLen && q > 0.3) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
        out.length > maxLen ? rej(new Error("size")) : res(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("type")); };
      img.src = url;
    });
  }
  const ok = (s) => typeof s === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(s);
  window.Cos = { ok, kickBadges, toDataUrl, AV: [192, 192, 38000], BN: [1000, 300, 110000], BIO: 80 };
})();
