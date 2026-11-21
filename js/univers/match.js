// Mode Univers v2 : les matchs, les segments et les shows (cartes de l'IA, estimation, show en direct depuis la Gorilla position,
// rapport de match détaillé et conséquences). Un show = liste ordonnée ev.items : { it: "m", t, sides, title, stip, fin, cons, dur, win, spots,
// oc, tour, trad, mgr } (match) ou { it: "s", k, w: [ids], t } (segment). Le show en direct et le show « passé » utilisent le même moteur.
import { missionsShow } from "./goals.js";
import { clamp, rnd, pick, dateOf, dayLabel, fmtM, fmtK, stars, STY_FAT, STY_INJ } from "./world.js";
import { MT, STIP, FIN, CONS, DUR, ENT, SEG, CITIES, VENUES } from "./data.js";
import { meF, wn, roster, avail, mail, news, buzz, FANS, relGet, relAdd, staffQ, ach, isBig, champIds, teamName, sideName, ini, e_, cap } from "./base.js";
import { fitOf, gimOf } from "./v2.js";
import { dnaBonus, dnaShow, sportWinner, markFinish } from "./dna.js";
import { pleMix } from "./brand.js";
import { bondPerf, vnAfterShow, promiseKept } from "./vn.js";
import { heroBonus, ENTX, entOf, entCost, hasTal, extraAfterShow } from "./extra.js";

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const CHEM = { "aer|aer": 5, "pur|pur": 6, "tec|tec": 5, "bag|bag": 3, "aer|tec": 3, "aer|bag": 2, "bag|pur": 4, "pur|tec": 4, "aer|pur": 3, "bag|tec": 1 };
const chemOf = (a, b) => a === "equ" || b === "equ" ? 2 : CHEM[[a, b].sort().join("|")] || 1;
export const SPOTS = { saut: ["Grand saut", 4, 1.5], interf: ["Interférence", 1, 1], contre: ["Finisher contré", 3, 1.1], public: ["Bagarre dans le public", 3, 1.3], table: ["Table brisée", 3, 1.4], signature: ["Prise signature à l’extérieur", 2, 1.2] };
export const mtOf = m => MT[m.t] || MT.simple;
export const idsOf = m => (m.sides || []).reduce((s, x) => s.concat(x || []), []).filter(Boolean);
export const cityOf = (G, ev) => CITIES[(ev.city != null ? ev.city : ((G.F[ev.fed] || {}).home || 0)) % CITIES.length];
export function heatBetween(G, sides) {
  if (!sides || sides.length < 2) return null;
  return (G.sl || []).find(x => !x.done && sides.some((s, i) => sides.some((o, j) => i !== j && x.a.some(q => s.indexOf(q) >= 0) && x.b.some(q => o.indexOf(q) >= 0)))) || null;
}
const muKey = sides => sides.map(s => s.slice().sort().join("+")).sort().join("|");
export const muCount = (G, sides) => ((G.mu || {})[muKey(sides)] || []).filter(d => d > G.day - 30).length;
const showLen = (G, ev) => ev.len || (isBig(ev) ? 240 : ((G.F[ev.fed] || {}).slot || {}).len || 120);
export const itemMin = it => it.it === "s" ? (SEG[it.k] || SEG.promo).min : (MT[it.t] && MT[it.t].dur) || (DUR[it.dur] || DUR.moyen)[1];
export const timeOf = (G, ev) => (ev.items || []).reduce((s, it) => s + itemMin(it) + (it.it === "m" ? 3 : 1), 8);

// ---------- règles : hommes / femmes / intergender, taille des camps ----------
export function checkMatch(G, ev, m) {
  const T = mtOf(m), S = (m.sides || []).filter(s => s.length), f = G.F[ev.fed] || {};
  if (m.t === "open") { if (!S[0] || !S[0].length) return "Choisis qui lance l’open challenge"; return ""; }
  const ns = T.s === "n" ? [T.min, T.max] : [T.s, T.s];
  if (S.length < ns[0]) return "Il faut au moins " + ns[0] + " camps";
  if (S.length > ns[1]) return ns[1] + " camps au maximum";
  const pp = Array.isArray(T.p) ? T.p : [T.p, T.p];
  if (m.t === "handicap") { const l = S.map(s => s.length).sort(); if (l[0] !== 1 || l[1] !== 2) return "Handicap : 1 contre 2"; }
  else if (S.some(s => s.length < pp[0] || s.length > pp[1])) return "Chaque camp doit avoir " + (pp[0] === pp[1] ? pp[0] : pp[0] + " à " + pp[1]) + " catcheur" + (pp[1] > 1 ? "s" : "");
  const W = idsOf(m).map(i => G.W[i]).filter(Boolean), t = m.title && G.T[m.title];
  if (T.mix) { if (S.some(s => !(s.some(i => G.W[i] && G.W[i].sx === "h") && s.some(i => G.W[i] && G.W[i].sx === "f")))) return "Équipes mixtes : 1 homme et 1 femme par camp"; }
  else if (t) { if (t.cat !== "x" && W.some(w => w.sx !== t.cat)) return "Ce titre est " + (t.cat === "f" ? "féminin" : "masculin"); }
  else if (!f.mixed && W.length && W.some(w => w.sx !== W[0].sx)) return "Matchs hommes contre femmes désactivés (Bureau › Réglages)";
  if (t && t.div === "tag" && S.some(s => s.length !== 2) && !T.mix) return "Un titre par équipes se joue à 2 contre 2";
  return "";
}

// ---------- la note d'un match (sans le hasard) ----------
function parts(G, ev, m) {
  const T = mtOf(m), S = (m.sides || []).map(s => s.map(i => G.W[i]).filter(Boolean)).filter(s => s.length), all = S.reduce((a, s) => a.concat(s), []);
  if (S.length < 2 && m.t !== "open") return null;
  const c = cityOf(G, ev), t = m.title && G.T[m.title], D = (MT[m.t] && MT[m.t].dur) || (DUR[m.dur] || DUR.moyen)[1];
  const ring = avg(all.map(w => w.st[1])) * 0.5 + avg(all.map(w => w.st[6])) * 0.12 + avg(all.map(w => w.st[3])) * 0.1 + avg(all.map(w => w.st[5])) * 0.08 + 12;
  let chem = S.length >= 2 ? chemOf(S[0][0].sty, S[1][0].sty) : 2;
  S.forEach(s => { if (s.length >= 2) chem += Math.max(-4, Math.min(5, relGet(G, s[0].id, s[1].id) / 18)); });
  if (S.length >= 2) { const r = relGet(G, S[0][0].id, S[1][0].id); if (r < 0) chem += Math.min(4, -r / 22); }
  const sl = heatBetween(G, m.sides); let story = sl ? 3 + sl.heat / 12 : 0;
  if (t) story += 2 + (t.pres || 50) / 25; if (m.stip) story += /career|mask|hair|maskhair|loser|retire/.test(m.stip) ? 6 : 3;
  if (m.trad) story += 3; if (m.tour) story += 2;
  let crowd = (c ? c[1] : 0) * 0.6 + avg(all.map(w => (w.crowd || 40) - 45)) / 9 + avg(all.map(w => w.mom || 0)) / 12 + (ENT[ev.ent || 0] || ENT[0])[2] * 0.6;
  if (c && all.some(w => c[2].indexOf(w.sty) >= 0)) crowd += 2;
  all.forEach(w => { if (w.farewell && w.farewell.until >= G.day) crowd += 3; });
  let dur = 0; const en = avg(all.map(w => w.st[4]));
  if (D >= 22) dur += en > 70 ? 4 : en > 55 ? 0 : -6; if (D >= 30) dur += en > 75 ? 2 : -5; if (D <= 8 && S[0][0].sty === "bag") dur += 3;
  let extra = T.q + (CONS[m.cons || ""] || CONS[""])[1] + (FIN[m.fin || "auto"] || FIN.auto)[1];
  (m.spots || []).forEach(s => { if (SPOTS[s]) extra += SPOTS[s][1]; });
  const tired = all.filter(w => w.en < 40).length; extra -= tired * 2.5; all.forEach(w => { if (w.inj && w.inj.play && w.inj.until > G.day) extra -= 4; });
  const mu = muCount(G, m.sides); if (mu >= 2) extra -= (mu - 1) * 3;
  const prod = staffQ(G, "prod"), comm = ev.comm && ev.comm.length ? avg(ev.comm.map(i => (G.staff[i] || {}).q || 40)) : staffQ(G, "comm");
  const staff = ev.fed === G.me && !ev.ai ? (prod ? (prod - 50) / 12 : -2) + (comm ? (comm - 50) / 15 : -3) : 1;
  extra += dnaBonus(G, ev, m, all, D) + (ev.fed === G.me && !ev.ai ? bondPerf(G, all) : 0);
  if (ev.fed === G.me && !ev.ai) crowd += heroBonus(G, ev, all) + (ENTX[entOf(ev, m)] || ENTX[0])[2] * 0.6 + (hasTal(G, "show") ? 2 : 0);   // héros local, entrée spectaculaire, talent Showman   // le lien GM ↔ catcheurs (caché)
  return { ring: ring, chem: chem, story: story, crowd: crowd, dur: dur, extra: extra, staff: staff, sl: sl, mu: mu, tired: tired };
}
export function estimate(G, ev, it) {
  if (it.it === "s") { const W = (it.w || []).map(i => G.W[i]).filter(Boolean), S = SEG[it.k] || SEG.promo; if (S.p && !W.length) return { r: 0, warn: ["Choisis qui participe"] }; const q = W.length ? avg(W.map(w => avg(S.st.map(i => w.st[i])))) * 0.72 + 14 : 45 + staffQ(G, "gm") / 6; return { r: clamp(q + ((cityOf(G, ev) || [0, 0])[1]) * 0.4, 5, 100), warn: [] }; }
  const P = parts(G, ev, it); if (!P) return { r: 0, warn: ["Le match n’est pas complet"] };
  const r = clamp(P.ring + P.chem + P.story + P.crowd + P.dur + P.extra + P.staff, 5, 100), warn = [];
  if (P.tired) warn.push(P.tired + " catcheur" + (P.tired > 1 ? "s" : "") + " fatigué" + (P.tired > 1 ? "s" : "") + " : moins bon match, risque de blessure");
  if (P.mu >= 2) warn.push("Affiche usée : ce match a déjà eu lieu " + P.mu + " fois ce mois-ci");
  if (P.sl) warn.push("Storyline « " + P.sl.n + " » : heat " + P.sl.heat);
  idsOf(it).forEach(i => { const w = G.W[i]; if (w && w.rec && w.lossRun >= 4) warn.push(w.n + " a perdu " + w.lossRun + " fois de suite : il ne fait plus peur"); });
  return { r: r, warn: warn, P: P };
}
export function estimateShow(G, ev) {
  const L = (ev.items || []).map(it => estimate(G, ev, it).r).filter(Boolean); if (!L.length) return 0;
  const w = L.map((x, i) => i === L.length - 1 ? 2 : 1); return L.reduce((s, x, i) => s + x * w[i], 0) / w.reduce((s, x) => s + x, 0);
}

// ---------- le vainqueur ----------
function pickWinner(G, m) {
  const S = m.sides.map(s => s.map(i => G.W[i]).filter(Boolean)), t = m.title && G.T[m.title], ch = t ? champIds(t) : [];
  const sc = S.map(s => avg(s.map(w => w.pop + (w.push || 0) * 12 + (w.mom || 0) / 2 + w.st[5] * 0.4 + ((G.prom || []).some(p => p.w === w.id && p.st === "cours" && p.t === "wintitle") && t ? 40 : 0))) + (s.some(w => ch.indexOf(w.id) >= 0) ? 14 : 0) + rnd() * 42);
  if (rnd() < (S.length > 2 ? 0 : 0.035)) return "nul";
  return sc.indexOf(Math.max(...sc));
}
function autoFin(G, m, winSide, rnd2) {
  const S = m.sides.map(s => s.map(i => G.W[i]).filter(Boolean)), W = S[winSide] || [];
  if (/battle|rumble|gauntlet|chamber|ladder|tlc|ultimatex|wargames|cage|cell|lms|iquit|ironman|falls|nodq|fca/.test(m.t)) return m.t === "iquit" || m.t === "sub" ? "subm" : "clean";
  if (m.t === "sub") return "subm";
  const heel = W.some(w => w.al === "heel"), mgr = (m.mgr || []).length;
  const x = rnd2();
  if (heel && x < 0.18) return "cheat"; if (heel && mgr && x < 0.3) return "interf"; if (x < 0.035) return "dq"; if (x < 0.05) return "co";
  if (W.some(w => w.st[1] > 70 && w.sty === "tec") && x < 0.35) return "subm"; if (x > 0.93) return "rollup"; return "clean";
}

// ---------- jouer un match (après le direct éventuel) ----------
// mod = ordres donnés en direct : { faster, longer, win, runin, medic, cut }
export function simMatch(G, ev, m, mod) {
  mod = mod || {};
  const T = mtOf(m); let P = parts(G, ev, m);
  if (!P) return null;
  const mine = ev.fed === G.me && !ev.ai, sides = m.sides.map(s => s.slice()), S = sides.map(s => s.map(i => G.W[i]).filter(Boolean)), all = S.reduce((a, s) => a.concat(s), []);
  let q = P.ring + P.chem + P.story + P.crowd + P.dur + P.extra + P.staff + (rnd() - 0.5) * 14;
  const notes = [], botch = [], inj = [];
  if (mod.faster) q -= 2; if (mod.longer) q += avg(all.map(w => w.st[4])) > 65 ? 3 : -4; if (mod.cut) { q -= 10; notes.push("La télé a coupé avant la fin du match !"); }
  if (mod.chant) { q -= 4; notes.push("Le public scandait le nom de " + wn(G, mod.chant) + " pendant le match"); }
  // botchs
  const prod = mine ? staffQ(G, "prod") : 50, cf = (CONS[m.cons || ""] || CONS[""])[2];
  all.forEach(w => { const p = 0.025 * (1 + (60 - w.st[6]) / 40) * T.i * (w.en < 40 ? 1.6 : 1) * cf * (1 - prod / 220); if (rnd() < p) { const major = rnd() < 0.25; botch.push({ w: w.id, sev: major ? 2 : 1 }); q -= major ? 8 : 3; } });
  if (mod.botch) { botch.push({ w: mod.botch, sev: 1 }); q -= 3; }
  const rating = clamp(q, 5, 100);
  // vainqueur et fin
  // mode Mark : personne ne choisit le vainqueur, le match se joue comme un vrai sport
  let win = G.mark ? sportWinner(G, m, mod) : mod.win != null ? mod.win : m.win;
  if (win == null || win === "ia" || win === "") win = pickWinner(G, m);
  if (typeof win === "string" && win !== "nul") win = +win;
  let fin = m.fin && m.fin !== "auto" && !G.mark ? m.fin : win === "nul" ? pick(["dco", "nc", "dq"]) : autoFin(G, m, win, rnd);
  if (G.mark) { const mf = markFinish(G, m, mod, win, fin, notes); win = mf.win; fin = mf.fin; if (mod.restarted) q += 3; }
  if (mod.runin) { fin = "interf"; notes.push(wn(G, mod.runin) + " est intervenu" + e_(G.W[mod.runin]) + " !"); }
  if (mod.medic) { fin = "nc"; win = "nul"; notes.push("Le médecin a arrêté le match"); }
  if (win === "nul" && fin === "clean") fin = "dco";
  const ws = typeof win === "number" ? S[win] || [] : [], ls = typeof win === "number" ? S.filter((s, i) => i !== win).reduce((a, s) => a.concat(s), []) : [];
  // fatigue et blessures
  const D = (MT[m.t] && MT[m.t].dur) || (DUR[m.dur] || DUR.moyen)[1], medQ = mine ? staffQ(G, "med") : 50;
  let spotF = 1; (m.spots || []).forEach(s => { if (SPOTS[s]) spotF *= SPOTS[s][2]; });
  all.forEach(w => {
    w.en = clamp(w.en - D * (STY_FAT[w.sty] || 1) * (1.3 - w.st[4] / 200) * T.f * (m.cons === "wild" ? 1.2 : m.cons === "safe" ? 0.85 : 1) * (mod.faster ? 0.85 : mod.longer ? 1.15 : 1) * Math.min(1.6, spotF));
    w.last = G.day; w.nm = (w.nm || 0) + 1; w.sr = (w.sr || 0) + rating;
    const play = w.inj && w.inj.play && w.inj.until > G.day;
    let p = (0.004 + Math.max(0, 60 - w.en) * 0.0007) * (STY_INJ[w.sty] || 1) * T.i * (m.cons === "wild" ? 1.4 : m.cons === "safe" ? 0.7 : 1) * (D >= 22 ? 1.25 : 1) * Math.min(2, spotF) * (play ? 3 : 1) * (G.diff === "facile" && w.fed === G.me ? 0.7 : 1);
    if (botch.some(b => b.sev === 2) && rnd() < 0.3) p += 0.2;
    if (mod.injW === w.id) p = 1;
    if (rnd() < p) {
      let wk = 1 + Math.floor(Math.pow(rnd(), 2) * 10); if (play) wk += 3; if (mod.medic && mod.injW === w.id) wk = Math.max(1, wk - 3);
      if (w.fed === G.me) wk = Math.max(1, Math.round(wk * (1 - medQ / 250)));
      const grave = wk >= 6;
      w.inj = { until: G.day + wk * 7, what: pick(grave ? ["Genou (ligaments)", "Épaule luxée", "Commotion", "Cou"] : ["Entorse de la cheville", "Côtes", "Genou", "Dos", "Épaule"]), grave: grave };
      inj.push({ w: w.id, wk: wk }); notes.push(w.n + " s’est blessé" + e_(w) + " (" + wk + " sem.)");
      if (w.fed === G.me) mail(G, { k: "inj", from: "Le médecin", role: "Ton staff", c: "#ff8a7e", ini: "DR", subj: w.n + " : " + w.inj.what.toLowerCase() + ", " + wk + " semaine" + (wk > 1 ? "s" : ""), body: w.n + " s’est blessé" + e_(w) + " pendant son match.\nRetour prévu : " + dayLabel(w.inj.until) + "." + (grave ? "\nC’est grave : il faut être patient." : "\nUn spécialiste peut raccourcir l’absence (50 k$)."), w: w.id });
      else if (w.pop >= 70) news(G, { seg: "coul", f: "blessures", t: w.n + " blessé" + e_(w), txt: w.n + " (" + ((G.F[w.fed] || {}).n || "") + ") est absent" + e_(w) + " environ " + wk + " semaine" + (wk > 1 ? "s" : "") + "." });
    }
  });
  // conséquences : bilan, popularité, élan, moral, public
  const cons = [], gm = w => { const g = gimOf(w); return (0.75 + fitOf(w, g.t) / 200) * (0.7 + (g.fresh || 100) / 330); };
  let hero = "", buried = "";
  all.forEach(w => {
    const won = ws.indexOf(w) >= 0, draw = win === "nul"; let dp = 0, dm = 0;
    if (draw) { w.rec[2]++; dp = rating / 160; }
    else if (won) { w.rec[0]++; w.lossRun = 0; w.winRun = (w.winRun || 0) + 1; dp = (0.5 + rating / 90 + (m.title ? 1 : 0) + (w.push || 0) * 0.6) * gm(w); dm = fin === "clean" || fin === "subm" ? 8 : 5; w.mor = clamp(w.mor + 2); }
    else { w.rec[1]++; w.lossRun = (w.lossRun || 0) + 1; w.winRun = 0; dp = m.cons === "protect" ? 0 : -0.4 + (rating > 75 ? 0.6 : 0); dm = m.cons === "protect" ? -2 : -5; w.mor = clamp(w.mor - 1); }
    if (m.cons === "squash") dp += won ? 1.5 : -1.5; if (m.cons === "strong") dp += 0.5;
    if (w.farewell && w.farewell.until >= G.day) dp += 0.5;
    w.pop = clamp(w.pop + dp, 1, 99); w.mom = clamp((w.mom || 0) + dm, -50, 50);
    if (rating >= 72 && w.pop < 58) w.crowd = clamp((w.crowd || 40) + 2 + (w.st[3] > 65 ? 2 : 0));
    if (won && w.al === "face" && (fin === "clean" || fin === "subm")) w.crowd = clamp((w.crowd || 40) + 1);
    cons.push({ w: w.id, pop: Math.round(dp * 10) / 10, mom: dm });
    // promesse « ne jamais perdre proprement »
    if (!won && !draw && (fin === "clean" || fin === "subm") && w.fed === G.me && w.ct && w.ct.cl && w.ct.cl.noclean) { w.mor = clamp(w.mor - 20); notes.push(w.n + " est furieux" + e_(w) + " : son contrat dit qu’il ne perd jamais proprement"); }
  });
  if (ws.length && rating >= 65) hero = ws.slice().sort((a, b) => b.st[5] - a.st[5])[0].id;
  if (ls.length && rating >= 70 && m.cons !== "squash") { const L = ls.slice().sort((a, b) => b.st[1] - a.st[1])[0]; if (L) cons.find(c => c.w === L.id).up = 1; }
  if (ls.length && (m.cons === "squash" || (D <= 8 && fin === "clean"))) buried = ls[0].id;
  // relations
  S.forEach((s, i) => { for (let a = 0; a < s.length; a++) for (let b = a + 1; b < s.length; b++) relAdd(G, s[a].id, s[b].id, i === win ? 5 : 2); });
  if (P.sl) S[0].forEach(a => S.slice(1).forEach(o => o.forEach(b => relAdd(G, a.id, b.id, -2))));
  botch.forEach(b => { const vic = all.find(w => w.id !== b.w); if (vic) relAdd(G, b.w, vic.id, b.sev === 2 ? -10 : -4); const bw = G.W[b.w]; if (bw && bw.fed === G.me) bw.mor = clamp(bw.mor - 2); });
  // storyline
  if (P.sl) { P.sl.kinds = (P.sl.kinds || []).concat("match"); const wq = mine ? staffQ(G, "writer") : 50; P.sl.heat = clamp(P.sl.heat + 6 * (1 + wq / 150) + (rating > 75 ? 2 : 0)); P.sl.met = G.day; }
  (G.teams || []).forEach(t => { S.forEach(s => { if (s.length === 2 && t.m.indexOf(s[0].id) >= 0 && t.m.indexOf(s[1].id) >= 0) t.chem = clamp(t.chem + 2); }); });
  // titre
  let change = false; const t = m.title && G.T[m.title];
  if (t) {
    const ch = champIds(t), cs = ch.length ? sides.findIndex(s => ch.every(i => s.indexOf(i) >= 0)) : -1;
    const okFin = !(fin === "dq" || fin === "co" || fin === "dco" || fin === "nc");
    if (typeof win === "number" && win !== cs && okFin) {
      const nw = sides[win].slice(); if (t.hist && t.hist.length) t.hist[t.hist.length - 1].to = G.day;
      const short = G.day - t.since < 14 && ch.length; t.champ = t.div === "tag" ? nw.slice(0, 2) : nw[0]; t.since = G.day; t.defs = 0; change = true;
      t.hist = (t.hist || []).concat({ w: champIds(t), from: G.day, defs: 0 }); cap(t.hist, 60);
      t.pres = clamp((t.pres || 50) + (short ? -4 : 1) + (rating > 75 ? 1 : 0));
      ws.forEach(w => { w.pop = clamp(w.pop + 4 * (0.6 + (t.pres || 50) / 125), 1, 99); w.mor = clamp(w.mor + 10); w.hist.push({ d: G.day, t: "Remporte le " + t.n }); cap(w.hist, 40); });
      (G.prom || []).forEach(p => { if (p.st === "cours" && p.t === "wintitle" && nw.indexOf(p.w) >= 0) { p.st = "tenue"; const w = G.W[p.w]; if (w) w.mor = clamp(w.mor + 15); } });
      news(G, { seg: "ecran", f: t.fed === G.me ? "nous" : "autres", t: (t.fed === G.me ? "" : ((G.F[t.fed] || {}).n || "") + " : ") + "nouveau champion !", txt: teamName(G, nw) + " remporte le " + t.n + (ev.n ? " à " + ev.n : "") + "." });
      if (t.fed === G.me) ach(G, "title");
    } else if (cs >= 0) { t.defs = (t.defs || 0) + 1; if (t.hist && t.hist.length) t.hist[t.hist.length - 1].defs = t.defs; t.pres = clamp((t.pres || 50) + (rating >= 70 ? 2 : rating < 45 ? -1 : 0)); t.lastDef = G.day; }
  }
  // mallette en jeu
  if (m.stip === "case" && typeof win === "number" && sides[win][0]) { G.mitb = (G.mitb || []).concat({ w: sides[win][0], fed: ev.fed, until: G.day + 365, n: m.caseN || "Mallette" }); notes.push(wn(G, sides[win][0]) + " gagne la mallette !"); }
  // affiche usée
  G.mu = G.mu || {}; const k = muKey(sides); G.mu[k] = (G.mu[k] || []).filter(d => d > G.day - 60).concat(G.day);
  if (Object.keys(G.mu).length > 400) Object.keys(G.mu).slice(0, 100).forEach(x => delete G.mu[x]);
  const res = { it: "m", t: m.t, sides: sides, win: win, r: rating, fin: fin, title: m.title || "", change: change, notes: notes, botch: botch, inj: inj, cons: cons, hero: hero, buried: buried, dur: m.dur, stip: m.stip || "", tour: m.tour || null, trad: m.trad || "",
    parts: { ring: Math.round(P.ring), chem: Math.round(P.chem), story: Math.round(P.story), crowd: Math.round(P.crowd), dur: Math.round(P.dur) } };
  if (!G.best.match || rating > G.best.match.r) G.best.match = { r: rating, d: G.day, txt: sideName(G, sides) + (ev.n ? ", " + ev.n : ""), y: dateOf(G.day).y };
  G.topM = (G.topM || []).concat({ r: rating, d: G.day, txt: sideName(G, sides), ev: ev.n, fed: ev.fed }).sort((a, b) => b.r - a.r).slice(0, 20);
  return res;
}
// ---------- un segment ----------
export function simSeg(G, ev, s) {
  const S = SEG[s.k] || SEG.promo, W = (s.w || []).map(i => G.W[i]).filter(Boolean), notes = [];
  let q = estimate(G, ev, s).r + (rnd() - 0.5) * 16;
  if (S.p && !W.length) return null;
  const mine = ev.fed === G.me && !ev.ai;
  W.forEach(w => { w.pop = clamp(w.pop + (q - 55) / 25 + (S.pop ? 1.5 : 0), 1, 99); w.last = w.last < G.day ? G.day - 1 : w.last; });
  const sl = W.length >= 2 ? heatBetween(G, [[W[0].id], [W[1].id]]) : W.length ? (G.sl || []).find(x => !x.done && (x.a.indexOf(W[0].id) >= 0 || x.b.indexOf(W[0].id) >= 0)) : null;
  if (sl) sl.kinds = (sl.kinds || []).concat(s.k);
  if (sl && S.heat) { sl.heat = clamp(sl.heat + S.heat * (1 + (mine ? staffQ(G, "writer") : 50) / 150) * (q > 60 ? 1 : 0.6)); sl.met = G.day; }
  if (W.length >= 2 && S.rel) relAdd(G, W[0].id, W[1].id, S.rel);
  if (S.brawl && W.length >= 2 && rnd() < S.brawl) { notes.push("La signature tourne à la bagarre !"); if (sl) sl.heat = clamp(sl.heat + 5); }
  if (S.turn && W[0] && W[0].al === "face") { W[0].al = "heel"; W[0].hist.push({ d: G.day, t: "Heel turn (trahison)" }); notes.push(W[0].n + " trahit " + (W[1] ? W[1].n : "son camp") + " : heel turn !"); news(G, { seg: "ecran", f: mine ? "nous" : "autres", t: W[0].n + " trahit " + (W[1] ? W[1].n : "les siens") + " !", txt: "Le public n’en revient pas." }); if (mine) ach(G, "turn"); }
  if (s.k === "alliance" && W.length >= 2) notes.push("Une alliance est née entre " + W[0].n + " et " + W[1].n);
  if (S.hype && mine) { const nb = nextBig(G); if (nb) G.hype[nb.id] = clamp((G.hype[nb.id] || 3) + S.hype * (q > 60 ? 1 : 0.5), 0, 10); }
  if (s.k === "debut" || s.k === "sign") W.forEach(w => { if (w.secret) { const big = !w.leak; q += big ? 12 : 4; w.pop = clamp(w.pop + (big ? 4 : 1.5), 1, 99); notes.push(big ? "Personne ne s’y attendait : énorme réaction pour " + w.n + " !" : "Les fans savaient déjà (fuite)…"); w.secret = false; if (mine) buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#6fb3ff", txt: big ? "QUOI ?! " + w.n + " est là ! Je hurle !" : "Bon, on savait pour " + w.n + "…" }); } });
  return { it: "s", k: s.k, w: (s.w || []).slice(), r: clamp(q, 5, 100), notes: notes };
}
export const nextBig = (G, fed) => (G.ev || []).filter(e => e.fed === (fed || G.me) && isBig(e) && !e.done && e.day >= G.day).sort((a, b) => a.day - b.day)[0];

// ---------- cartes faites par l'IA ----------
const NEWM = (t, sides, o) => Object.assign({ it: "m", t: t, sides: sides, title: "", stip: "", fin: "auto", cons: "", dur: "moyen", win: "ia", spots: [] }, o || {});
export function autoCard(G, ev) {
  const f = G.F[ev.fed], big = isBig(ev), used = new Set(), BR = ev.br || (G.solo && ev.fed === G.me && !ev.ai ? G.solo : ""), okB = i => !BR || !f.split || !G.W[i].br || G.W[i].br === BR;   // WWE un seul show : mes grands événements = mon show
  const gu = (G.appear || []).filter(a => a.ev === ev.id && a.k === "match").map(a => G.W[a.w]).filter(Boolean);
  const pool = roster(G, ev.fed).concat(gu.filter(w => roster(G, ev.fed).indexOf(w) < 0)).filter(w => (w.ret ? !w.staff : avail(G, w, ev.day)) && w.en >= 25 && !(G.rest && G.rest[w.id] > G.day) && !w.secret && (!BR || !f.split || !w.br || w.br === BR)).sort((a, b) => (b.pop + rnd() * 25) - (a.pop + rnd() * 25));
  const take = (sx, ex) => { const w = pool.find(x => !used.has(x.id) && (!sx || x.sx === sx) && (!ex || ex.indexOf(x.id) < 0)); if (w) used.add(w.id); return w; };
  const items = [];
  // matchs de tournoi en attente
  (G.tours || []).filter(t => t.fed === ev.fed && !t.win).forEach(t => { const pm = pendingTour(G, t, ev).slice(0, big ? 2 : 1); pm.forEach(x => { if (x.m.every(i => !used.has(i) && G.W[i] && okB(i) && avail(G, G.W[i], ev.day))) { x.m.forEach(i => used.add(i)); items.push(x.g ? NEWM("gauntlet", x.m.map(i => [i]), { tour: { id: t.id, k: x.k }, dur: "long" }) : NEWM("simple", [[x.m[0]], [x.m[1]]], { tour: { id: t.id, k: x.k }, dur: x.fin ? "long" : "moyen" })); } }); });
  // tradition du mois au grand show
  if (big) (G.trad || []).filter(x => x.fed === ev.fed && x.on && x.k === "match" && x.m === dateOf(ev.day).m && !(x.done || {})[dateOf(ev.day).y]).forEach(x => {
    (x.x === "hf" ? ["h", "f"] : [x.x]).forEach(sx => { if (x.t === "simple" && x.pr === "apuestas") { const a = take(sx), b = take(sx); if (a && b) items.push(NEWM("simple", [[a.id], [b.id]], { trad: x.id, stip: "maskhair", dur: "long" })); return; }
      const T = MT[x.t] || MT.battle, n = Math.min(x.z || 6, T.s === "n" ? T.max : T.s * (Array.isArray(T.p) ? T.p[0] : T.p)), L = [];
      for (let i = 0; i < n; i++) { const w = take(sx); if (w) L.push(w.id); }
      if (L.length < (T.s === "n" ? T.min : 2)) { L.forEach(i => used.delete(i)); return; }
      const sides = x.t === "wargames" ? [L.slice(0, Math.floor(L.length / 2)), L.slice(Math.floor(L.length / 2))] : L.map(i => [i]);
      items.push(NEWM(x.t, sides, { trad: x.id, dur: "long", stip: x.pr === "case" ? "case" : "", caseN: x.n }));
    });
  });
  // titres en jeu
  const titles = Object.values(G.T).filter(t => t.fed === ev.fed && (big || rnd() < 0.22));
  titles.forEach(t => {
    if (items.length >= (big ? 8 : 4)) return;
    const ch = champIds(t).filter(i => G.W[i] && okB(i) && avail(G, G.W[i], ev.day) && !used.has(i) && (!BR || !f.split || !G.W[i].br || G.W[i].br === BR));
    const sx = t.cat === "x" ? "" : t.cat;
    if (t.div === "tag") {
      if (ch.length !== 2 && champIds(t).length) return;
      const tm = (G.teams || []).find(x => x.fed === ev.fed && x.m.every(i => G.W[i] && okB(i) && avail(G, G.W[i], ev.day) && !used.has(i) && ch.indexOf(i) < 0 && (!sx || G.W[i].sx === sx)));
      if (!tm) return; ch.concat(tm.m).forEach(i => used.add(i));
      if (ch.length === 2) items.push(NEWM("tag", [ch.slice(), tm.m.slice()], { title: t.id }));
      return;
    }
    if (champIds(t).length && !ch.length) return;
    ch.forEach(i => used.add(i));
    const ex = (G.shots || []).find(s => s.t === t.id && G.W[s.w] && !used.has(s.w) && avail(G, G.W[s.w], ev.day));
    const opp = ex ? (used.add(ex.w), G.W[ex.w]) : take(sx || (ch[0] && G.W[ch[0]].sx), ch);
    if (ex) G.shots = G.shots.filter(s => s !== ex);
    if (!opp) { ch.forEach(i => used.delete(i)); return; }
    if (!ch.length) { const o2 = take(opp.sx); if (o2) items.push(NEWM("simple", [[opp.id], [o2.id]], { title: t.id })); return; }
    items.push(NEWM("simple", [ch.slice(0, 1), [opp.id]], { title: t.id, dur: big ? "long" : "moyen" }));
  });
  // storylines
  (G.sl || []).filter(s => !s.done && s.fed === ev.fed).forEach(s => { if (items.length >= (big ? 8 : 5)) return; const a = s.a.find(i => G.W[i] && !used.has(i) && avail(G, G.W[i], ev.day)), b = s.b.find(i => G.W[i] && !used.has(i) && avail(G, G.W[i], ev.day)); if (a && b && G.W[a].sx === G.W[b].sx) { used.add(a); used.add(b); items.push(NEWM("simple", [[a], [b]], { dur: big ? "long" : "moyen" })); } });
  // le reste de la carte
  const want = big ? 7 : 4; let guard = 0;
  while (items.filter(x => x.it === "m").length < want && guard++ < 12) {
    const sx = rnd() < 0.68 ? "h" : "f";
    if (rnd() < 0.22) { const tm = (G.teams || []).filter(x => x.fed === ev.fed && x.m.every(i => G.W[i] && okB(i) && avail(G, G.W[i], ev.day) && !used.has(i) && G.W[i].sx === sx)); if (tm.length >= 2) { tm[0].m.concat(tm[1].m).forEach(i => used.add(i)); items.push(NEWM("tag", [tm[0].m.slice(), tm[1].m.slice()])); continue; } }
    if (big && rnd() < 0.2) { const a = take(sx), b = take(sx), c = take(sx); if (a && b && c) { items.push(NEWM("triple", [[a.id], [b.id], [c.id]])); continue; } [a, b, c].forEach(x => x && used.delete(x.id)); }
    const a = take(sx), b = a && take(sx); if (!a || !b) { if (a) used.delete(a.id); continue; }
    items.push(NEWM("simple", [[a.id], [b.id]], { dur: pick(["court", "moyen", "moyen", "long"]) }));
  }
  // main event à la fin : le match le plus important
  const imp = it => (it.title ? 30 + ((G.T[it.title] || {}).pres || 50) / 2 : 0) + (it.trad ? 20 : 0) + avg(idsOf(it).map(i => (G.W[i] || {}).pop || 0)) / 3;
  items.sort((x, y) => imp(x) - imp(y));
  // segments
  const mic = pool.filter(w => !used.has(w.id)).sort((a, b) => b.st[2] - a.st[2]);
  if (mic[0]) items.splice(Math.min(1, items.length), 0, { it: "s", k: pick(["promo", "bsint", "parking", "office"]), w: [mic[0].id] });
  const slp = (G.sl || []).find(s => !s.done && s.fed === ev.fed && s.a.concat(s.b).every(i => G.W[i] && okB(i) && !used.has(i) && avail(G, G.W[i], ev.day)));   // pas quelqu'un qui a déjà un match ce soir
  if (slp && !big) items.splice(Math.floor(items.length / 2), 0, { it: "s", k: pick(["face", "brawl", "ambush", "attack"]), w: [slp.a[0], slp.b[0]] });
  ev.items = items; ev.card = []; ev.seg = [];
  return ev;
}
export function pendingTour(G, t, ev) {
  // matchs du tournoi pas encore joués ; la finale seulement dans un grand show
  const out = [];
  if (t.fmt === "gauntlet") return t.win || (ev && !isBig(ev)) ? [] : [{ k: "final", m: t.m.slice(), lbl: "Gauntlet", fin: true, g: true }];
  if (t.fmt === "league") { (t.blocks || []).forEach((b, bi) => (b.g || []).forEach((g, gi) => { if (!g.w) out.push({ k: "b" + bi + "-" + gi, m: [g.a, g.b], lbl: "Bloc " + "ABCD"[bi] }); })); if (!out.length && t.final && !t.final.w && (!ev || isBig(ev))) out.push({ k: "final", m: [t.final.a, t.final.b], lbl: "Finale", fin: true }); return out; }
  const r = (t.r || [])[t.cur || 0] || []; r.forEach((g, gi) => { if (!g.w && g.a && g.b) { const fin = r.length === 1; if (!fin || !ev || isBig(ev)) out.push({ k: "r" + (t.cur || 0) + "-" + gi, m: [g.a, g.b], lbl: r.length === 1 ? "Finale" : r.length === 2 ? "Demi-finale" : r.length === 4 ? "Quart de finale" : "1er tour", fin: fin }); } });
  return out;
}

// ---------- le show (en direct ou passé) ----------
const LINES = {
  start: ["{a} et {b} se jaugent au centre du ring.", "La cloche sonne : {a} se jette sur {b} !", "Le public est debout dès le début.", "Prise de bras de {a}, {b} cherche une sortie.", "{a} provoque {b} : le public siffle et applaudit."],
  mid: ["{a} enchaîne {b} dans le coin du ring !", "Gros coup de {a}, le public réagit !", "{a} et {b} se battent à l’extérieur du ring.", "{a} place une soumission… {b} tend la main vers les cordes !", "Plongeon de {a} par-dessus la 3e corde !", "{a} reprend le dessus, quelle intensité.", "Contre-attaque de {a} au dernier moment !", "{a} grimpe sur la 3e corde…", "{a} soulève {b}… et le projette au tapis !"],
  near: ["{a} place son finisher… 1… 2… {b} dégage !", "Tombé de {a} ! 1… 2… NON !", "{b} s’accroche aux cordes juste à temps !", "Finisher de {a}… kick-out de {b} ! Incroyable !"],
  hot: ["« This is awesome ! » scande le public.", "Toute l’arène est debout.", "Les fans tapent des pieds dans les tribunes."],
  cold: ["Le public est un peu silencieux.", "Quelques fans regardent leur téléphone…"],
  seg: ["{a} prend le micro et fait monter la pression.", "Le public répond à chaque phrase de {a}.", "Échange tendu avec {b} : ça peut exploser à tout moment.", "La caméra suit {a} dans les coulisses."],
  seg1: ["{a} prend le micro et fait monter la pression.", "Le public répond à chaque phrase de {a}.", "{a} regarde la caméra droit dans les yeux.", "La caméra suit {a} dans les coulisses."]
};
export function prepShow(G, ev) {
  if (!ev.items || !ev.items.length) autoCard(G, ev);
  pleMix(G, ev);   // WWE un seul show : les autres shows apportent leurs matchs aux grands événements
  const f = G.F[ev.fed], c = cityOf(G, ev), mine = ev.fed === G.me;
  return { ev: ev.id, i: 0, clock: 0, len: showLen(G, ev), crowd: clamp(50 + (c ? c[1] * 4 : 0) + (ENT[ev.ent || 0] || ENT[0])[2] * 3 + (isBig(ev) ? 8 : 0) + (G.hype[ev.id] || 0) * 2), out: [], log: [], cur: null, done: false, mine: mine, money: 0 };
}
// prépare le segment en cours : quelques « moments » qui défilent
function startItem(G, ev, L) {
  const it = ev.items[L.i]; if (!it) return null;
  const est = estimate(G, ev, it), n = it.it === "s" ? 2 : 3 + Math.round(itemMin(it) / 6), beats = [];
  const W = it.it === "s" ? it.w : idsOf(it);
  const names = W.map(i => wn(G, i));
  beats.push({ t: 0, txt: it.it === "s" ? (SEG[it.k] || SEG.promo).n + " : " + names.join(" et ") : (mtOf(it).n + " : " + sideName(G, it.sides) + (it.title ? " — " + ((G.T[it.title] || {}).n || "") + " en jeu" : "")), big: 1 });
  // qui a l'avantage à chaque moment (la photo de celui qui attaque est mise en avant, la barre d'élan bouge)
  const sides = it.it === "m" ? (it.sides || []).filter(s => s && s.length) : [];
  const duo = () => { if (it.it === "s") return [W[0], W[1] || ""]; const i = Math.floor(rnd() * sides.length), o = sides.filter((s, j) => j !== i); return [pick(sides[i] || W), o.length ? pick(pick(o)) : ""]; };
  const fill = (t, a, b) => t.replace(/\{a\}/g, wn(G, a)).replace(/\{b\}/g, b ? wn(G, b) : "son adversaire");
  for (let k = 1; k < n; k++) {
    const ty = it.it === "s" ? "seg" : k === 1 ? "start" : k >= n - 2 ? "near" : "mid", p = duo(), a = p[0], b = p[1];
    let txt = fill(pick(ty === "seg" ? (b ? LINES.seg : LINES.seg1) : LINES[ty]), a, b), ev2 = "", t2 = ty;
    if (it.it === "m" && rnd() < 0.06) { txt = "Aïe… mouvement raté par " + wn(G, a) + " (botch) !"; ev2 = "botch:" + a; t2 = "botch"; }
    else if (it.it === "m" && rnd() < 0.025 + (W.some(i => G.W[i] && G.W[i].en < 35) ? 0.04 : 0)) { txt = wn(G, a) + " se tient le genou… " + (G.W[a] && G.W[a].sx === "f" ? "elle" : "il") + " a l’air blessé" + e_(G.W[a]) + " !"; ev2 = "inj:" + a; t2 = "inj"; }
    else if (ty !== "near" && est.r >= 70 && rnd() < 0.3) { txt = pick(LINES.hot); t2 = "hot"; } else if (ty !== "near" && est.r < 45 && rnd() < 0.4) { txt = pick(LINES.cold); t2 = "cold"; }
    beats.push({ t: Math.round(k * itemMin(it) / n), txt: txt, ev: ev2, ty: t2, who: t2 === "hot" || t2 === "cold" ? "" : a, vs: b });
  }
  // le public pousse un catcheur absent du match : il scande son nom
  const pushed = L.mine && it.it === "m" && L.i === ev.items.length - 1 ? roster(G).find(w => (w.crowd || 0) >= 75 && !(w.push > 0) && idsOf(it).indexOf(w.id) < 0) : null;
  if (pushed && rnd() < 0.5) beats.splice(beats.length - 1, 0, { t: beats[beats.length - 1].t, txt: "Le public scande « " + pushed.n + " ! » pendant le main event…", ev: "chant:" + pushed.id, ty: "chant", who: pushed.id });
  return { it: it, est: est, beats: beats, k: 0, mod: {}, min: itemMin(it) };
}
// avance d'un « moment » ; renvoie { line } ou { end: résultat du segment } ou { show: résultats du show }
export function stepLive(G, ev, L) {
  if (L.done) return { show: ev.res };
  if (!L.cur) { L.cur = startItem(G, ev, L); if (!L.cur) return finishLive(G, ev, L); }
  const C = L.cur;
  if (C.k < C.beats.length) {
    const b = C.beats[C.k++]; L.clock += C.k === 1 ? (C.it.it === "m" ? 3 : 1) : Math.max(1, b.t - (C.beats[C.k - 2] || { t: 0 }).t);
    if (b.ev) { const p = b.ev.split(":"); if (p[0] === "botch") C.mod.botch = p[1]; if (p[0] === "inj") C.mod.injW = p[1]; if (p[0] === "chant") C.mod.chant = p[1]; C.alert = p[0]; }
    L.crowd = clamp(L.crowd + (C.est.r - 55) / 12 + (rnd() - 0.5) * 4);
    // élan : la barre penche vers le camp de celui qui attaque
    if (b.who && C.it.it === "m") { const si = C.it.sides.findIndex(s => s.indexOf(b.who) >= 0); if (si >= 0) C.mom = clamp((C.mom || 0) + (si === 0 ? 1 : -1) * (b.ty === "near" ? 35 : 22) + (rnd() - 0.5) * 10, -100, 100); }
    const line = { c: L.clock, txt: b.txt, big: b.big, alert: b.ev ? b.ev.split(":")[0] : "", ty: b.ty || (b.big ? "intro" : ""), who: b.who || "", vs: b.vs || "", i: L.i }; L.log.push(line); cap(L.log, 80);
    return { line: line };
  }
  // fin du segment
  if (L.clock > L.len + 5 && ev.kind === "tv" && C.it.it === "m") C.mod.cut = true;
  const r = C.it.it === "m" ? simMatch(G, ev, C.it, C.mod) : simSeg(G, ev, C.it);
  if (r) { r.min = C.min; L.out.push(r); L.log.push({ c: L.clock, txt: resLine(G, r), res: 1, i: L.i, ty: "res" }); L.crowd = clamp(L.crowd + (r.r - 60) / 6); }
  L.cur = null; L.i++;
  if (L.i >= ev.items.length) return finishLive(G, ev, L);
  return { end: r };
}
export function resLine(G, r) {
  if (r.it === "s") return (SEG[r.k] || SEG.promo).n + " : " + stars(r.r);
  const W = typeof r.win === "number" ? teamName(G, r.sides[r.win]) : "";
  return (W ? W + " gagne" + ((FIN[r.fin] || [""])[0] ? " (" + FIN[r.fin][0].toLowerCase() + ")" : "") : "Pas de vainqueur (" + ((FIN[r.fin] || [""])[0] || "").toLowerCase() + ")") + " · " + stars(r.r) + (r.change ? " · NOUVEAU CHAMPION" : "");
}
// ordres donnés depuis la Gorilla position
export function orderLive(G, ev, L, o, v) {
  const C = L.cur; if (!C) return false;
  if (o === "faster") { C.mod.faster = true; C.beats.splice(C.k, Math.max(0, C.beats.length - C.k - 1)); C.min = Math.round(C.min * 0.7); return true; }
  if (o === "longer") { C.mod.longer = true; const ids = idsOf(C.it), a = pick(ids), b = pick(ids.filter(x => x !== a)) || "", f2 = t => t.replace(/\{a\}/g, wn(G, a)).replace(/\{b\}/g, b ? wn(G, b) : "son adversaire"); C.beats.splice(C.beats.length - 1, 0, { t: C.min + 3, txt: f2(pick(LINES.near)), ty: "near", who: a, vs: b }, { t: C.min + 6, txt: f2(pick(LINES.mid)), ty: "mid", who: b || a, vs: a }); C.min += 6; return true; }
  if (o === "finish") { C.beats.splice(C.k, Math.max(0, C.beats.length - C.k - 1)); return true; }
  if (o === "win") { C.mod.win = v === "nul" ? "nul" : +v; return true; }
  if (o === "runin") { C.mod.runin = v; C.beats.splice(C.k, 0, { t: C.min - 1, txt: wn(G, v) + " débarque dans le ring !", ty: "runin", who: v }); return true; }
  if (o === "medic") { C.mod.medic = true; C.beats.splice(C.k, C.beats.length - C.k, { t: C.min, txt: "Le médecin entre sur le ring : on arrête tout." }); return true; }
  if (o === "sec") { C.mod.sec = true; C.beats.splice(C.k, 0, { t: C.min, txt: "Le GM envoie la sécurité autour du ring : personne ne viendra déranger ce match." }); return true; }
  if (o === "sanc") { C.mod.sanc = true; C.beats.splice(C.k, 0, { t: C.min, txt: "Le GM parle à l’arbitre : à la moindre triche, c’est la disqualification !" }); return true; }
  if (o === "restart") { C.mod.restart = true; C.beats.splice(C.k, 0, { t: C.min, txt: "Le GM prévient : pas de fin en queue de poisson ce soir, il faudra un vainqueur !" }); return true; }
  if (o === "pub") { L.crowd = clamp(L.crowd - 3); L.money += 15; C.beats.splice(C.k, 0, { t: C.min, txt: "Coupure pub… le public attend." }); return true; }
  return false;
}
function finishLive(G, ev, L) { L.done = true; finishShow(G, ev, L); return { show: ev.res }; }
export function runShow(G, ev) { const L = prepShow(G, ev); let g = 0; while (!L.done && g++ < 2000) stepLive(G, ev, L); return ev.res; }
export const playShow = runShow;

// ---------- fin du show : note, audience, recettes, courrier ----------
function finishShow(G, ev, L) {
  const f = G.F[ev.fed], mine = ev.fed === G.me, big = isBig(ev), res = L.out, ms = res.filter(x => x.it === "m");
  let rating = 0; if (res.length) { const wts = res.map((x, i) => (i === res.length - 1 ? 2 : 1) * (x.it === "s" ? 0.6 : 1)); rating = res.reduce((s, x, i) => s + x.r * wts[i], 0) / wts.reduce((s, x) => s + x, 0); }
  const over = L.clock - L.len; if (over > 10 && ev.kind === "tv") rating -= 2; if (over < -35) rating -= 3;
  rating = clamp(rating + (L.crowd - 55) / 15 + (ev.celeb ? 2 : 0), 5, 100);
  // audience
  const prev = f.aud.length ? f.lastR || 60 : 60, ids = ms.reduce((s, x) => s.concat(idsOf(x)), []);
  const starOn = ids.length ? avg(ids.map(i => (G.W[i] || { st: [0, 0, 0, 0, 0, 50] }).st[5])) : 50;
  const heat = (G.sl || []).filter(s => !s.done && s.fed === ev.fed).reduce((s, x) => s + x.heat, 0), hype = big ? (G.hype[ev.id] || 4) : 0;
  let war = 1, rival = null;
  if (!big) { const wd = dateOf(ev.day).wd; Object.values(G.F).forEach(o => { if (o.id !== f.id && o.shows.some(s => s.wd === wd)) { const k = 1 - 0.1 * o.pop / (o.pop + f.pop); if (k < war) { war = k; rival = o; } } }); }
  let aud = f.aud0 * (1 + (starOn - 65) / 220) * (1 + (prev - 65) / 260) * (1 + Math.min(0.25, heat / 600)) * (big ? 1 + hype / 25 : 1) * war * (ev.celeb ? 1.06 : 1) * (0.95 + rnd() * 0.1);
  aud = Math.max(0.02, Math.round(aud * 100) / 100);
  if (ev.ai) {   // WWE un seul show : un autre show de la WWE, dirigé par son propre GM (ni mon argent, ni mon audience)
    G.brands = G.brands || {}; const B = (G.brands[ev.br] = G.brands[ev.br] || { aud: [] }); B.aud.push(aud); cap(B.aud, 12); B.last = { n: ev.n, d: G.day, r: Math.round(rating), aud: aud };
    B.m = ms.map(x => ({ s: x.sides, w: x.win, r: Math.round(x.r), t: x.title, c: x.change, ty: x.t })).slice(-6);
    ev.done = true; ev.res = { r: rating, aud: aud };
    const best = ms.slice().sort((a, b) => b.r - a.r)[0]; if (best && (best.change || (best.r > 80 && rnd() < 0.4))) news(G, { seg: "ecran", f: "autres", t: ev.n + " · " + stars(rating), txt: (best.change ? "Changement de titre ! " : "Match du soir : ") + sideName(G, best.sides) + "." });
    return;
  }
  f.aud.push(aud); cap(f.aud, 16); f.lastR = rating;
  if (!f.k) f.k = f.aud0 / (0.05 * Math.pow(1.04, f.pop));
  f.aud0 = Math.max(0.05, f.aud0 + (f.k * 0.05 * Math.pow(1.04, f.pop) - f.aud0) * 0.06 + f.aud0 * (rating - 70) / 2500);
  let dp = (rating - 62) / 40 * (big ? 2 : 1) / Math.max(1, f.shows.length); if (dp > 0) dp *= (100 - f.pop) / 60;
  f.popx = (f.popx == null ? f.pop : f.popx) + dp; f.pop = clamp(f.popx, 5, 99); f.popx = Math.max(5, Math.min(99, f.popx));
  f.last = { n: ev.n, d: G.day, r: rating, aud: aud };
  const wk = Math.floor(G.day / 7); G.wk = G.wk || {}; G.wk[wk] = G.wk[wk] || {}; if (!big) { const o = G.wk[wk][f.id]; G.wk[wk][f.id] = o ? Math.round((o + aud) / 2 * 100) / 100 : aud; }
  ev.done = true; ev.res = { r: rating, aud: aud, items: res, clock: L.clock, len: L.len, crowd: Math.round(L.crowd) };
  if (!G.best.show || rating > G.best.show.r) G.best.show = { r: rating, d: G.day, txt: ev.n + " (" + f.n + ")", y: dateOf(G.day).y };
  G.topS = (G.topS || []).concat({ r: rating, d: G.day, n: ev.n, fed: ev.fed, aud: aud }).sort((a, b) => b.r - a.r).slice(0, 20);
  // tournois et traditions
  res.forEach(r => { if (r.it === "m" && r.tour) tourResult(G, r); if (r.it === "m" && r.trad) tradResult(G, ev, r); });
  if (!mine) {
    G.aiShows = G.aiShows || {}; const A = (G.aiShows[ev.fed] = G.aiShows[ev.fed] || []);
    A.push({ n: ev.n, d: G.day, r: Math.round(rating), aud: aud, m: ms.map(x => ({ s: x.sides, w: x.win, r: Math.round(x.r), t: x.title, c: x.change, ty: x.t })) }); cap(A, 6);
    if (rnd() < 0.5) { const best = ms.slice().sort((a, b) => b.r - a.r)[0]; if (best && (best.r > 78 || best.change)) news(G, { seg: "ecran", f: "autres", t: f.n + " · " + ev.n, txt: (best.change ? "Changement de titre ! " : "Match du soir : ") + sideName(G, best.sides) + " (" + stars(best.r) + "), " + fmtM(aud) + "." }); }
    return;
  }
  // recettes : billets (selon la salle), TV, sponsors, entrées, production
  const V = VENUES[ev.venue != null ? ev.venue : f.venue] || VENUES[1], c = cityOf(G, ev), reg = (f.reg || {})[c ? c[3] : "us"] || f.pop;
  const demand = (300 + Math.pow(reg, 1.75) * (big ? 9 : 3.2)) * (1 + (c ? c[1] : 0) / 25) * (big ? 1 + hype / 12 : 1) * Math.max(0.3, 1.6 - (f.tix || 25) / 60) * (ev.storm === "keep" ? 0.6 : 1);
  const att = Math.round(Math.min(V[1], demand)), full = att >= V[1] * 0.98;
  const tix = Math.round(att * (f.tix || 25) / 1000), tv = big ? 0 : f.tv.pay, ent = (ENT[ev.ent || 0] || ENT[0])[1] + entCost(ev), prod = Math.round(((big ? 110 : 25) + V[2]) * (hasTal(G, "eco") ? 0.9 : 1));
  const pub = (G.spons || []).filter(s => s.until > G.day && aud >= s.min).reduce((s, x) => s + x.pay + Math.round(x.pay * Math.min(1, aud / 3) * 0.5), 0)   /* sponsors sur le tablier : payés aussi selon la visibilité */, stream = f.exp && f.exp.stream ? Math.round((f.exp.subs || 0) * (big ? 0.012 : 0.002)) : 0;
  const money = tv + tix + pub + stream + L.money + (ev.bonus || 0) - prod - ent;
  G.fin.cur.tv += tv + stream; G.fin.cur.tix += tix; G.fin.cur.pub += pub + L.money + (ev.bonus || 0); G.fin.cur.prod += prod + ent; f.money += money;
  Object.assign(ev.res, { att: att, cap: V[1], full: full, money: money, war: rival ? { n: rival.n, id: rival.id } : null });
  if (full && V[1] >= 50000) ach(G, "stade");
  // primes automatiques du match de la soirée
  const best = ms.slice().sort((a, b) => b.r - a.r)[0];
  if (G.cfg && G.cfg.motn && best) { idsOf(best).forEach(i => { const w = G.W[i]; if (w && w.fed === G.me) w.mor = clamp(w.mor + 5); }); f.money -= 10; G.fin.cur.prod += 10; }
  const goal = f.tv.min, ok = aud >= goal, worst = res.slice().sort((a, b) => a.r - b.r)[0];
  mail(G, { k: "aud", from: "Directeur du diffuseur", role: f.tv.n, c: "#6fb3ff", ini: "TV", subj: "Audience de " + ev.n + " : " + fmtM(aud),
    body: "Note du show : " + stars(rating) + ". Public : " + att + " personnes" + (full ? " (complet !)" : "") + ".\n" + (big ? "" : ok ? "L’objectif de " + fmtM(goal) + " est atteint, bravo." : "L’objectif de " + fmtM(goal) + " n’est pas atteint : attention.") +
      (best ? "\nMeilleur moment : " + sideName(G, best.sides) + " (" + stars(best.r) + ")." : "") + (worst && worst !== best ? "\nMoins bon : " + (worst.it === "s" ? "le segment de " + teamName(G, worst.w) : sideName(G, worst.sides)) + " (" + stars(worst.r) + ")." : "") +
      (rival ? "\nCe soir-là, " + rival.n + " passait aussi à la télé : l’audience a été partagée." : "") + "\nRecettes du soir : " + fmtK(money) + ".", imp: false, ev: ev.id });
  news(G, { seg: "ecran", f: "nous", t: ev.n + " : " + stars(rating), txt: ms.length + " matchs, " + fmtM(aud) + " de téléspectateurs" + (best ? ". Le match du soir : " + sideName(G, best.sides) + "." : ".") });
  if (best) buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#6fb3ff", txt: rating >= 75 ? "Quel show ce " + ev.n + " ! " + sideName(G, best.sides) + ", énorme." : rating >= 55 ? ev.n + " : correct. " + teamName(G, best.sides[0]) + " a assuré." : ev.n + " : bof… j’espère mieux la semaine prochaine." });
  const star = best && typeof best.win === "number" && G.W[best.sides[best.win][0]];
  if (star && rnd() < 0.8) buzz(G, { f: "nous", who: star.n, at: "@" + star.n.replace(/\W+/g, "").toLowerCase().slice(0, 14), ini: ini(star.n), c: "#f5b13d", txt: pick(["Personne ne m’arrête. Personne.", "Merci au public ce soir, vous êtes incroyables.", "La prochaine fois, je veux la ceinture.", "Je n’ai pas fini. Ça ne fait que commencer.", "Vous l’avez vu ? Je l’avais dit."]) });
  // promesses tenues (match de titre, main event, débuts dans un grand show)
  const main = ms[ms.length - 1];
  (G.prom || []).forEach(p => {
    if (p.st !== "cours") return;
    const inTitle = ms.some(r => r.title && idsOf(r).indexOf(p.w) >= 0), inMain = main && idsOf(main).indexOf(p.w) >= 0, inShow = res.some(r => (r.it === "m" ? idsOf(r) : r.w).indexOf(p.w) >= 0);
    if ((p.t === "titre" && inTitle) || (p.t === "main" && inMain && big) || (p.t === "debut" && inShow && big) || (p.t === "me" && inMain) || (p.t === "show" && inShow)) { p.st = "tenue"; promiseKept(G, p); const w = G.W[p.w]; if (w) w.mor = clamp(w.mor + 15); }
  });
  // trophées et guerre des audiences
  ach(G, "first"); if (rating >= 80) ach(G, "r4"); if (rating >= 98) ach(G, "r5"); if (aud >= 1) ach(G, "m1");
  missionsShow(G, ev); dnaShow(G, ev, res); vnAfterShow(G, ev, res); extraAfterShow(G, ev, res);
  if (rival) { const ra = rival.aud.length ? rival.aud[rival.aud.length - 1] : 0; if (aud > ra) { ach(G, "war"); news(G, { seg: "coul", f: "nous", t: "Guerre des audiences : " + f.n + " gagne", txt: ev.n + " (" + fmtM(aud) + ") bat " + rival.n + " (" + fmtM(ra) + ")." }); } }
}
// résultats d'un match de tournoi / de tradition
export function tourResult(G, r) {
  const t = (G.tours || []).find(x => x.id === r.tour.id); if (!t || t.win) return;
  let w = typeof r.win === "number" ? r.sides[r.win][0] : null; if (!w) w = r.sides[rnd() < 0.5 ? 0 : 1][0];
  const k = r.tour.k;
  if (k === "final") { t.final.w = w; return tourWin(G, t, w); }
  if (k[0] === "b") { const p = k.slice(1).split("-"), g = t.blocks[+p[0]].g[+p[1]]; g.w = w; g.d = typeof r.win !== "number"; const b = t.blocks[+p[0]]; b.pts = b.pts || {}; if (g.d) { b.pts[g.a] = (b.pts[g.a] || 0) + 1; b.pts[g.b] = (b.pts[g.b] || 0) + 1; } else b.pts[w] = (b.pts[w] || 0) + 2;
    if (t.blocks.every(B => B.g.every(x => x.w))) { const srt = B => B.m.slice().sort((a, b) => (B.pts[b] || 0) - (B.pts[a] || 0)), tops = t.single ? srt(t.blocks[0]).slice(0, 2) : t.blocks.map(B => srt(B)[0]); t.final = { a: tops[0], b: tops[1] || tops[0], w: "" }; news(G, { seg: "ecran", f: t.fed === G.me ? "nous" : "autres", t: t.n + " : la finale", txt: wn(G, tops[0]) + " contre " + wn(G, tops[1]) + " en finale (au prochain grand show)." }); }
    return; }
  const p = k.slice(1).split("-"), round = t.r[+p[0]], g = round[+p[1]]; g.w = w;
  if (round.every(x => x.w)) { if (round.length === 1) return tourWin(G, t, w); const nx = []; for (let i = 0; i < round.length; i += 2) nx.push({ a: round[i].w, b: (round[i + 1] || {}).w, w: "" }); t.r.push(nx); t.cur = (t.cur || 0) + 1; }
}
export function tourWin(G, t, w) {
  t.win = w; t.done = G.day; const W = G.W[w];
  G.tourPres = G.tourPres || {}; G.tourPres[t.n] = clamp((G.tourPres[t.n] || 40) + 6); t.pres = G.tourPres[t.n];
  if (W) { W.pop = clamp(W.pop + 3 + t.pres / 25, 1, 99); W.mor = clamp(W.mor + 12); W.hist.push({ d: G.day, t: "Remporte " + t.n }); cap(W.hist, 40);
    if (t.pr === "shot" || !t.pr) { const tt = Object.values(G.T).filter(x => x.fed === t.fed && x.div !== "tag" && (x.cat === W.sx || x.cat === "x")).sort((a, b) => (b.pres || 0) - (a.pres || 0))[0]; if (tt) G.shots = (G.shots || []).concat({ w: w, t: tt.id, by: t.n, d: G.day }); }
    if (t.pr === "case") G.mitb = (G.mitb || []).concat({ w: w, fed: t.fed, until: G.day + 365, n: t.n }); }
  news(G, { seg: "ecran", f: t.fed === G.me ? "nous" : "autres", t: wn(G, w) + " remporte " + t.n + " !", txt: "Le trophée et la gloire" + (t.pr === "shot" ? ", plus un match de titre garanti." : t.pr === "case" ? ", plus un contrat pour un match de titre." : ".") });
  if (t.fed === G.me) { ach(G, "tour"); mail(G, { k: "tourwin", from: "Ta directrice créative", role: "Créatif", c: "#c9a7ff", ini: "DC", subj: wn(G, w) + " remporte " + t.n, body: "Bravo à " + wn(G, w) + " !" + (t.pr === "shot" ? "\nIl a gagné un match de titre : il passe n°1 challenger." : "") + "\nVeux-tu lui donner un surnom lié à sa victoire ?", w: w, tn: t.n }); }
}
export function tradResult(G, ev, r) {
  const x = (G.trad || []).find(y => y.id === r.trad); if (!x) return;
  const y = dateOf(ev.day).y; x.done = x.done || {}; x.done[y] = true; x.ed = (x.ed || 0) + 1; x.pres = clamp((x.pres || 60) + (r.r > 70 ? 3 : 1));
  const w = typeof r.win === "number" ? r.sides[r.win][0] : null; if (!w) return; const W = G.W[w];
  if (W) { W.pop = clamp(W.pop + 3, 1, 99); W.hist.push({ d: G.day, t: "Remporte " + x.n }); }
  if (x.pr === "shot") { const tt = Object.values(G.T).filter(t => t.fed === x.fed && t.div !== "tag" && W && (t.cat === W.sx || t.cat === "x")).sort((a, b) => (b.pres || 0) - (a.pres || 0))[0]; if (tt) G.shots = (G.shots || []).concat({ w: w, t: tt.id, by: x.n, d: G.day }); }
  news(G, { seg: "ecran", f: x.fed === G.me ? "nous" : "autres", t: wn(G, w) + " remporte " + x.n, txt: x.pr === "shot" ? "Direction un match de titre au plus grand show de l’année." : x.pr === "case" ? "Il peut encaisser sa mallette quand il veut." : "Une victoire de prestige." });
}
export const STIPL = STIP;
