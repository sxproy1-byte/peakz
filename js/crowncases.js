(function () {
  App.shell("crowncases");
  const dc = document.getElementById("ccDc"), C = window.SITE_CONFIG || window.CONFIG || {};
  const inv = (App.C && App.C.discordInvite) || C.discordInvite || "https://discord.gg/y8bqeNZqy9";
  dc.href = inv;
  document.querySelectorAll("[data-code]").forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.code); App.toast("تم نسخ الكود ✓"); } catch (e) { App.toast(b.dataset.code); } }));
})();
