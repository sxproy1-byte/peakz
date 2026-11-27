(function () {
  App.shell("crowncases");
  const dc = document.getElementById("ccDc"), C = window.SITE_CONFIG || window.CONFIG || {};
  const inv = (App.C && App.C.discordInvite) || C.discordInvite || "https://discord.gg/y8bqeNZqy9";
  dc.href = inv;
  document.getElementById("ccCopy").onclick = async () => { try { await navigator.clipboard.writeText("PEAKZ20"); App.toast("تم نسخ الكود ✓"); } catch (e) { App.toast("PEAKZ20"); } };
})();
