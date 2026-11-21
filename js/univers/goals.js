// Mode Univers v3 (21 nov.) : la fédération rivale (guerre des audiences chaque semaine, ses coups bas) et les missions du propriétaire
// (3 en même temps, récompense en argent + confiance, échec = confiance en baisse). Les écrans sont dans ui6.js.
import { xpAdd } from "./extra.js";
import { clamp, rnd, pick, uid, dayLabel, shortDate, fmtK, fmtM, stars } from "./world.js";
import { meF, roster, mail, news, buzz, FANS, ach, isBig, champIds, e_, cap } from "./base.js";

const r5 = v => Math.round(v / 5) * 5;
export const rival = G => (G.riv && G.F[G.riv.id]) || null;
// combien il te faut pour battre la rivale : son audience × (ton audience habituelle / la sienne)
// (moyenne de tes 4 semaines d'avant / la sienne) : on gagne en faisant mieux que d'habitude, plus que la rivale
export function hcap(G, wk) {
  const o = rival(G), f = meF(G); if (!o) return 1; if (wk == null) wk = Math.floor(G.day / 7);
  let a = 0, b = 0, n = 0; for (let k = wk - 4; k < wk; k++) { const A = (G.wk || {})[k] || {}; if (A[G.me] && A[o.id]) { a += A[G.me]; b += A[o.id]; n++; } }
  const r = n ? a / b : (f.aud0 || 0.1) / Math.max(0.02, o.aud0 || 0.1);
  return Math.max(0.05, Math.min(20, r));
}
export function warNeed(G) { const o = rival(G); if (!o) return 0; const last = (G.riv.hist || []).slice(-1)[0], base = last ? last.them : o.aud0; return Math.round(base * hcap(G) * 100) / 100; }

// ---------- la rivale : la fédération la plus proche en popularité, de préférence le même soir que toi ----------
export function pickRival(G) {
  const f = meF(G), wd = (f.shows || []).map(s => s.wd);
  const L = Object.values(G.F).filter(o => o.id !== G.me && (o.shows || []).length);
  if (!L.length) return "";
  const sc = o => Math.abs(o.pop - f.pop) - ((o.shows || []).some(s => wd.indexOf(s.wd) >= 0) ? 12 : 0) + (o.onlyF ? 25 : 0);
  return L.sort((a, b) => sc(a) - sc(b))[0].id;
}
export function initRival(G) {
  if (G.riv && G.F[G.riv.id] && G.riv.id !== G.me) return;
  const id = pickRival(G); if (!id) { G.riv = null; return; }
  G.riv = { id: id, w: 0, l: 0, st: 0, best: 0, hist: [], since: G.day, taunts: [] };
}
const gmOf = o => "Le GM de " + o.n;
const TAUNT_W = ["Profitez-en bien. La semaine prochaine, on vous écrase.", "Un coup de chance. Rien de plus.", "Les chiffres mentent parfois…", "Bravo. Vraiment. Ça ne se reproduira pas."];
const TAUNT_L = ["Merci pour la soirée, on a encore gagné.", "Vos fans ont changé de chaîne. On les comprend.", "Vous jouez dans la cour des grands ? Pas encore.", "Belle tentative. Revenez quand vous serez prêts."];
// chaque lundi : qui a gagné la semaine aux audiences ?
export function rivalWeek(G, wk) {
  const o = rival(G); if (!o) return null;
  const A = (G.wk || {})[wk] || {}, me = A[G.me], them = A[o.id];
  if (!me || !them) return null;
  // à taille égale : chacun est comparé à son audience habituelle (sinon une petite fédé ne gagnerait jamais)
  const f = meF(G), R = G.riv, hc = hcap(G, wk), need = Math.round(them * hc * 100) / 100, won = me >= need;
  R.hist.push({ wk: wk, d: G.day - 1, me: me, them: them, need: need, won: won }); cap(R.hist, 52);
  if (won) { R.w++; R.st = R.st > 0 ? R.st + 1 : 1; xpAdd(G, 8); f.pop = clamp(f.pop + 0.3, 5, 99); if (G.obj && G.mode !== "sandbox") G.obj.sec = clamp(G.obj.sec + 1, 0, 100); }
  else { R.l++; R.st = R.st < 0 ? R.st - 1 : -1; if (G.obj && G.mode !== "sandbox") G.obj.sec = clamp(G.obj.sec - 1, 0, 100); }
  R.best = Math.max(R.best || 0, R.st);
  const line = pick(won ? TAUNT_W : TAUNT_L); R.taunts.push({ d: G.day, t: line, won: won }); cap(R.taunts, 12);
  mail(G, { k: "war", from: gmOf(o), role: o.n, c: o.c || "#ff8a7e", ini: o.sh.slice(0, 3), fed: o.id, subj: "Guerre des audiences : " + (won ? "tu gagnes la semaine !" : o.n + " gagne la semaine"),
    body: f.n + " : " + fmtM(me) + " · " + o.n + " : " + fmtM(them) + ".\nÀ taille égale, il te fallait " + fmtM(need) + (won ? " : c’est gagné." : " : raté.") + "\n« " + line + " »\nBilan : " + R.w + " victoire" + (R.w > 1 ? "s" : "") + ", " + R.l + " défaite" + (R.l > 1 ? "s" : "") + ".", imp: false });
  news(G, { seg: "ecran", f: "nous", t: "Guerre des audiences : " + (won ? f.n : o.n) + " gagne la semaine", txt: f.n + " " + fmtM(me) + ", " + o.n + " " + fmtM(them) + "." });
  if (won && R.st >= 3) ach(G, "war3"); if (R.w >= 10) ach(G, "war10"); if (f.pop > o.pop && R.since < G.day - 30) ach(G, "rivko");
  missionsWar(G, won);
  return { won: won, me: me, them: them };
}
// une fois par mois, la rivale tente un coup
export function rivalMonthly(G) {
  const o = rival(G); if (!o || rnd() > 0.7) return;
  const f = meF(G), x = rnd();
  if (x < 0.35) {
    const w = Object.values(G.W).filter(w => !w.fed && !w.ret && !(w.nc > G.day) && w.pop <= o.pop + 10 && !(o.onlyF && w.sx !== "f")).sort((a, b) => b.pop - a.pop)[0];
    if (!w || w.pop < 35) return;
    w.fed = o.id; w.ct = { sal: Math.round((30 + w.pop * 6) / 10) * 10, end: G.day + 365, role: w.pop > 70 ? "up" : "mid", exc: true, cl: {} }; w.br = "";
    news(G, { seg: "coul", f: "transferts", t: o.n + " signe " + w.n, txt: "La rivale de " + f.n + " frappe un grand coup sur le marché." });
    mail(G, { k: "info", from: "Ton bras droit", role: "Ton staff", c: "#c9a7ff", ini: "BD", subj: o.n + " vient de signer " + w.n, body: "La rivale a été plus rapide que nous sur " + w.n + " (popularité " + Math.round(w.pop) + ").\nGarde un œil sur les agents libres (Monde › Catcheurs).", w: w.id, imp: false });
  } else if (x < 0.7) {
    mail(G, { k: "taunt", from: gmOf(o), role: o.n, c: o.c || "#ff8a7e", ini: o.sh.slice(0, 3), fed: o.id, subj: o.n + " se moque de toi dans la presse", body: "« " + f.n + " ? Une fédération de seconde zone. Nos catcheurs ne regardent même pas leurs shows. »\nLes journalistes attendent ta réponse." });
  } else {
    const w = roster(G).filter(w => w.fed === G.me && w.ct && w.ct.end - G.day < 150 && w.pop >= 45).sort((a, b) => b.pop - a.pop)[0];
    if (!w) return; G.aiCont = G.aiCont || {}; G.aiCont[w.id] = o.id;
    mail(G, { k: "rumor", from: "Ton bras droit", role: "Ton staff", c: "#c9a7ff", ini: "BD", subj: o.n + " tourne autour de " + w.n, body: "Son contrat finit le " + shortDate(w.ct.end) + ". " + o.n + " lui a fait une offre en secret.\nSi tu ne le rassures pas, il demandera beaucoup plus à la négociation.", w: w.id });
  }
}

// ---------- missions du propriétaire ----------
const MK = ["r4", "show", "full", "war", "sign", "pop", "champ", "money", "win", "main", "hype"];
export const misTxt = (G, m) => {
  const w = m.w && G.W[m.w], o = rival(G), ev = m.ev && (G.ev || []).find(e => e.id === m.ev);
  switch (m.k) {
    case "r4": return "Faire un match à " + stars(m.v) + " ou plus";
    case "show": return "Faire un show noté " + stars(m.v) + " ou plus";
    case "full": return "Faire salle comble à un show";
    case "war": return "Battre " + (o ? o.n : "la rivale") + " aux audiences d’une semaine";
    case "sign": return "Signer un catcheur de popularité " + m.v + " ou plus";
    case "pop": return "Faire monter " + (w ? w.n : "?") + " à " + m.v + " de popularité";
    case "champ": return "Couronner un nouveau champion";
    case "money": return "Avoir " + fmtK(m.v) + " en banque";
    case "win": return "Faire gagner un match à " + (w ? w.n : "?");
    case "main": return "Un main event à " + stars(m.v) + " ou plus";
    case "hype": return "Hype " + m.v + "/10 pour " + (ev ? ev.n : "le grand show");
  }
  return "Mission";
};
// progression affichée (0 à 1) et petit texte
export function misProg(G, m) {
  const f = meF(G), w = m.w && G.W[m.w];
  if (m.k === "pop" && w) return [Math.min(1, (w.pop - m.p0) / Math.max(1, m.v - m.p0)), Math.round(w.pop) + " / " + m.v];
  if (m.k === "money") return [Math.min(1, Math.max(0, (f.money - m.p0) / Math.max(1, m.v - m.p0))), fmtK(f.money) + " / " + fmtK(m.v)];
  if (m.k === "hype") { const h = (G.hype || {})[m.ev] || 3; return [Math.min(1, h / m.v), Math.round(h) + " / " + m.v]; }
  return [0, ""];
}
function avgLast(G, n, f) { const L = (G.ev || []).filter(e => e.fed === G.me && e.done && e.res && e.res.items).sort((a, b) => b.day - a.day).slice(0, n); return L.length ? L.reduce((s, e) => s + f(e), 0) / L.length : 0; }
function makeMission(G) {
  const f = meF(G), act = (G.mis || []).filter(m => m.st === "cours").map(m => m.k), R = roster(G).filter(w => w.fed === G.me && !w.ret);
  const kd = G.diff === "facile" ? 1.25 : G.diff === "difficile" ? 0.85 : 1, rec = (G.misLog || []).slice(-3).map(m => m.k);
  const opts = MK.filter(k => act.indexOf(k) < 0 && rec.indexOf(k) < 0 && !(G.mark && k === "win"));   // mode Mark : on ne fait gagner personne
  for (let tries = 0; tries < 12; tries++) {
    const k = pick(opts); if (!k) return null;
    const m = { id: uid("mi"), k: k, from: G.day, until: G.day + 21, st: "cours" };
    if (k === "r4") { const b = avgLast(G, 3, e => Math.max(0, ...e.res.items.filter(x => x.it === "m").map(x => x.r))) || 60; m.v = clamp(r5(b + 8), 55, 95); }
    else if (k === "main") { const b = avgLast(G, 3, e => { const L = e.res.items.filter(x => x.it === "m"); return L.length ? L[L.length - 1].r : 0; }) || 60; m.v = clamp(r5(b + 6), 55, 95); }
    else if (k === "show") { const b = avgLast(G, 3, e => e.res.r) || 55; m.v = clamp(r5(b + 5), 50, 95); }
    else if (k === "full") { if ((G.ev || []).some(e => e.fed === G.me && e.res && e.res.full && e.day > G.day - 28)) continue; }
    else if (k === "war") { if (!rival(G)) continue; m.until = G.day + 15; }
    else if (k === "sign") { m.v = clamp(r5(f.pop - 5), 30, 75); m.base = R.map(w => w.id); }
    else if (k === "pop") { const w = pick(R.filter(w => w.pop >= 25 && w.pop <= 75 && !(w.inj && w.inj.until > G.day))); if (!w) continue; m.w = w.id; m.p0 = Math.round(w.pop); m.v = Math.min(99, m.p0 + 3); m.until = G.day + 28; }
    else if (k === "champ") { if (!Object.values(G.T).some(t => t.fed === G.me)) continue; }
    else if (k === "money") { m.p0 = f.money; m.v = Math.round((Math.max(f.money, 0) + Math.max(250, Math.abs(f.money) * 0.12)) / 50) * 50; m.until = G.day + 28; }
    else if (k === "win") { const w = pick(R.filter(w => (w.age <= 27 || w.pop < 40) && !(w.inj && w.inj.until > G.day))); if (!w) continue; m.w = w.id; }
    else if (k === "hype") { const nb = (G.ev || []).filter(e => e.fed === G.me && isBig(e) && !e.done && e.day - G.day >= 10).sort((a, b) => a.day - b.day)[0]; if (!nb) continue; m.ev = nb.id; m.v = Math.min(10, Math.round((G.hype || {})[nb.id] || 3) + 3); m.until = nb.day - 1; }
    m.rw = { m: Math.round((60 + f.pop * 2.5) * kd / 10) * 10, s: 4 };
    m.t = misTxt(G, m);
    return m;
  }
  return null;
}
export function initMissions(G) { if (!G.mis) G.mis = []; if (!G.misLog) G.misLog = []; }
function finish(G, m, ok) {
  m.st = ok ? "ok" : "ko"; m.end = G.day; if (ok) xpAdd(G, 15); G.misLog = (G.misLog || []).concat({ k: m.k, t: m.t, ok: ok, d: G.day, rw: m.rw }); cap(G.misLog, 40);
  const f = meF(G), sb = G.mode === "sandbox";
  if (ok) {
    f.money += m.rw.m; G.fin.cur.pub += m.rw.m; if (G.obj && !sb) G.obj.sec = clamp(G.obj.sec + m.rw.s, 0, 100);
    G.misOk = (G.misOk || 0) + 1; ach(G, "mis1"); if (G.misOk >= 10) ach(G, "mis10");
    G._pop = (G._pop || []).concat({ k: "mis", t: m.t, m: m.rw.m, s: sb ? 0 : m.rw.s }); cap(G._pop, 6);
    mail(G, { k: "info", from: "Le propriétaire", role: f.n, c: "#f5b13d", ini: "PR", subj: "Mission réussie : " + m.t, body: "Beau travail. Comme promis : +" + fmtK(m.rw.m) + (sb ? "." : " et ma confiance (+" + m.rw.s + ")."), imp: false });
  } else {
    if (G.obj && !sb) G.obj.sec = clamp(G.obj.sec - 2, 0, 100);
    mail(G, { k: "info", from: "Le propriétaire", role: f.n, c: "#ff8a7e", ini: "PR", subj: "Mission ratée : " + m.t, body: "Le délai est passé. Je suis déçu." + (sb ? "" : " (Confiance −2)"), imp: false });
  }
  G.mis = G.mis.filter(x => x !== m);
}
// chaque jour : objectifs qui se vérifient au jour le jour, délais, nouvelles missions (3 au plus, une par jour)
export function missionsDaily(G) {
  initMissions(G); const f = meF(G), R = roster(G).filter(w => w.fed === G.me);
  G.mis.slice().forEach(m => {
    if (m.k === "sign" && R.some(w => w.pop >= m.v && (m.base || []).indexOf(w.id) < 0)) return finish(G, m, true);
    if (m.k === "pop") { const w = G.W[m.w]; if (!w || w.fed !== G.me) { G.mis = G.mis.filter(x => x !== m); return; } if (w.pop >= m.v) return finish(G, m, true); }
    if (m.k === "money" && f.money >= m.v) return finish(G, m, true);
    if (m.k === "hype" && ((G.hype || {})[m.ev] || 0) >= m.v) return finish(G, m, true);
    if (m.k === "win" && (!G.W[m.w] || G.W[m.w].fed !== G.me)) { G.mis = G.mis.filter(x => x !== m); return; }
    if (G.day > m.until) finish(G, m, false);
  });
  if (G.over || G.day < 3) return;
  if (G.mis.length < 3 && (G.misNew || -9) < G.day) { const m = makeMission(G); if (m) { G.mis.push(m); G.misNew = G.day; } }
}
// après un de tes shows
export function missionsShow(G, ev) {
  initMissions(G); const r = ev.res || {}, ms = (r.items || []).filter(x => x.it === "m");
  G.mis.slice().forEach(m => {
    if (m.k === "r4" && ms.some(x => x.r >= m.v)) finish(G, m, true);
    else if (m.k === "show" && r.r >= m.v) finish(G, m, true);
    else if (m.k === "full" && r.full) finish(G, m, true);
    else if (m.k === "champ" && ms.some(x => x.change && G.T[x.title] && G.T[x.title].fed === G.me)) finish(G, m, true);
    else if (m.k === "win" && ms.some(x => typeof x.win === "number" && (x.sides[x.win] || []).indexOf(m.w) >= 0)) finish(G, m, true);
    else if (m.k === "main" && ms.length && ms[ms.length - 1].r >= m.v) finish(G, m, true);
  });
}
function missionsWar(G, won) { (G.mis || []).slice().forEach(m => { if (m.k === "war" && won) finish(G, m, true); }); }
