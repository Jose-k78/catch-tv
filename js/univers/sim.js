// Mode Univers : la simulation (jours, shows, matchs, IA des autres fédérations, blessures, contrats, courrier, actu, buzz, finances).
import { STY_FAT, STY_INJ, ROLES, dateOf, dayLabel, shortDate, clamp, rnd, pick, uid, salOf, trainee, indie, fmtM, fmtK, stars, weekOf } from "./world.js";

const cap = (a, n) => { if (a.length > n) a.splice(0, a.length - n); };
export const meF = G => G.F[G.me];
export const wOf = (G, id) => G.W[id];
export const wn = (G, id) => (G.W[id] || {}).n || "?";
export const roster = (G, fed) => Object.values(G.W).filter(w => w.fed === (fed || G.me) && !w.ret);
export const avail = (G, w) => !w.ret && !(w.inj && w.inj.until > G.day) && !(w.off && w.off > G.day);
export const injured = (G, w) => !!(w.inj && w.inj.until > G.day);
export const risk = w => w.en >= 60 ? ["faible", "ok"] : w.en >= 35 ? ["moyen", "mid"] : ["élevé", "ko"];
export const teamName = (G, ids) => ids.map(i => wn(G, i)).join(" et ");

// ---------- courrier, actu, buzz ----------
export function mail(G, m) {
  G.seq = (G.seq || 1) + 1;
  const x = Object.assign({ id: "m" + G.seq, d: G.day, read: false, done: "" }, m);
  G.mail.push(x); cap(G.mail, 160); G._new = (G._new || 0) + (m.imp === false ? 0 : 1); return x;
}
export function news(G, n) { G.news.push(Object.assign({ d: G.day }, n)); cap(G.news, 220); }
export function buzz(G, b) { G.buzz.push(Object.assign({ d: G.day, n: Math.round(200 + rnd() * 3000), id: "b" + (G.seq = (G.seq || 1) + 1) }, b)); cap(G.buzz, 120); }
const ini = n => String(n || "?").split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();

// ---------- un match ----------
const CHEM = { "aer|aer": 5, "pur|pur": 6, "tec|tec": 5, "bag|bag": 3, "aer|tec": 3, "aer|bag": 2, "bag|pur": 4, "pur|tec": 4, "aer|pur": 3, "bag|tec": 1 };
const chemOf = (a, b) => a === "equ" || b === "equ" ? 2 : CHEM[[a, b].sort().join("|")] || 1;
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
export const DUR = { court: ["Court", 12, -5], moyen: ["Moyen", 20, 0], long: ["Long", 30, 5] };
export const SPOTS = { saut: ["Grand saut", 4, 1.6], interf: ["Interférence", 1, 1], contre: ["Finisher contré", 3, 1.1], public: ["Bagarre dans le public", 3, 1.3] };
export function heatBetween(G, a, b) {
  const s = G.sl.find(x => !x.done && ((x.a.some(i => a.indexOf(i) >= 0) && x.b.some(i => b.indexOf(i) >= 0)) || (x.b.some(i => a.indexOf(i) >= 0) && x.a.some(i => b.indexOf(i) >= 0))));
  return s ? s : null;
}
// m = { a: [ids], b: [ids], kind: simple|titre|equipe, title, dur, win: ia|a|b|nul, spots: [] } ; renvoie le résultat
export function playMatch(G, m, ctx) {
  ctx = ctx || {};
  const A = m.a.map(i => G.W[i]).filter(Boolean), B = m.b.map(i => G.W[i]).filter(Boolean);
  if (!A.length || !B.length) return null;
  const all = A.concat(B), D = DUR[m.dur] || DUR.moyen;
  let q = avg(all.map(w => w.st[1])) * 0.55 + avg(all.map(w => w.st[5])) * 0.15 + avg(all.map(w => w.st[3])) * 0.12 + 12;
  q += chemOf(A[0].sty, B[0].sty);
  q += D[2]; if (m.dur === "long") q += avg(all.map(w => w.st[4])) > 70 ? 3 : -6; if (m.dur === "court" && A[0].sty === "bag") q += 4;
  const sl = heatBetween(G, m.a, m.b); if (sl) q += 3 + sl.heat / 12;
  if (m.title) q += 4;
  (m.spots || []).forEach(s => { if (SPOTS[s]) q += SPOTS[s][1]; });
  if (all.some(w => w.en < 40)) q -= 5;
  if (m.a.length === 2) { const t = (G.teams || []).find(t => t.m.indexOf(m.a[0]) >= 0 && t.m.indexOf(m.a[1]) >= 0); if (t) q += t.chem / 25; }
  q += (rnd() - 0.5) * 14;
  const rating = clamp(q, 5, 100);
  // vainqueur
  let win = m.win;
  if (!win || win === "ia") { const sa = avg(A.map(w => w.pop + w.st[5])) + rnd() * 45, sb = avg(B.map(w => w.pop + w.st[5])) + rnd() * 45; win = rnd() < 0.04 ? "nul" : sa >= sb ? "a" : "b"; }
  const W = win === "a" ? A : win === "b" ? B : [], L = win === "a" ? B : win === "b" ? A : [];
  const notes = [];
  all.forEach(w => {
    if (win === "nul") w.rec[2]++; else if (W.indexOf(w) >= 0) w.rec[0]++; else w.rec[1]++;
    // fatigue : plus la stat Endurance est haute, moins la barre baisse vite ; le style compte aussi
    let spotF = 1; (m.spots || []).forEach(s => { if (SPOTS[s]) spotF *= SPOTS[s][2]; });
    w.en = clamp(w.en - D[1] * (STY_FAT[w.sty] || 1) * (1.3 - w.st[4] / 200) * Math.min(1.6, spotF));
    w.last = G.day;
    // blessure : plus la barre est basse, plus le risque monte
    const p = (0.004 + Math.max(0, 60 - w.en) * 0.0007) * (STY_INJ[w.sty] || 1) * (m.dur === "long" ? 1.25 : 1) * Math.min(2, spotF);
    if (rnd() < p) {
      const wk = 1 + Math.floor(Math.pow(rnd(), 2) * 10), grave = wk >= 6;
      w.inj = { until: G.day + wk * 7, what: pick(grave ? ["Genou (ligaments)", "Épaule luxée", "Commotion", "Cou"] : ["Entorse de la cheville", "Côtes", "Genou", "Dos", "Épaule"]), grave: grave };
      notes.push(w.n + " s’est blessé" + (w.sx === "f" ? "e" : "") + " (" + wk + " sem.)");
      if (w.fed === G.me) mail(G, { k: "inj", from: "Le médecin", role: "Ton personnel", c: "#ff8a7e", ini: "DR", subj: w.n + " : " + w.inj.what.toLowerCase() + ", " + wk + " semaine" + (wk > 1 ? "s" : ""), body: w.n + " s’est blessé" + (w.sx === "f" ? "e" : "") + " pendant son match.\nRetour prévu : " + dayLabel(w.inj.until) + "." + (grave ? "\nC’est grave : il faut être patient." : "\nUn spécialiste peut raccourcir l’absence (50 k$)."), w: w.id });
      else if (w.pop >= 70) news(G, { seg: "coul", f: "blessures", t: w.n + " blessé" + (w.sx === "f" ? "e" : ""), txt: w.n + " (" + (G.F[w.fed] || {}).n + ") est absent" + (w.sx === "f" ? "e" : "") + " environ " + wk + " semaine" + (wk > 1 ? "s" : "") + "." });
    }
  });
  // popularité et moral
  W.forEach(w => { w.pop = clamp(w.pop + 0.6 + rating / 90 + (m.title ? 1 : 0), 1, 99); w.mor = clamp(w.mor + 2); });
  L.forEach(w => { w.pop = clamp(w.pop - 0.4 + (rating > 75 ? 0.6 : 0), 1, 99); w.mor = clamp(w.mor - 1); });
  if (win === "nul") all.forEach(w => { w.pop = clamp(w.pop + rating / 150, 1, 99); });
  if (sl) { sl.heat = clamp(sl.heat + 6); sl.met = G.day; }
  if (m.a.length === 2) (G.teams || []).forEach(t => { if ((t.m.indexOf(m.a[0]) >= 0 && t.m.indexOf(m.a[1]) >= 0) || (t.m.indexOf(m.b[0]) >= 0 && t.m.indexOf(m.b[1]) >= 0)) t.chem = clamp(t.chem + 2); });
  // titre
  let change = false;
  if (m.title && G.T[m.title]) {
    const t = G.T[m.title], champIds = Array.isArray(t.champ) ? t.champ : t.champ ? [t.champ] : [];
    const champSide = champIds.length && champIds.every(i => m.a.indexOf(i) >= 0) ? "a" : champIds.length && champIds.every(i => m.b.indexOf(i) >= 0) ? "b" : "";
    if (win !== "nul" && win !== champSide) {
      const nw = (win === "a" ? m.a : m.b).slice();
      t.champ = t.div === "tag" ? nw.slice(0, 2) : nw[0]; t.since = G.day; t.defs = 0; change = true;
      W.forEach(w => { w.pop = clamp(w.pop + 4, 1, 99); w.mor = clamp(w.mor + 10); w.hist.push({ d: G.day, t: "Remporte le " + t.n }); cap(w.hist, 30); });
      news(G, { seg: "ecran", f: t.fed === G.me ? "nous" : "autres", t: (t.fed === G.me ? "" : G.F[t.fed].n + " : ") + "nouveau champion !", txt: teamName(G, nw) + " remporte le " + t.n + (ctx.ev ? " à " + ctx.ev : "") + "." });
    } else if (champSide) t.defs = (t.defs || 0) + 1;
  }
  const res = { a: m.a.slice(), b: m.b.slice(), win: win, r: rating, title: m.title || "", change: change, notes: notes, dur: m.dur, kind: m.kind };
  if (!G.best.match || rating > G.best.match.r) G.best.match = { r: rating, d: G.day, txt: teamName(G, m.a) + " contre " + teamName(G, m.b) + (ctx.ev ? ", " + ctx.ev : ""), y: dateOf(G.day).y };
  return res;
}
export function playPromo(G, s) {
  const w = G.W[s.w]; if (!w) return null;
  const r = clamp(w.st[2] * 0.6 + w.st[3] * 0.3 + w.st[5] * 0.1 + (rnd() - 0.5) * 16, 5, 100);
  w.pop = clamp(w.pop + (r - 55) / 25, 1, 99);
  return { w: s.w, r: r, kind: "promo" };
}

// ---------- cartes faites par l'IA ----------
function pairUp(pool, n, G, titles, big) {
  const card = [], used = new Set(); const p = pool.slice().sort((a, b) => (b.pop + rnd() * 25) - (a.pop + rnd() * 25));
  // titres en jeu aux grands événements
  if (big) titles.forEach(t => {
    if (card.length >= n) return;
    const champ = Array.isArray(t.champ) ? t.champ : t.champ ? [t.champ] : [];
    if (t.div === "tag") {
      const champOk = champ.length === 2 && champ.every(i => G.W[i] && !used.has(i) && avail(G, G.W[i]));
      const team = (G.teams || []).find(x => x.fed === t.fed && x.m.every(i => G.W[i] && avail(G, G.W[i]) && !used.has(i) && champ.indexOf(i) < 0));
      if (champOk && team) { champ.concat(team.m).forEach(i => used.add(i)); card.push({ a: champ.slice(), b: team.m.slice(), kind: "equipe", title: t.id, dur: "moyen", win: "ia", spots: [] }); }
      return;
    }
    const c = champ[0] && G.W[champ[0]]; const sx = t.div === "f" ? "f" : "h";
    const ch = p.find(w => !used.has(w.id) && w.sx === sx && w.id !== champ[0]);
    if (c && avail(G, c) && !used.has(c.id) && ch) { used.add(c.id); used.add(ch.id); card.push({ a: [c.id], b: [ch.id], kind: "titre", title: t.id, dur: card.length === 0 ? "long" : "moyen", win: "ia", spots: [] }); }
    else if (!c && ch) { const ch2 = p.find(w => !used.has(w.id) && w.sx === sx && w.id !== ch.id); if (ch2) { used.add(ch.id); used.add(ch2.id); card.push({ a: [ch.id], b: [ch2.id], kind: "titre", title: t.id, dur: "moyen", win: "ia", spots: [] }); } }
  });
  for (const sx of ["h", "f", "h", "h", "f", "h", "h", "f"]) {
    if (card.length >= n) break;
    const a = p.find(w => !used.has(w.id) && w.sx === sx); if (!a) continue; used.add(a.id);
    const b = p.find(w => !used.has(w.id) && w.sx === sx); if (!b) { used.delete(a.id); continue; } used.add(b.id);
    card.push({ a: [a.id], b: [b.id], kind: "simple", dur: pick(["court", "moyen", "moyen", "long"]), win: "ia", spots: [] });
  }
  // le main event à la fin
  card.sort((x, y) => (x.title ? 1 : 0) - (y.title ? 1 : 0));
  return card;
}
export function autoCard(G, ev) {
  const f = G.F[ev.fed], big = ev.kind === "ple" || ev.kind === "ppv";
  const pool = roster(G, ev.fed).filter(w => avail(G, w) && w.en >= 25 && !(G.rest && G.rest[w.id] > G.day) && (!ev.br || !w.br || w.br === ev.br));
  const titles = Object.values(G.T).filter(t => t.fed === ev.fed);
  ev.card = pairUp(pool, big ? 7 : 4, G, titles, big);
  ev.seg = [];
  const mic = pool.filter(w => ev.card.every(m => m.a.concat(m.b).indexOf(w.id) < 0)).sort((a, b) => b.st[2] - a.st[2])[0];
  if (mic && f && !big) ev.seg = [{ w: mic.id, kind: "promo" }];
  return ev;
}

// ---------- jouer un show ----------
export function playShow(G, ev) {
  const f = G.F[ev.fed], mine = ev.fed === G.me, big = ev.kind === "ple" || ev.kind === "ppv";
  if (!ev.card || !ev.card.length) autoCard(G, ev);
  const res = ev.card.map(m => playMatch(G, m, { ev: ev.n })).filter(Boolean);
  const segs = (ev.seg || []).map(s => playPromo(G, s)).filter(Boolean);
  const all = res.concat(segs);
  let rating = 0; if (all.length) { const wts = all.map((x, i) => i === res.length - 1 ? 2 : 1); rating = all.reduce((s, x, i) => s + x.r * wts[i], 0) / wts.reduce((s, x) => s + x, 0); }
  rating = clamp(rating, 5, 100);
  // audience
  const prev = f.aud.length ? f.lastR || 60 : 60;
  const ids = res.reduce((s, x) => s.concat(x.a, x.b), []);
  const starOn = ids.length ? avg(ids.map(i => G.W[i].st[5])) : 50;
  const heat = G.sl.filter(s => !s.done && s.fed === ev.fed).reduce((s, x) => s + x.heat, 0);
  const hype = big ? (G.hype[ev.id] || 4) : 0;
  let aud = f.aud0 * (1 + (starOn - 65) / 220) * (1 + (prev - 65) / 260) * (1 + Math.min(0.25, heat / 600)) * (big ? 1 + hype / 25 : 1) * (0.95 + rnd() * 0.1);
  aud = Math.max(0.02, Math.round(aud * 100) / 100);
  f.aud.push(aud); cap(f.aud, 12); f.lastR = rating;
  // l'audience de base suit la popularité de la fédération (lentement) ; chaque fédération garde son échelle de départ (k)
  // (équilibrage mesuré sur 1 an simulé : sans freins, Marigold passait de 0,3 à 7 M et AEW dépassait la WWE)
  if (!f.k) f.k = f.aud0 / (0.05 * Math.pow(1.04, f.pop));
  f.aud0 = Math.max(0.05, f.aud0 + (f.k * 0.05 * Math.pow(1.04, f.pop) - f.aud0) * 0.06 + f.aud0 * (rating - 70) / 2500);
  let dp = (rating - 62) / 40 * (big ? 2 : 1) / Math.max(1, f.shows.length); if (dp > 0) dp *= (100 - f.pop) / 60;
  f.popx = (f.popx == null ? f.pop : f.popx) + dp; f.pop = clamp(f.popx, 5, 99); f.popx = Math.max(5, Math.min(99, f.popx));
  f.last = { n: ev.n, d: G.day, r: rating, aud: aud };
  ev.done = true; ev.res = { r: rating, aud: aud, m: res, s: segs };
  if (!G.best.show || rating > G.best.show.r) G.best.show = { r: rating, d: G.day, txt: ev.n + " (" + f.n + ")", y: dateOf(G.day).y };
  // argent
  if (mine) {
    const tv = big ? 0 : f.tv.pay, att = Math.round((big ? 3000 : 1200) + f.pop * (big ? 180 : 40)), tix = Math.round(att * (big ? 0.06 : 0.035));
    const pub = (G.spons || []).filter(s => s.until > G.day && aud >= s.min).reduce((s, x) => s + x.pay, 0), prod = big ? 180 : 60;
    G.fin.cur.tv += tv; G.fin.cur.tix += tix; G.fin.cur.pub += pub; G.fin.cur.prod += prod; f.money += tv + tix + pub - prod;
    ev.res.att = att; ev.res.money = tv + tix + pub - prod;
    const best = res.slice().sort((a, b) => b.r - a.r)[0], worst = all.slice().sort((a, b) => a.r - b.r)[0];
    const goal = f.tv.min, ok = aud >= goal;
    mail(G, { k: "aud", from: "Directeur du diffuseur", role: f.tv.n, c: "#6fb3ff", ini: "TV", subj: "Audience de " + ev.n + " : " + fmtM(aud) + (prev ? "" : ""),
      body: "Note du show : " + stars(rating) + ".\n" + (ok ? "L’objectif de " + fmtM(goal) + " est atteint, bravo." : "L’objectif de " + fmtM(goal) + " n’est pas atteint : attention.") +
        (best ? "\nMeilleur moment : " + teamName(G, best.a) + " contre " + teamName(G, best.b) + " (" + stars(best.r) + ")." : "") +
        (worst && worst !== best ? "\nMoins bon : " + (worst.kind === "promo" ? "le segment au micro de " + wn(G, worst.w) : teamName(G, worst.a) + " contre " + teamName(G, worst.b)) + " (" + stars(worst.r) + ")." : "") +
        "\nRecettes du soir : " + fmtK(tv + tix + pub - prod) + ".", imp: false });
    news(G, { seg: "ecran", f: "nous", t: ev.n + " : " + stars(rating), txt: res.length + " matchs, " + fmtM(aud) + " de téléspectateurs" + (best ? ". Le match du soir : " + teamName(G, best.a) + " contre " + teamName(G, best.b) + "." : ".") });
    buzzAfter(G, ev, res, rating);
    // promesses tenues
    (G.prom || []).forEach(p => {
      if (p.st !== "cours") return;
      const inTitle = res.some(r => r.title && r.a.concat(r.b).indexOf(p.w) >= 0), inMain = res.length && res[res.length - 1].a.concat(res[res.length - 1].b).indexOf(p.w) >= 0;
      if ((p.t === "titre" && inTitle) || (p.t === "main" && inMain && big)) { p.st = "tenue"; const w = G.W[p.w]; if (w) w.mor = clamp(w.mor + 15); }
    });
  } else if (rnd() < 0.5) {
    const best = res.slice().sort((a, b) => b.r - a.r)[0];
    if (best && (best.r > 78 || best.change)) news(G, { seg: "ecran", f: "autres", t: f.n + " · " + ev.n, txt: (best.change ? "Changement de titre ! " : "Match du soir : ") + teamName(G, best.a) + " contre " + teamName(G, best.b) + " (" + stars(best.r) + "), " + fmtM(aud) + "." });
  }
  return ev.res;
}
const FANS = ["@ringside_lea", "@prise_du_mois", "@fan_de_catch", "@luchalibre_fr", "@top_rope_tom", "@kayfabe_kev", "@ma_ceinture"];
function buzzAfter(G, ev, res, rating) {
  const best = res.slice().sort((a, b) => b.r - a.r)[0];
  if (best) buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#6fb3ff", txt: rating >= 75 ? "Quel show ce " + ev.n + " ! " + teamName(G, best.a) + " contre " + teamName(G, best.b) + ", énorme." : rating >= 55 ? ev.n + " : correct. " + teamName(G, best.a) + " a assuré." : ev.n + " : bof… j’espère mieux la semaine prochaine." });
  const w = best && G.W[best.win === "b" ? best.b[0] : best.a[0]];
  if (w && rnd() < 0.8) buzz(G, { f: "nous", who: w.n, at: "@" + w.n.replace(/\W+/g, "").toLowerCase().slice(0, 14), ini: ini(w.n), c: "#f5b13d", txt: pick(["Personne ne m’arrête. Personne.", "Merci au public ce soir, vous êtes incroyables.", "La prochaine fois, je veux la ceinture.", "Je n’ai pas fini. Ça ne fait que commencer.", "Vous l’avez vu ? Je l’avais dit."]) });
}

// ---------- les jours ----------
export const MY_EV_AHEAD = 14;
export function ensureMyEvents(G) {
  const f = meF(G);
  for (let d = G.day; d <= G.day + MY_EV_AHEAD; d++) {
    const wd = dateOf(d).wd;
    f.shows.forEach(s => {
      if (s.wd !== wd) return;
      const id = G.me + "-tv-" + d + "-" + s.n;
      if (!G.ev.some(e => e.id === id) && (G.noTv || []).indexOf(id) < 0) G.ev.push({ id: id, fed: G.me, n: s.n, kind: "tv", day: d, card: [], seg: [], done: false, br: G.me === "WWE" ? s.n : "" });
    });
  }
}
export const myEventToday = G => G.ev.find(e => e.fed === G.me && e.day === G.day && !e.done);
export const nextMyEvents = (G, n) => G.ev.filter(e => e.fed === G.me && e.day >= G.day && !e.done).sort((a, b) => a.day - b.day).slice(0, n || 3);

function aiDay(G) {
  const wd = dateOf(G.day).wd;
  Object.values(G.F).forEach(f => {
    if (f.id === G.me) return;
    f.shows.forEach(s => { if (s.wd === wd) { const ev = { id: f.id + "-" + G.day + s.n, fed: f.id, n: s.n, kind: "tv", day: G.day, br: f.id === "WWE" ? s.n : "" }; autoCard(G, ev); playShow(G, ev); } });
  });
  G.ev.filter(e => e.fed !== G.me && e.day === G.day && !e.done).forEach(e => { autoCard(G, e); playShow(G, e); e.card = []; e.res = { r: e.res.r, aud: e.res.aud }; });
}

function dailyBody(G) {
  Object.values(G.W).forEach(w => {
    if (w.ret) return;
    const rest = G.rest && G.rest[w.id] > G.day;
    if (w.last !== G.day) w.en = clamp(w.en + 4 + w.st[4] / 40 + (rest ? 12 : 0) + (injured(G, w) ? 3 : 0));
    w.mor = clamp(w.mor + (w.mor < 60 ? 0.3 : w.mor > 70 ? -0.2 : 0));
    if (w.inj && w.inj.until === G.day && w.fed === G.me) mail(G, { k: "info", from: "Le médecin", role: "Ton personnel", c: "#63d69c", ini: "DR", subj: w.n + " est de retour", body: w.n + " est guéri" + (w.sx === "f" ? "e" : "") + " et peut catcher à nouveau.", imp: false });
  });
}

function randomEvents(G) {
  const mine = roster(G);
  // maladie, problème d'avion (avant un show)
  if (mine.length && rnd() < 0.04) {
    const w = pick(mine.filter(x => avail(G, x)) || []); if (w) {
      const avion = rnd() < 0.5; w.off = G.day + (avion ? 2 : 3 + Math.floor(rnd() * 4));
      mail(G, { k: "info", from: avion ? "Ton directeur des tournées" : "Le médecin", role: "Ton personnel", c: "#ffd27a", ini: avion ? "DT" : "DR", subj: avion ? w.n + " : problème d’avion" : w.n + " est malade", body: (avion ? "Son vol est annulé : " + w.n + " ne sera pas là avant " : w.n + " a une grosse grippe : repos jusqu’au ") + dayLabel(w.off) + ".\nIl ne peut pas être mis sur la carte d’ici là." });
    }
  }
  // conflit en coulisses
  if (mine.length > 4 && rnd() < 0.025) {
    const a = pick(mine), b = pick(mine.filter(x => x.id !== a.id));
    if (a && b) { G.tens.push({ a: a.id, b: b.id, d: G.day }); cap(G.tens, 12); a.mor = clamp(a.mor - 6); b.mor = clamp(b.mor - 6);
      mail(G, { k: "conflict", from: "Ton agent de sécurité", role: "Ton personnel", c: "#ff8a7e", ini: "SE", subj: "Bagarre en coulisses : " + a.n + " et " + b.n, body: a.n + " et " + b.n + " se sont disputés après le show. Tout le vestiaire en parle.\nQue fais-tu ?", a: a.id, b: b.id }); }
  }
  // un catcheur réclame un match de titre
  if (mine.length && rnd() < 0.02) {
    const w = mine.filter(x => avail(G, x) && x.pop > 55 && x.rec[0] > x.rec[1]).sort((a, b) => b.pop - a.pop)[Math.floor(rnd() * 3)];
    if (w && !(G.prom || []).some(p => p.w === w.id && p.st === "cours")) mail(G, { k: "demand", from: w.n, role: "Catcheur" + (w.sx === "f" ? "se" : "") + " · " + ROLES[w.ct.role], c: "#f5b13d", ini: ini(w.n), subj: "Je veux un match pour le titre", body: "J’ai gagné " + w.rec[0] + " matchs cette année. Je mérite ma chance pour le titre.\nSi rien ne bouge, je vais réfléchir à mon avenir.", w: w.id });
  }
  // retraite
  if (rnd() < 0.01) {
    const old = Object.values(G.W).filter(w => !w.ret && w.age >= 44 && rnd() < 0.3)[0];
    if (old) { old.ret = true; const was = old.fed; old.fed = ""; news(G, { seg: "coul", f: was === G.me ? "nous" : "autres", t: old.n + " prend sa retraite", txt: "Après une longue carrière, " + old.n + " raccroche les bottes." });
      if (was === G.me) mail(G, { k: "info", from: old.n, role: "Catcheur", c: "#a3abbd", ini: ini(old.n), subj: "Je prends ma retraite", body: "Merci pour tout, boss. Mon corps me dit stop. C’était un honneur." }); }
  }
  // rumeur
  if (rnd() < 0.05) { const w = pick(Object.values(G.W).filter(x => x.fed && x.fed !== G.me && x.pop > 65 && x.ct && x.ct.end - G.day < 120)); if (w) news(G, { seg: "coul", f: "rumeurs", t: "Rumeur : " + w.n + " bientôt libre ?", txt: "Son contrat avec " + G.F[w.fed].n + " finirait le " + shortDate(w.ct.end) + ". Plusieurs fédérations seraient intéressées." }); }
}

function contracts(G) {
  Object.values(G.W).forEach(w => {
    if (!w.fed || !w.ct || w.ret) return;
    if (w.fed === G.me) {
      // les catcheurs pas indispensables et contents prolongent d'un an tout seuls (sinon, avec 150 catcheurs, le courrier déborde)
      const key = w.ct.role === "me" || w.mor < 45;
      if (!key && w.ct.end <= G.day) { w.ct.end = G.day + 365; w.hist.push({ d: G.day, t: "Prolonge d’un an" }); mail(G, { k: "info", from: "Agent de " + w.n, role: "Agent", c: "#63d69c", ini: "AG", subj: w.n + " prolonge d’un an", body: "Content" + (w.sx === "f" ? "e" : "") + " chez toi, " + w.n + " signe un an de plus au même salaire (" + fmtK(w.ct.sal) + " par an).", imp: false }); return; }
      if (key && w.ct.end - G.day === 30) mail(G, { k: "agent", from: "Agent de " + w.n, role: "Agent", c: "#63d69c", ini: "AG", subj: "Le contrat de " + w.n + " finit dans 30 jours", body: "Si tu veux le garder, il faut négocier maintenant.\nSinon il partira le " + dayLabel(w.ct.end) + ".", w: w.id });
      if (w.ct.end <= G.day) { w.fed = ""; w.ct = null; news(G, { seg: "coul", f: "transferts", t: w.n + " quitte " + meF(G).n, txt: "Son contrat est terminé : " + w.n + " est maintenant agent libre." }); mail(G, { k: "info", from: w.n, role: "Ancien catcheur", c: "#a3abbd", ini: ini(w.n), subj: "Je pars", body: "Mon contrat est fini. Bonne chance pour la suite.", imp: false }); }
      return;
    }
    if (w.ct.end <= G.day) {
      if (w.pop > 45 || rnd() < 0.5) w.ct.end = G.day + 365 + Math.floor(rnd() * 365);
      else { const was = w.fed; w.fed = ""; w.ct = null; news(G, { seg: "coul", f: "transferts", t: w.n + " quitte " + G.F[was].n, txt: w.n + " est maintenant agent libre." }); if ((G.watch || []).indexOf(w.id) >= 0) mail(G, { k: "fa", from: "Ton recruteur", role: "Ton personnel", c: "#63d69c", ini: "RE", subj: w.n + " est libre !", body: "Tu suivais " + w.n + " : son contrat est fini. C’est le moment de lui faire une offre.", w: w.id }); }
    }
  });
}
function aiSigning(G) {
  Object.values(G.F).forEach(f => {
    if (f.id === G.me || rnd() > 0.3) return;
    const fa = Object.values(G.W).filter(w => !w.fed && !w.ret && w.age < 46 && w.pop <= f.pop + 10 && (!f.onlyF || w.sx === "f")).sort((a, b) => b.pop - a.pop);
    const w = fa[Math.floor(rnd() * Math.min(5, fa.length))]; if (!w) return;
    w.fed = f.id; w.ct = { sal: salOf(w), end: G.day + 365 + Math.floor(rnd() * 400), role: w.pop > 70 ? "up" : "mid" }; w.br = f.id === "WWE" ? pick(f.shows).n : "";
    news(G, { seg: "coul", f: "transferts", t: f.n + " signe " + w.n, txt: w.n + " rejoint " + f.n + (w.pop > 70 ? " : une belle prise." : "."), });
  });
}

function weekly(G) {
  const f = meF(G);
  // storylines : la heat monte si les deux camps se sont affrontés cette semaine, sinon elle baisse
  G.sl.forEach(s => {
    if (s.done) return; s.wk++;
    if (!(s.met >= G.day - 7)) s.heat = clamp(s.heat - 4);
    if (s.wk >= s.len) {
      s.done = true;
      if (s.turn) { const w = G.W[s.turn.w]; if (w && w.al !== s.turn.to) { w.al = s.turn.to; w.hist.push({ d: G.day, t: (s.turn.to === "heel" ? "Heel" : "Face") + " turn" }); news(G, { seg: "ecran", f: "nous", t: s.turn.to === "heel" ? w.n + " fait son heel turn !" : w.n + " fait son face turn !", txt: "À la fin de la storyline « " + s.n + " », " + w.n + " change de camp. Le public réagit fort." }); buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#6fb3ff", txt: "Je n’y crois pas… " + w.n + " a changé de camp !" }); } }
      mail(G, { k: "info", from: "Ta directrice créative", role: "Personnel · créatif", c: "#c9a7ff", ini: "DC", subj: "Fin de la storyline « " + s.n + " »", body: "Heat finale : " + s.heat + "/100." + (s.heat > 60 ? "\nLe public a adoré." : "\nElle n’a pas vraiment pris."), imp: false });
    }
  });
  // moral des catcheurs pas utilisés depuis 3 semaines (les vedettes le prennent plus mal)
  roster(G).forEach(w => { if (G.day - w.last > 21 && avail(G, w) && w.ct) w.mor = clamp(w.mor - (w.ct.role === "me" ? 4 : w.ct.role === "up" ? 2 : w.ct.role === "mid" ? 1 : 0)); });
  // centre de développement
  (G.dev || []).forEach(y => { const was = y.prog; y.prog = Math.min(100, y.prog + 2 + y.pot * 1.5 + rnd() * 3); if (was < 100 && y.prog >= 100) mail(G, { k: "young", from: y.coach, role: "Centre de développement", c: "#63d69c", ini: "CO", subj: y.n + " est prêt" + (y.sx === "f" ? "e" : ""), body: y.n + " a fini sa formation. Tu peux l" + (y.sx === "f" ? "a" : "e") + " faire monter dans l’effectif.", y: y.id }); });
  // hype du prochain grand événement
  const nb = G.ev.filter(e => e.fed === G.me && (e.kind === "ple" || e.kind === "ppv") && !e.done && e.day >= G.day).sort((a, b) => a.day - b.day)[0];
  if (nb) { const heat = G.sl.filter(s => !s.done && s.fed === G.me).reduce((s, x) => s + x.heat, 0); G.hype[nb.id] = clamp((G.hype[nb.id] || 3) + heat / 150 + (f.lastR > 65 ? 0.6 : -0.2) + (rnd() - 0.4), 0, 10); }
  aiSigning(G);
  // offre de pub de temps en temps
  if (rnd() < 0.18) { const pay = Math.round((20 + f.pop * 1.8) / 5) * 5, min = Math.round(f.aud0 * 0.9 * 100) / 100; mail(G, { k: "sponsor", from: pick(["Volt Energy", "Titan Gym", "Rapido Pizza", "Nova Phone", "Iron Cola"]), role: "Sponsor", c: "#ffd27a", ini: "SP", subj: "Offre de pub : " + pay + " k$ par show", body: "Nous voulons notre logo sur ton ring pendant 6 mois.\n" + pay + " k$ par show, si l’audience reste au-dessus de " + fmtM(min) + ".", pay: pay, min: min }); }
  // promesses ratées
  (G.prom || []).forEach(p => { if (p.st === "cours" && p.until < G.day) { p.st = "ratee"; const w = G.W[p.w]; if (w) { w.mor = clamp(w.mor - 20); mail(G, { k: "info", from: w.n, role: "Catcheur", c: "#ff8a7e", ini: ini(w.n), subj: "Tu m’avais promis…", body: "Tu n’as pas tenu ta promesse. Je m’en souviendrai.", imp: false }); } } });
}
function monthly(G) {
  const f = meF(G), sal = Math.round(roster(G).reduce((s, w) => s + (w.ct ? w.ct.sal : 0), 0) / 12);
  // merchandising du mois
  let mer = 0; (G.merch || []).forEach(p => { const w = G.W[p.w]; if (!w || w.fed !== G.me) return; const sold = Math.round(Math.pow(w.pop, 1.6) / 6 * (p.type === "Figurine" ? 0.4 : p.type === "Casquette" ? 0.8 : 1) * (30 / Math.max(10, p.price)) * (0.8 + f.pop / 100)); p.sold = sold; p.tot = (p.tot || 0) + sold; mer += Math.round(sold * p.price * 0.9 / 1000); });
  G.fin.cur.merch += mer; G.fin.cur.sal += sal; f.money += mer - sal;
  const d = dateOf(G.day - 1); G.fin.hist.push(Object.assign({ m: d.m, y: d.y }, G.fin.cur)); cap(G.fin.hist, 12);
  G.fin.cur = { tv: 0, tix: 0, merch: 0, pub: 0, sal: 0, prod: 0 };
  if (f.money < 0) mail(G, { k: "info", from: "Ton comptable", role: "Ton personnel", c: "#ff8a7e", ini: "CP", subj: "Attention : plus d’argent", body: "Ton compte est à " + fmtK(f.money) + ". Baisse les salaires, trouve des sponsors ou fais de meilleures audiences." });
  // le circuit indépendant : de nouveaux agents libres arrivent quand il en manque
  ["f", "h"].forEach(sx => { const n = Object.values(G.W).filter(w => !w.fed && !w.ret && w.sx === sx).length; if (n < (sx === "f" ? 5 : 12)) for (let i = 0; i < 2; i++) { const w = indie(sx, G.day); w.p0 = w.pop; G.W[w.id] = w; news(G, { seg: "coul", f: "transferts", t: "Circuit indépendant : " + w.n, txt: w.n + " cherche une fédération (agent" + (sx === "f" ? "e" : "") + " libre)." }); } });
  // le contrat TV
  if (f.tv.end - G.day <= 31 && f.tv.end - G.day > 0) mail(G, { k: "tv", from: "Directeur du diffuseur", role: f.tv.n, c: "#6fb3ff", ini: "TV", subj: "Renouveler notre contrat ?", body: "Notre contrat finit le " + dayLabel(f.tv.end) + ".\nNous proposons " + Math.round(f.tv.pay * (0.9 + f.pop / 200)) + " k$ par show pendant 1 an.", pay: Math.round(f.tv.pay * (0.9 + f.pop / 200)) });
}
function yearly(G) {
  const y = dateOf(G.day - 1).y, A = awardsOf(G, y);
  G.awards[y] = A;
  news(G, { seg: "ecran", f: "nous", t: "Les awards de l’Année " + y, txt: A.map(a => a.cat + " : " + a.who).join(" · ") });
  mail(G, { k: "info", from: "TCC Awards", role: "Récompenses", c: "#f5b13d", ini: "AW", subj: "Les awards de l’Année " + y, body: A.map(a => a.cat + " : " + a.who).join("\n") });
  Object.values(G.W).forEach(w => { w.car = [w.car[0] + w.rec[0], w.car[1] + w.rec[1], w.car[2] + w.rec[2]]; w.rec = [0, 0, 0]; w.age++; w.p0 = w.pop; });
  // grands événements de la nouvelle année
  const yy = y + 1; Object.keys(G.F).forEach(k => { const old = G.ev.filter(e => e.fed === k && /-big-/.test(e.id)); for (let m = 0; m < 12; m++) { const src = old[m % Math.max(1, old.length)]; G.ev.push({ id: k + "-big-" + yy + "-" + m, fed: k, n: src ? src.n : "Grand show " + (m + 1), kind: G.F[k].big === "PLE" ? "ple" : "ppv", day: lastSatY(yy, m), card: [], seg: [], done: false }); } });
  G.best = { match: null, show: null };
}
function lastSatY(y, m) { const MLEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; let d = (y - 1) * 365; for (let i = 0; i <= m; i++) d += MLEN[i]; d -= 1; while ((1 + d) % 7 !== 6) d--; return d; }

export function awardsOf(G, y) {
  const W = Object.values(G.W).filter(w => !w.ret && w.fed);
  const gain = w => (w.pop - w.p0) + w.rec[0] * 0.8;
  const best = (L, f) => L.slice().sort((a, b) => f(b) - f(a))[0];
  const sc = w => w.pop + (w.rec[0] - w.rec[1]) * 0.4;
  const men = best(W.filter(w => w.sx === "h"), sc), women = best(W.filter(w => w.sx === "f"), sc);
  const rev = best(W, gain), feud = G.sl.slice().sort((a, b) => b.heat - a.heat)[0];
  const fn = w => w ? w.n + " (" + ((G.F[w.fed] || {}).n || "libre") + ")" : "—";
  return [
    { cat: "Catcheur de l’année", who: fn(men) }, { cat: "Catcheuse de l’année", who: fn(women) },
    { cat: "Match de l’année", who: G.best.match ? G.best.match.txt + " (" + stars(G.best.match.r) + ")" : "—" },
    { cat: "Feud de l’année", who: feud ? feud.n + " (heat " + feud.heat + ")" : "—" },
    { cat: "Révélation", who: fn(rev) }, { cat: "Show de l’année", who: G.best.show ? G.best.show.txt + " (" + stars(G.best.show.r) + ")" : "—" }
  ];
}

// un jour passe
export function stepDay(G) {
  G.day++;
  const t = dateOf(G.day);
  dailyBody(G);
  aiDay(G);
  randomEvents(G);
  contracts(G);
  if (t.wd === 1) weekly(G);
  if (t.dm === 1) monthly(G);
  if (t.m === 0 && t.dm === 1 && G.day > 0) yearly(G);
  ensureMyEvents(G);
  const ev = myEventToday(G);
  if (ev) mail(G, { k: "show", from: "Ton régisseur", role: "Production", c: "#f5b13d", ini: "PR", subj: "Ce soir : " + ev.n, body: "Le show de ce soir t’attend. Prépare la carte des matchs, ou laisse l’IA la faire.", ev: ev.id });
}
// « Jour suivant » : les jours s'enchaînent jusqu'au prochain message important ou au prochain show (comme General Manager)
export function nextDay(G) {
  const today = myEventToday(G);
  if (today) return { block: today };
  G._new = 0; let n = 0;
  do { stepDay(G); n++; } while (n < 45 && !G._new && !myEventToday(G));
  return { days: n };
}
// le jeu commence
export function startGame(G) {
  ensureMyEvents(G);
  const f = meF(G);
  G.dev = [trainee(), trainee()];
  mail(G, { k: "info", from: "Le président", role: f.n, c: "#f5b13d", ini: "PR", subj: "Bienvenue, nouveau GM !", body: "Te voilà à la tête de " + f.n + ".\nTon but : faire la meilleure audience de l’année.\nUtilise « Jour suivant » pour avancer : les jours passent tout seuls jusqu’au prochain message ou au prochain show.\nTon premier show : " + ((nextMyEvents(G, 1)[0] || {}).n || "bientôt") + "." });
  if (f.id === "ME") mail(G, { k: "info", from: "Ton recruteur", role: "Ton personnel", c: "#63d69c", ini: "RE", subj: "Ton roster de départ", body: "Tu commences avec " + roster(G).length + " agents libres peu connus.\nPlus ta fédération sera célèbre, plus tu pourras signer des stars (Monde › Catcheurs du monde › Libres)." });
  news(G, { seg: "coul", f: "nous", t: f.n + " a un nouveau GM", txt: "Les fans attendent de voir ce que ça va donner." });
}
