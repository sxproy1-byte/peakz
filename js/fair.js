// عشوائية السحب: crypto + رفض الانحياز (rejection sampling) + Fisher–Yates جزئي
// نفس الملف يستخدمه السحب الفعلي واختبار العدالة.
(function (root) {
  const rng = (root.crypto && root.crypto.getRandomValues) ? root.crypto : require("crypto").webcrypto;

  // رقم صحيح منتظم بين 0 و n-1 بدون انحياز (modulo bias)
  function secureInt(n) {
    if (!(n >= 1) || n > 0x100000000) throw new Error("bad n");
    const lim = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
    do rng.getRandomValues(a); while (a[0] >= lim);
    return a[0] % n;
  }

  // يختار count عناصر مختلفة من المصفوفة، كل عنصر باحتمال متساوٍ، والترتيب عشوائي أيضاً
  function pickWinners(pool, count) {
    const a = pool.slice(), k = Math.min(count, a.length), out = [];
    for (let i = 0; i < k; i++) {
      const j = i + secureInt(a.length - i);
      [a[i], a[j]] = [a[j], a[i]];
      out.push(a[i]);
    }
    return out;
  }

  const api = { secureInt, pickWinners };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Fair = api;
})(typeof window !== "undefined" ? window : globalThis);
