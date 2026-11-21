// بكج كاونتر سترايك: شريط أسماء يلف ويبطّئ تدريجياً ويقف على الفائز تحت المؤشر
// الفائز يُختار قبل الأنيميشن (Fair.pickWinners) والشريط فقط يعرضه، فالحركة ما بتأثر على النتيجة.
(function (root) {
  const CARD = 170, GAP = 8, STEP = CARD + GAP, TOTAL = 72;
  // ألوان الندرة (تجميلية فقط، مثل CS)
  const RAR = [["r1", 0.799], ["r2", 0.16], ["r3", 0.032], ["r4", 0.0064], ["r5", 0.0026]];
  const rar = () => { let x = Math.random(), s = 0; for (const [c, p] of RAR) { s += p; if (x < s) return c; } return "r1"; };

  let actx = null, muted = false;
  function audio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) {} return actx; }
  function tone(f, d, type, vol, when) {
    if (muted || !actx) return;
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + (when || 0);
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
  }
  const tick = () => tone(900 + Math.random() * 120, 0.05, "square", 0.05);
  const winSound = () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, "triangle", 0.12, i * 0.09)); };

  // trackEl داخل caseEl. names = أسماء المشاركين (للحشو)، winner = الاسم الفائز
  function spin(caseEl, trackEl, names, winner, opts) {
    opts = opts || {};
    audio();
    const dur = opts.duration || 7000;
    const W = 52 + Math.floor(Math.random() * 8);            // مكان بطاقة الفائز بالشريط
    const pool = names.length ? names : [winner];
    // نبني البطاقات ثم نكتب الأسماء بـ textContent (أمان من XSS)
    let prev = "";
    trackEl.innerHTML = "";
    for (let i = 0; i < TOTAL; i++) {
      let n = winner;
      if (i !== W) {
        n = pool[Math.floor(Math.random() * pool.length)];
        if (pool.length > 1) { let g = 0; while ((n === prev || (Math.abs(i - W) === 1 && n === winner)) && g++ < 12) n = pool[Math.floor(Math.random() * pool.length)]; }
      }
      prev = n;
      const c = document.createElement("div"); c.className = "cc " + rar() + (i === W ? " target" : "");
      const b = document.createElement("b"); b.textContent = n; c.appendChild(b); c.appendChild(document.createElement("i"));
      trackEl.appendChild(c);
    }
    const els = trackEl.children;
    trackEl.style.transition = "none"; trackEl.style.transform = "translateX(0)";
    caseEl.classList.remove("done"); caseEl.classList.add("spinning");
    const half = caseEl.clientWidth / 2;
    const x0 = half - CARD / 2;                               // البطاقة 0 تحت المؤشر
    const jitter = (Math.random() * 2 - 1) * (CARD / 2 - 14); // تقف بمكان عشوائي داخل بطاقة الفائز
    const x1 = half - (W * STEP + CARD / 2) + jitter;
    return new Promise((res) => {
      const t0 = performance.now(); let lastIdx = -1;
      (function frame(now) {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        const x = x0 + (x1 - x0) * e;
        trackEl.style.transform = `translateX(${x}px)`;
        const idx = Math.floor((half - x) / STEP);
        if (idx !== lastIdx) { lastIdx = idx; tick(); }
        if (k < 1) return requestAnimationFrame(frame);
        caseEl.classList.remove("spinning"); caseEl.classList.add("done");
        for (const el of els) if (!el.classList.contains("target")) el.classList.add("dim");
        winSound(); res();
      })(t0);
    });
  }
  root.Reel = { spin, setMuted: (m) => { muted = m; }, unlock: audio };
})(window);
