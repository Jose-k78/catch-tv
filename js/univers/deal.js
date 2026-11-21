// Mode Univers v2 : contrats et personnes — négociation en direct (revendications, patience, offres des autres fédérations),
// rompre un contrat (libérer, à l'amiable, suspendre, placard), prise de contact, staff, légendes (apparition, caméo, staff), partenariats.
import { clamp, rnd, pick, uid, salOf, dayLabel, shortDate, fmtK } from "./world.js";
import { DEM, SROLE } from "./data.js";
import { meF, wn, roster, mail, news, buzz, FANS, relsOf, relAdd, ach, e_, ini, isBig, staffQ } from "./base.js";
import { addStaff } from "./v2.js";
import { DNA, dnaMain, dnaLike } from "./dna.js";

export function demandOf(G, w) { const f = meF(G); return Math.max(20, Math.round(salOf(w) * (1 + Math.max(0, w.pop - f.pop) / 60) * (1 - Math.max(-0.1, Math.min(0.15, ((G.rep || 50) - 50) / 300))) / 10) * 10); }
export const attract = (G, w) => { const f = meF(G); return (f.pop - w.pop) / 3 + ((G.rep || 50) - 50) / 4 + (w.fed === G.me ? (w.mor - 55) / 4 : 0) + (dnaLike(G, w) ? 5 : 0); };
const PERSD = { Ambitieux: ["wintitle", "shot", "me"], "Leader du vestiaire": ["me", "creative"], Loyal: [], "Caractériel": ["noclean", "creative"], Bosseur: [], "Fêtard": ["days", "bonus"], Discret: ["days"], Diva: ["noclean", "creative", "me"], Mentor: ["days"], "Râleur": ["bonus", "merch"], Perfectionniste: ["creative"], Showman: ["merch", "debut"] };
const SAYD = { partner: x => "Je viens seulement si tu signes aussi " + x + ".", wintitle: () => "Je veux une ceinture dès mon arrivée. Pas dans un an : tout de suite.", shot: () => "Je veux un match de titre dans les deux mois.", me: () => "Je suis une tête d’affiche : je veux le main event.",
  debut: () => "Je veux débuter dans un grand show, devant beaucoup de monde.", noclean: () => "Une chose : je ne perds jamais proprement. C’est écrit dans le contrat ou rien.", days: () => "Mon corps a besoin de repos : 6 matchs par mois, pas plus.", part: () => "Je veux garder mes dates sur le circuit indé (non exclusif).",
  bonus: () => "Une prime à chaque grand show, c’est normal pour quelqu’un comme moi.", merch: () => "10 % du merch à mon nom.", creative: () => "Personne ne touche à mon personnage sans mon accord.", mgr: x => "Mon manager " + x + " vient avec moi." };
// une négociation (créée au premier contact, gardée dans G.neg)
export function negStart(G, wid) {
  const w = G.W[wid]; if (!w) return null; G.neg = G.neg || {};
  const old = G.neg[wid];
  if (old && !old.done && old.until >= G.day) return old;
  if (old && old.left > G.day) return old;
  const pool = []; (w.pers || []).forEach(p => (PERSD[p] || []).forEach(d => pool.push(d)));
  if (w.pop >= 62) pool.push("me", "bonus"); if (w.pop >= 72) pool.push("wintitle"); if (w.age >= 36) pool.push("days", "part"); if (!w.fed) pool.push("debut");
  const fr = relsOf(G, wid).find(r => r.v >= 70 && G.W[r.id] && !G.W[r.id].ret && G.W[r.id].fed !== G.me);
  const mg = Object.values(G.staff || {}).find(s => s.role === "mgr" && s.w === wid && s.fed !== G.me);
  const n = w.pop < 40 ? 1 : w.pop < 62 ? 2 : 3, dem = [];
  if (fr && rnd() < 0.7) dem.push({ k: "partner", w: fr.id }); if (mg && rnd() < 0.7) dem.push({ k: "mgr", s: mg.id });
  // mode Mark : on ne promet pas une victoire (pas de « ceinture tout de suite » ni de « je ne perds jamais proprement »)
  if (G.mark) { for (let i = pool.length - 1; i >= 0; i--) if (pool[i] === "wintitle" || pool[i] === "noclean") pool.splice(i, 1, "shot"); }
  pool.sort(() => rnd() - 0.5).forEach(k => { if (dem.length < n && !dem.some(d => d.k === k) && DEM[k]) dem.push({ k: k }); });
  const base = demandOf(G, w), riv = [];
  const A = (G.auct || {})[wid];
  if (A) A.riv.forEach(r => riv.push(Object.assign({}, r)));
  else if ((!w.fed || (w.fed === G.me && (G.aiCont || {})[wid])) && w.pop >= 55) {
    Object.values(G.F).filter(f => f.id !== G.me && !(f.onlyF && w.sx !== "f") && f.pop >= w.pop - 20 && f.money > base * 2).sort(() => rnd() - 0.5).slice(0, w.pop >= 75 ? 3 : w.pop >= 65 ? 2 : 1).forEach(f => { if (rnd() < 0.7) riv.push({ fed: f.id, sal: Math.round(base * (0.9 + rnd() * 0.35) * (f.strat === "stars" ? 1.15 : f.strat === "econome" ? 0.9 : 1) / 10) * 10 }); });
  }
  const N = { w: wid, round: 0, pat: clamp(100 - ((w.pers || []).indexOf("Caractériel") >= 0 ? 20 : 0) - ((w.pers || []).indexOf("Diva") >= 0 ? 10 : 0)), dem: dem, riv: riv, base: base, until: G.day + (riv.length ? 6 + Math.floor(rnd() * 5) : 21), log: [], done: false };
  N.log.push(["him", (w.fed === G.me ? "On parle de mon avenir ? D’accord, je t’écoute." : "Bonjour. " + (w.sx === "f" ? "Ma cliente " : "Mon client ") + w.n + " est prêt" + e_(w) + " à écouter ton offre.") + (dem.length ? " Mais " + (w.sx === "f" ? "elle" : "il") + " a des conditions." : "")]);
  if (dnaLike(G, w)) N.log.push(["him", (w.fed === G.me ? "Ce qui me plaît ici" : "Ce qui lui plaît chez vous") + " : la " + DNA[dnaMain(G)].n.toLowerCase() + ". C’est " + (w.fed === G.me ? "mon" : "son") + " style."]);
  dem.forEach(d => N.log.push(["him", SAYD[d.k](d.w ? wn(G, d.w) : d.s ? ((G.staff[d.s] || {}).n || "") : "")]));
  riv.forEach(r => N.log.push(["riv", (G.F[r.fed] || {}).n + " lui propose " + fmtK(r.sal) + " par an."]));
  G.neg[wid] = N; return N;
}
// la note d'une offre (sans hasard) : ≥ 1 il signe, entre -1,5 et 1 il discute, en dessous il refuse
export function negScore(G, wid, o) {
  const w = G.W[wid], N = G.neg && G.neg[wid]; if (!w || !N) return -9;
  const roleS = { me: 1.6, up: 0.6, mid: 0, low: -1.6 }[o.role] || 0, durS = o.dur >= 4 ? -0.6 : o.dur <= 1 ? -0.2 : 0;
  let acc = 0, ref = 0; N.dem.forEach((d, i) => { if (o.acc && o.acc[d.k]) acc += 2.2; else ref += i === 0 ? 3.4 : 2.6; });
  const bestRiv = N.riv.length ? Math.max(...N.riv.map(r => r.sal)) : 0;
  let sc = (o.sal / N.base - 1) * 8 + roleS + durS + acc - ref + (o.bonus || 0) / N.base * 4 + attract(G, w) / 6 - (bestRiv ? (bestRiv / N.base - 1) * 8 + 0.6 : 0);
  if (o.exc === false && !N.dem.some(d => d.k === "part")) sc -= 0.4; if (o.exc === false && N.dem.some(d => d.k === "part")) sc += 0.5;
  if (w.pop > meF(G).pop + 30 && w.fed !== G.me) sc -= 6;
  return sc;
}
// une offre : { sal, dur, role, exc, acc: { k: true/false }, bonus }
export function negOffer(G, wid, o) {
  const w = G.W[wid], N = G.neg && G.neg[wid]; if (!w || !N || N.done) return { ok: false, txt: "La négociation est finie." };
  if (w.nc > G.day) return { ok: false, txt: w.n + " ne peut pas signer avant le " + dayLabel(w.nc) + " (clause de non-concurrence)." };
  N.round++;
  const roleS = { me: 1.6, up: 0.6, mid: 0, low: -1.6 }[o.role] || 0, durS = o.dur >= 4 ? -0.6 : o.dur <= 1 ? -0.2 : 0;
  let acc = 0, ref = 0; N.dem.forEach((d, i) => { if (o.acc && o.acc[d.k]) acc += 2.2; else ref += i === 0 ? 3.4 : 2.6; });
  const bestRiv = N.riv.length ? Math.max(...N.riv.map(r => r.sal)) : 0;
  let sc = (o.sal / N.base - 1) * 8 + roleS + durS + acc - ref + (o.bonus || 0) / N.base * 4 + attract(G, w) / 6 - (bestRiv ? (bestRiv / N.base - 1) * 8 + 0.6 : 0);
  if (o.exc === false && !N.dem.some(d => d.k === "part")) sc -= 0.4; if (o.exc === false && N.dem.some(d => d.k === "part")) sc += 0.5;
  if (w.pop > meF(G).pop + 30 && w.fed !== G.me) sc -= 6;
  N.log.push(["me", "Offre : " + fmtK(o.sal) + " par an, " + o.dur + " an" + (o.dur > 1 ? "s" : "") + (o.bonus ? ", prime de signature " + fmtK(o.bonus) : "") + (N.dem.length ? ", " + N.dem.map(d => (o.acc && o.acc[d.k] ? "oui" : "non") + " pour « " + DEM[d.k].toLowerCase() + " »").join(", ") : "")]);
  if (sc >= 1 || (sc >= 0 && rnd() < 0.5)) { sign(G, w, o, N); N.done = true; N.log.push(["him", "Marché conclu ! " + w.n + " signe."]); return { ok: true, txt: w.n + " signe : " + fmtK(o.sal) + " par an pendant " + o.dur + " an" + (o.dur > 1 ? "s" : "") + "." }; }
  N.pat = clamp(N.pat - (sc >= -1.5 ? 12 + (1 - sc) * 4 : 25 + Math.min(20, -sc * 3)));
  if (N.pat <= 0) { N.done = true; N.left = G.day + 30; N.log.push(["him", "Ça ne mène à rien. " + (w.sx === "f" ? "Ma cliente" : "Mon client") + " va voir ailleurs."]); return { ok: false, txt: "L’agent quitte la table. Pas de nouvelle discussion avant 30 jours." }; }
  const need = Math.round(N.base * (1 + Math.max(0, (1 - sc) / 10) + (bestRiv ? Math.max(0, bestRiv / N.base - 1) : 0)) / 10) * 10, miss = N.dem.find(d => !(o.acc && o.acc[d.k]));
  const t = sc >= -1.5 ? (miss && rnd() < 0.6 ? "On y est presque. Mais " + DEM[miss.k].toLowerCase() + ", " + (w.sx === "f" ? "elle" : "il") + " y tient vraiment." : "On se rapproche. " + (w.sx === "f" ? "Elle" : "Il") + " veut au moins " + fmtK(need) + " par an.") : (bestRiv ? "Tu es loin du compte : " + (G.F[N.riv.find(r => r.sal === bestRiv).fed] || {}).n + " offre plus." : "C’est trop peu. " + (w.sx === "f" ? "Elle" : "Il") + " demande " + fmtK(need) + ".");
  N.log.push(["him", t]); return { ok: false, txt: t };
}
function sign(G, w, o, N) {
  const f = meF(G), was = w.fed;
  w.fed = G.me; w.guest = null;
  const cl = {}; N.dem.forEach(d => { if (o.acc && o.acc[d.k]) cl[d.k] = true; });
  w.ct = { sal: o.sal, end: G.day + o.dur * 365, role: o.role, exc: o.exc !== false, cl: cl };
  if (o.bonus) { f.money -= o.bonus; G.fin.cur.prod += o.bonus; }
  if (f.id === "WWE" && f.split) w.br = G.solo || w.br || f.shows[0].n;
  w.mor = clamp(w.mor + 8); w.hist.push({ d: G.day, t: (was === G.me ? "Prolonge" : "Signe") + " chez " + f.n + " (" + o.dur + " an" + (o.dur > 1 ? "s" : "") + ")" });
  const P = (t, days, txt) => G.prom.push({ id: uid("p"), w: w.id, t: t, until: G.day + days, st: "cours", txt: txt });
  if (cl.wintitle) P("wintitle", 90, "Gagner un titre avant le " + shortDate(G.day + 90));
  if (cl.shot) P("titre", 60, "Match de titre avant le " + shortDate(G.day + 60));
  if (cl.me) P("me", 30, "Main event avant le " + shortDate(G.day + 30));
  if (cl.debut) P("debut", 60, "Débuter dans un grand show");
  if (cl.mgr) { const d = N.dem.find(x => x.k === "mgr"), s = d && G.staff[d.s]; if (s) { s.fed = G.me; s.w = w.id; } }
  if (cl.partner) { const d = N.dem.find(x => x.k === "partner"), p = d && G.W[d.w]; if (p && !p.fed && !(p.nc > G.day)) { p.fed = G.me; p.ct = { sal: demandOf(G, p), end: G.day + o.dur * 365, role: "mid", exc: true, cl: {} }; p.hist.push({ d: G.day, t: "Signe avec " + w.n }); news(G, { seg: "coul", f: "transferts", t: f.n + " signe " + p.n + " aussi", txt: p.n + " suit " + w.n + "." }); } else if (p) P("partner", 180, "Signer " + p.n + " quand il sera libre"); }
  if (G.auct) delete G.auct[w.id];
  if (G.aiCont) delete G.aiCont[w.id];
  if (was !== G.me) { if (w.pop >= 80) ach(G, "star"); w.newSign = G.day; }
  else news(G, { seg: "coul", f: "nous", t: w.n + " prolonge chez " + f.n, txt: (w.sx === "f" ? "Elle" : "Il") + " reste " + o.dur + " an" + (o.dur > 1 ? "s" : "") + " de plus." });
}
// annoncer une signature ou la garder secrète jusqu'à ses débuts
export function announce(G, wid, secret, evId) {
  const w = G.W[wid], f = meF(G); if (!w) return;
  if (secret) { w.secret = true; w.leak = false; w.debutEv = evId || ""; }
  else { w.secret = false; news(G, { seg: "coul", f: "transferts", t: f.n + " signe " + w.n, txt: w.n + " rejoint " + f.n + "." }); buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#6fb3ff", txt: f.n + " a signé " + w.n + " ! J’ai hâte de voir ça." }); const nb = (G.ev || []).find(e => e.id === evId); if (nb) G.hype[nb.id] = clamp((G.hype[nb.id] || 3) + w.pop / 40, 0, 10); }
}

// ---------- rompre un contrat ----------
export const releaseCost = (G, w) => !w.ct ? 0 : Math.round(w.ct.sal * Math.max(0, w.ct.end - G.day) / 365);
export function release(G, wid, kind, weeks) {
  const w = G.W[wid], f = meF(G); if (!w || w.fed !== G.me) return "";
  if (kind === "susp") { w.susp = G.day + (weeks || 2) * 7; w.mor = clamp(w.mor - 15); w.pop = clamp(w.pop - 1, 1, 99); w.hist.push({ d: G.day, t: "Suspendu" + e_(w) + " " + (weeks || 2) + " semaines" }); news(G, { seg: "coul", f: "nous", t: w.n + " suspendu" + e_(w), txt: "Sanction de " + (weeks || 2) + " semaines." }); return w.n + " est suspendu" + e_(w) + " jusqu’au " + shortDate(w.susp) + " (sans salaire)."; }
  if (kind === "bench") { w.bench = !w.bench; if (w.bench) w.mor = clamp(w.mor - 5); return w.bench ? w.n + " est mis" + e_(w) + " au placard : payé" + e_(w) + ", mais plus sur les cartes." : w.n + " revient dans l’effectif."; }
  const cost = kind === "amiable" ? Math.round(releaseCost(G, w) * 0.3) : releaseCost(G, w);
  if (kind === "amiable" && !(w.mor < 50 || w.ask)) return "";
  f.money -= cost; G.fin.cur.sal += cost;
  w.fed = ""; w.ct = null; w.bench = false; w.ask = false; w.nc = G.day + (kind === "amiable" ? 30 : 90); w.br = "";
  Object.values(G.T).forEach(t => { const c = Array.isArray(t.champ) ? t.champ : [t.champ]; if (c.indexOf(wid) >= 0) { t.champ = t.div === "tag" ? [] : ""; t.since = G.day; news(G, { seg: "ecran", f: "nous", t: t.n + " vacant", txt: "Le titre est libéré après le départ de " + w.n + "." }); } });
  (G.teams || []).forEach(t => { t.m = t.m.filter(i => i !== wid); }); G.teams = G.teams.filter(t => t.m.length >= 2);
  w.hist.push({ d: G.day, t: "Libéré" + e_(w) + " par " + f.n });
  news(G, { seg: "coul", f: "transferts", t: f.n + " libère " + w.n, txt: (kind === "amiable" ? "Départ à l’amiable. " : "") + w.n + " ne pourra pas signer ailleurs avant le " + shortDate(w.nc) + "." });
  if (w.pop > 65) { roster(G).forEach(x => { x.mor = clamp(x.mor - 3); }); G.rep = clamp((G.rep || 50) - 2); }
  return w.n + " est libéré" + e_(w) + (cost ? " (coût : " + fmtK(cost) + ")" : "") + ". " + (w.sx === "f" ? "Elle" : "Il") + " ne peut pas signer ailleurs avant le " + shortDate(w.nc) + ".";
}
// prise de contact avec un catcheur sous contrat ailleurs (limité : 2 par mois, contrat qui finit dans 120 jours)
export function canContact(G, w) { if (!w || !w.fed || w.fed === G.me || !w.ct) return "Seulement un catcheur sous contrat ailleurs"; if (w.ct.end - G.day > 120) return "Son contrat finit le " + shortDate(w.ct.end) + " : trop tôt pour le contacter"; if ((G.cont || {})[w.id]) return "Déjà contacté"; const m = Math.floor(G.day / 30); if ((G.contM || {}).m === m && G.contM.n >= 2) return "2 prises de contact par mois au maximum"; return ""; }
export function contact(G, wid) {
  const w = G.W[wid], why = canContact(G, w); if (why) return why;
  const m = Math.floor(G.day / 30); G.contM = G.contM && G.contM.m === m ? G.contM : { m: m, n: 0 }; G.contM.n++;
  const int = clamp(30 + attract(G, w) * 2 + rnd() * 30 - (w.mor - 60) / 2);
  G.cont[w.id] = { d: G.day, int: int }; partAdd(G, w.fed, -4);
  return int >= 55 ? w.n + " est intéressé" + e_(w) + " (" + int + " %) : " + (w.sx === "f" ? "elle" : "il") + " ne devrait pas prolonger chez " + (G.F[w.fed] || {}).n + "." : w.n + " écoute poliment, sans plus (" + int + " %).";
}
// ---------- staff ----------
export function hireStaff(G, sid) { const s = G.staff[sid], f = meF(G); if (!s || s.fed) return ""; s.fed = G.me; s.end = G.day + 730; s.w = ""; f.money -= Math.round(s.sal / 6); G.fin.cur.prod += Math.round(s.sal / 6); return s.n + " rejoint ton staff (" + SROLE[s.role][0].toLowerCase() + ")."; }
export function fireStaff(G, sid) { const s = G.staff[sid]; if (!s || s.fed !== G.me) return ""; s.fed = ""; s.w = ""; return s.n + " quitte ton staff."; }
// une légende retraitée : staff, manager, apparition dans un match ou caméo dans un segment
const LQ = { comm: [2, 3], coach: [1, 6], prod: [1, 6], gm: [2, 5], mgr: [2, 3], writer: [2, 3], ref: [6, 1], ann: [2, 3], scout: [1, 6], med: [6, 4], social: [3, 5], biz: [5, 3] };
export function hireLegend(G, wid, role) {
  const w = G.W[wid]; if (!w || !w.ret || w.staff) return "";
  const k = LQ[role] || [2, 3], q = clamp((w.st[k[0]] + w.st[k[1]]) / 2 + 8);
  const s = addStaff(G, { n: w.n, pic: w.pic, role: role, fed: G.me, q: q, real: true, sx: w.sx, wid: wid }); w.staff = s.id;
  news(G, { seg: "coul", f: "nous", t: w.n + " rejoint " + meF(G).n, txt: "La légende devient " + SROLE[role][0].toLowerCase() + "." });
  return w.n + " rejoint ton staff : " + SROLE[role][0].toLowerCase() + " (qualité " + q + ").";
}
export const appearFee = (G, w, k) => Math.round((k === "match" ? 3 : 1.5) * (20 + w.pop * 1.6) / 5) * 5;
export function appear(G, wid, evId, k) {
  const w = G.W[wid], ev = (G.ev || []).find(e => e.id === evId), f = meF(G); if (!w || !ev) return "";
  const fee = appearFee(G, w, k); if (f.money < fee) return "Pas assez d’argent (" + fmtK(fee) + ")";
  f.money -= fee; G.fin.cur.prod += fee; G.appear = (G.appear || []).concat({ w: wid, ev: evId, k: k });
  if (isBig(ev)) G.hype[ev.id] = clamp((G.hype[ev.id] || 3) + w.pop / 35, 0, 10);
  return w.n + " sera là à " + ev.n + " (" + (k === "match" ? "match" : "caméo") + ", " + fmtK(fee) + "). Ajoute-l" + (w.sx === "f" ? "a" : "e") + " dans la carte du show.";
}
export const guestsFor = (G, ev) => (G.appear || []).filter(a => a.ev === ev.id).map(a => a.w);

// ---------- partenariats ----------
export function part(G, fid) { G.part = G.part || {}; if (!G.part[fid]) { const f = G.F[fid]; G.part[fid] = { rel: f && f.strat === "agressif" ? -20 : f && f.strat === "jeunes" ? 10 : 0, deal: null }; } return G.part[fid]; }
export function partAdd(G, fid, v) { if (!fid || !G.F[fid] || fid === G.me) return; const p = part(G, fid); p.rel = clamp(p.rel + v, -100, 100); }
export function propose(G, fid) {
  const p = part(G, fid), f = G.F[fid]; if (!f || p.deal) return "";
  if (p.rel >= 15 && rnd() < 0.35 + p.rel / 140) { p.deal = { since: G.day, until: G.day + 365 }; p.rel = clamp(p.rel + 6, -100, 100); ach(G, "part"); news(G, { seg: "coul", f: "nous", t: "Partenariat : " + meF(G).n + " et " + f.n, txt: "Les deux fédérations vont échanger des catcheurs." }); return f.n + " accepte : partenariat d’un an !"; }
  p.rel = clamp(p.rel - 3, -100, 100); return f.n + " refuse pour l’instant (relation : " + p.rel + ").";
}
export function lend(G, wid, fid, weeks) {
  const w = G.W[wid], p = part(G, fid); if (!w || w.fed !== G.me || !p.deal) return "";
  const fee = Math.round((10 + w.pop * 1.2) / 5) * 5; w.guest = { to: fid, until: G.day + weeks * 7, fee: fee, lend: true }; p.rel = clamp(p.rel + 3, -100, 100);
  news(G, { seg: "coul", f: "nous", t: w.n + " prêté" + e_(w) + " à " + G.F[fid].n, txt: "Pendant " + weeks + " semaines, " + (w.sx === "f" ? "elle" : "il") + " catchera aussi chez eux et reste sous contrat chez " + meF(G).n + "." });
  return w.n + " est prêté" + e_(w) + " à " + G.F[fid].n + " (" + fmtK(fee) + " par semaine). " + (w.sx === "f" ? "Elle" : "Il") + " reste chez toi et tu peux toujours l’utiliser.";
}
export function rent(G, wid, weeks) {
  const w = G.W[wid], p = w && part(G, w.fed), f = meF(G); if (!w || !p || !p.deal) return "";
  const fee = Math.round((10 + w.pop * 1.5) / 5) * 5; w.guest = { to: G.me, until: G.day + weeks * 7, fee: -fee }; p.rel = clamp(p.rel + 2, -100, 100);
  return w.n + " vient chez toi pendant " + weeks + " semaines (" + fmtK(fee) + " par semaine).";
}
export function invasion(G, fid) {
  const p = part(G, fid), f = G.F[fid]; if (!p.deal) return "";
  const them = roster(G, fid).filter(w => !w.guest).sort((a, b) => b.pop - a.pop).slice(0, 3), mine = roster(G).sort((a, b) => b.pop - a.pop).slice(0, 3);
  if (them.length < 2 || mine.length < 2) return "Pas assez de catcheurs";
  them.forEach(w => { w.guest = { to: G.me, until: G.day + 42, fee: 0, inv: true }; });
  G.sl.push({ id: uid("s"), fed: G.me, n: "L’invasion de " + f.n, p: f.n + " envahit les shows de " + meF(G).n + " !", a: mine.map(w => w.id), b: them.map(w => w.id), len: 6, wk: 0, heat: 45, turn: null, done: false, from: G.day });
  news(G, { seg: "ecran", f: "nous", t: f.n + " envahit " + meF(G).n + " !", txt: them.map(w => w.n).join(", ") + " débarquent." }); p.rel = clamp(p.rel - 5, -100, 100);
  return "L’invasion commence : une storyline de 6 semaines est lancée (Créatif › Storylines).";
}
export function jointShow(G, fid, day, n) {
  const p = part(G, fid), f = G.F[fid]; if (!p.deal || !f) return "";
  const id = uid(G.me + "-co"); G.ev.push({ id: id, fed: G.me, n: n || meF(G).sh + " × " + f.sh, kind: meF(G).big === "PLE" ? "ple" : "ppv", day: day, items: [], done: false, part: fid });
  G.hype[id] = 5; roster(G, fid).filter(w => !w.guest).sort((a, b) => b.pop - a.pop).slice(0, 8).forEach(w => { G.appear.push({ w: w.id, ev: id, k: "match" }); });
  news(G, { seg: "ecran", f: "nous", t: "Show commun : " + meF(G).n + " et " + f.n, txt: "Rendez-vous le " + dayLabel(day) + "." });
  return "Show commun créé le " + dayLabel(day) + " : les stars de " + f.n + " pourront être mises sur la carte.";
}
