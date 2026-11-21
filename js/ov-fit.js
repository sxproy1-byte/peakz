// يكبّر/يصغّر الأوفرلاي (المصمّم 440×320) ليملأ حجم الـBrowser Source أياً كان
(function () {
  function fit() { const f = document.getElementById("fit"); if (!f) return; const s = Math.min(innerWidth / 440, innerHeight / 320); f.style.transform = "scale(" + (s > 0 ? s : 1) + ")"; }
  addEventListener("resize", fit); fit();
})();
