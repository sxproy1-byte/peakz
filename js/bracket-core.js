// منطق شجرة الإقصاء المباشر (بدون واجهة) — قابل للاختبار
(function (root, f) { if (typeof module === "object" && module.exports) module.exports = f(); else root.Bracket = f(); })(this, function () {
  const TBD = () => ({ tbd: true }), BYE = () => ({ bye: true });
  const isP = (s) => s && s.uid;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // players: [{uid,name}] ; shuffle(arr) تُرجع ترتيب عشوائي (نمرّر Fair.shuffle)
  function build(players, shuffle) {
    if (players.length < 2) throw new Error("need2");
    const ps = (shuffle || ((a) => a))(players.slice()).map((p) => ({ uid: p.uid, name: p.name }));
    let size = 2; while (size < ps.length) size *= 2;
    const byes = size - ps.length, m0 = size / 2, r0 = [];
    let k = 0;
    for (let i = 0; i < m0; i++) {
      if (i < byes) r0.push({ a: ps[k++], b: BYE() });
      else r0.push({ a: ps[k++], b: ps[k++] });
    }
    const rounds = [r0];
    for (let n = m0 / 2; n >= 1; n /= 2) rounds.push(Array.from({ length: n }, () => ({ a: TBD(), b: TBD() })));
    rounds[0].forEach((m, i) => { if (m.b.bye) win(rounds, 0, i, "a"); });
    return rounds;
  }

  function win(rounds, r, i, side) {
    const m = rounds[r][i]; m.w = side;
    const p = { uid: m[side].uid, name: m[side].name };
    if (r + 1 < rounds.length) rounds[r + 1][i >> 1][i % 2 === 0 ? "a" : "b"] = p;
  }

  // يرجع شجرة جديدة أو null إذا ما ينفع (تعادل / مباراة غير جاهزة)
  function setResult(rounds, r, i, sa, sb) {
    const R = clone(rounds), m = R[r][i];
    if (!isP(m.a) || !isP(m.b) || m.w) return null;
    if (!isFinite(sa) || !isFinite(sb) || sa === sb) return null;
    m.sa = sa; m.sb = sb; win(R, r, i, sa > sb ? "a" : "b");
    return R;
  }

  function clearResult(rounds, r, i) {
    const R = clone(rounds), m = R[r][i];
    if (!m.w || m.b.bye) return null;
    if (r + 1 < R.length) {
      const nx = R[r + 1][i >> 1];
      if (nx.w) return null;                       // المباراة التالية انلعبت
      nx[i % 2 === 0 ? "a" : "b"] = TBD();
    }
    delete m.w; delete m.sa; delete m.sb;
    return R;
  }

  function result(rounds) {
    const f = rounds[rounds.length - 1][0];
    if (!f.w) return null;
    const lose = f.w === "a" ? "b" : "a";
    return { champion: { uid: f[f.w].uid, name: f[f.w].name }, runnerUp: { uid: f[lose].uid, name: f[lose].name } };
  }
  const roundName = (r, total) => { const left = total - r; return left === 1 ? "النهائي" : left === 2 ? "نصف النهائي" : left === 3 ? "ربع النهائي" : "الدور " + (r + 1); };
  return { build, setResult, clearResult, result, roundName, isP };
});
