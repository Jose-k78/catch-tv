// Mode Univers v2 : le créatif — gimmicks (proposer, changer, repackaging), tournois (tableau, ligue, gauntlet), traditions,
// mallette (encaissement), n°1 challengers, draft / brand split, mentors, entraînement ciblé, chapitres de storyline.
import { clamp, rnd, pick, uid, dateOf, shortDate } from "./world.js";
import { GT, GNAME, MT } from "./data.js";
import { meF, wn, roster, avail, mail, news, buzz, FANS, ach, champIds, e_, relAdd } from "./base.js";
import { fitOf, gimOf } from "./v2.js";

// ---------- gimmicks ----------
export function gimIdeas(txt, t) {
  const low = (txt || "").toLowerCase(), out = [];
  const T = t && GT[t] ? t : Object.keys(GT).find(k => low.indexOf(GT[k][0].toLowerCase()) >= 0) || "";
  if (T) GNAME[T].forEach(n => out.push([n, T]));
  const words = (txt || "").trim().split(/\s+/).filter(x => x.length > 2);
  if (words.length) { const w = words[0][0].toUpperCase() + words[0].slice(1); out.unshift(["The " + w, T || "showman"], ["Le " + w, T || "combattant"]); }
  if (!out.length) Object.keys(GT).sort(() => rnd() - 0.5).slice(0, 4).forEach(k => out.push([pick(GNAME[k]), k]));
  return out.slice(0, 6);
}
export function gimChance(G, w, t) {
  let c = 0.72 + (w.mor - 60) / 100 - (w.pop > 75 ? 0.22 : 0) + (fitOf(w, t) - fitOf(w, gimOf(w).t)) / 120;
  if ((w.pers || []).some(p => p === "Diva" || p === "Caractériel")) c -= 0.18;
  if (w.ct && w.ct.cl && w.ct.cl.creative) c -= 0.3;
  return Math.max(0.05, Math.min(0.97, c));
}
// proposer un gimmick (repack = nouveau nom de ring aussi)
export function proposeGim(G, wid, o) {
  const w = G.W[wid]; if (!w || w.fed !== G.me) return { ok: false, txt: "" };
  const t = GT[o.t] ? o.t : gimOf(w).t, ch = gimChance(G, w, t);
  if (rnd() > ch) { w.mor = clamp(w.mor - 6); return { ok: false, txt: w.n + " refuse : « Ce personnage, ce n’est pas moi. »" }; }
  const old = gimOf(w), f0 = fitOf(w, old.t), f1 = fitOf(w, t);
  if (o.rn && o.rn.trim() && o.rn.trim() !== w.n) { w.rn0 = w.rn0 || w.n; w.n = o.rn.trim().slice(0, 40); w.pop = clamp(w.pop * 0.85, 1, 99); }
  w.gim = { n: (o.n || "").trim().slice(0, 40), t: t, fresh: 100, wk: 0, since: G.day };
  w.hist.push({ d: G.day, t: "Nouveau personnage : " + GT[t][0] + (w.gim.n ? " « " + w.gim.n + " »" : "") });
  if (f1 < 42) { w.pop = clamp(w.pop - 8, 1, 99); w.crowd = clamp((w.crowd || 40) - 10); buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#ff8a7e", txt: "Le nouveau personnage de " + w.n + "… c’est une blague ? 😂" }); return { ok: true, txt: "C’est un flop : ce personnage ne lui va pas du tout (popularité en baisse).", flop: true }; }
  if (f1 >= f0 + 8 || f1 >= 70) { w.pop = clamp(w.pop + 3, 1, 99); w.crowd = clamp((w.crowd || 40) + 6); ach(G, "repack"); buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#6fb3ff", txt: "Ce nouveau " + w.n + " est génial, enfin un vrai personnage !" }); return { ok: true, txt: "Gros succès : le public adore son nouveau personnage." }; }
  return { ok: true, txt: w.n + " accepte son nouveau personnage." };
}

// ---------- tournois ----------
// o = { n, fmt: bracket | league | gauntlet, size, cat: h | f | x, tag, ids (facultatif), pr: shot | trophy | case }
export function createTour(G, o) {
  const f = meF(G), size = Math.max(4, Math.min(32, +o.size || 8)), cat = o.cat || "h";
  let ids = (o.ids || []).filter(i => G.W[i]);
  if (ids.length < size) { const pool = roster(G).filter(w => avail(G, w) && (cat === "x" || w.sx === cat) && ids.indexOf(w.id) < 0).sort((a, b) => b.pop - a.pop); ids = ids.concat(pool.slice(0, size - ids.length).map(w => w.id)); }
  if (ids.length < (o.fmt === "gauntlet" ? 4 : size)) return { err: "Il faut " + size + " catcheurs disponibles (" + ids.length + ")" };
  ids = ids.slice(0, size);
  G.tourPres = G.tourPres || {}; const ed = (G.tours || []).filter(t => t.n === o.n).length + 1;
  const t = { id: uid("o"), fed: G.me, n: o.n, fmt: o.fmt || "bracket", size: size, cat: cat, m: ids, pr: o.pr || "shot", ed: ed, pres: G.tourPres[o.n] || 40, win: "", from: G.day, img: o.img || "" };
  if (t.fmt === "bracket") { const S = seedOrder(size).map(i => ids[i]); t.r = [[]]; for (let i = 0; i < S.length; i += 2) t.r[0].push({ a: S[i], b: S[i + 1], w: "" }); t.cur = 0; }
  else if (t.fmt === "league") { const nb = size >= 10 ? 2 : 1, blocks = []; for (let b = 0; b < nb; b++) blocks.push({ m: ids.filter((x, i) => i % nb === b), pts: {}, g: [] }); blocks.forEach(B => { for (let i = 0; i < B.m.length; i++) for (let j = i + 1; j < B.m.length; j++) B.g.push({ a: B.m[i], b: B.m[j], w: "" }); }); t.blocks = blocks; if (nb === 1) t.single = true; }
  else { t.final = { a: "", b: "", w: "" }; }
  G.tours = (G.tours || []).concat(t);
  news(G, { seg: "ecran", f: "nous", t: o.n + (ed > 1 ? " (édition " + ed + ")" : ""), txt: size + " participants. " + (t.fmt === "league" ? "Format ligue : des points à chaque match." : t.fmt === "gauntlet" ? "Un gauntlet : un seul survivant." : "Élimination directe.") + " La finale aura lieu dans un grand show." });
  return { t: t };
}
function seedOrder(n) { let s = [0, 1]; while (s.length < n) { const m = s.length * 2 - 1; s = s.reduce((a, x) => a.concat([x, m - x]), []); } return s; }
// ligue à un seul bloc : la finale oppose les deux premiers
export function leagueFinal(t) { if (t.fmt !== "league" || t.final) return; if (t.blocks.every(B => B.g.every(x => x.w))) { if (t.single) { const B = t.blocks[0], L = B.m.slice().sort((a, b) => (B.pts[b] || 0) - (B.pts[a] || 0)); t.final = { a: L[0], b: L[1], w: "" }; } } }

// ---------- traditions ----------
export function saveTrad(G, id, o) {
  let x = (G.trad || []).find(y => y.id === id);
  if (!x) { x = { id: uid("tr"), fed: G.me, on: true, ed: 0, pres: 40, k: "match", t: "battle", m: 0, z: 10, pr: "shot", x: "h" }; G.trad = (G.trad || []).concat(x); }
  Object.assign(x, o); if (x.k === "match" && !MT[x.t]) x.t = "battle"; return x;
}
// ---------- mallette : encaisser après un match de titre ----------
export function cashIn(G, ev, wid, ti) {
  const c = (G.mitb || []).find(x => x.w === wid && x.fed === G.me), t = G.T[ti]; if (!c || !t) return false;
  const ch = champIds(t); if (!ch.length) return false;
  const at = (ev.items || []).findIndex(it => it.it === "m" && it.title === ti), it = { it: "m", t: "simple", sides: [ch.slice(0, 1), [wid]], title: ti, stip: "", fin: "auto", cons: "", dur: "court", win: "ia", spots: [], cashin: true };
  ev.items.splice(at >= 0 ? at + 1 : ev.items.length, 0, it);
  G.mitb = G.mitb.filter(x => x !== c);
  return true;
}
// ---------- n°1 challengers ----------
export function contenders(G, t) {
  const ch = champIds(t), sh = (G.shots || []).filter(s => s.t === t.id).map(s => s.w);
  const L = roster(G, t.fed).filter(w => ch.indexOf(w.id) < 0 && (t.cat === "x" || w.sx === t.cat) && !w.bench).map(w => ({ w: w, s: w.rec[0] * 3 + w.rec[2] + (w.mom || 0) / 5 + w.pop / 10 + (sh.indexOf(w.id) >= 0 ? 100 : 0) }));
  return L.sort((a, b) => b.s - a.s).slice(0, 5);
}
// ---------- draft (marques) ----------
export function setBrand(G, wid, br) { const w = G.W[wid]; if (w && w.fed === G.me) w.br = br; }
export function autoDraft(G) {
  const f = meF(G), L = roster(G).sort((a, b) => b.pop - a.pop), B = f.shows.map(s => s.n);
  L.forEach((w, i) => { w.br = B[(i % (B.length * 2) < B.length ? i % B.length : B.length - 1 - (i % B.length))]; });
  news(G, { seg: "ecran", f: "nous", t: "Draft de " + f.n, txt: "Les catcheurs sont répartis entre " + B.join(", ") + "." });
}
// ---------- mentors et entraînement ----------
export function setMentor(G, young, vet) { G.ment = G.ment || {}; if (!vet) delete G.ment[young]; else { G.ment[young] = vet; relAdd(G, young, vet, 8); } }
export function setTrain(G, wid, i) { const w = G.W[wid]; if (w) w.train = i == null || i === "" ? -1 : +i; }
// chapitres d'une storyline (semaine par semaine)
export const CHAP = { attack: "Attaque", promo: "Promo au micro", face: "Face-à-face", contract: "Signature de contrat", brawl: "Bagarre en coulisses", match: "Un match entre eux", betray: "Trahison" };
export const segOfChap = { attack: ["attack", "ambush"], promo: ["promo", "bsint"], face: ["face"], contract: ["contract"], brawl: ["brawl"], match: ["match"], betray: ["betray"] };
export const shotOf = (G, wid) => (G.shots || []).find(s => s.w === wid);
export const caseOf = (G, wid) => (G.mitb || []).find(s => s.w === wid);
export const dayIn = (G, d) => shortDate(d);
export const yNow = G => dateOf(G.day).y;
