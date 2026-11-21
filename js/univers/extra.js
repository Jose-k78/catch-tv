// Mode Univers (21 nov., heure du codage) : les idées gardées par Jose — entrées spectaculaires, rêve de carrière, progression du GM,
// house shows, réunion créative, circuit indé, héros local, sponsors visibles, types d'histoires, liens des équipes et des clans,
// base commune du modo (data/univers.json), Butterfly Effect (conséquences des années plus tard), Ghost of Booking (le passé revient).
import { S } from "../state.js";
import { norm } from "../wrestlers.js";
import { clamp, rnd, pick, uid, dateOf, shortDate, dayLabel, fmtK, indie } from "./world.js";
import { CITIES, udata } from "./data.js";
import { meF, roster, mail, news, buzz, FANS, champIds, relGet, relAdd, isMine, e_, cap, wn } from "./base.js";
import { autoCard, simMatch, cityOf, idsOf } from "./match.js";
import { bondAdd } from "./vn.js";

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

// ---------- entrées spectaculaires (par match) ----------
export const ENTX = [["Entrée normale", 0, 0], ["Lumières", 5, 1.5], ["Pyro", 15, 3], ["Musique en live", 30, 4.5]];
export const entOf = (ev, it) => it && it.ent != null && it.ent !== "" ? +it.ent : 0;
export const entCost = ev => (ev.items || []).reduce((s, it) => s + (ENTX[entOf(ev, it)] || ENTX[0])[1], 0);

// ---------- héros local : le catcheur vient de la ville (ou du pays) du show ----------
const REG = [[/japon/i, "jp"], [/mexique|jalisco/i, "mx"], [/angleterre|irlande|écosse|allemagne|france|italie|espagne|pays de galles|moldavie|europe/i, "eu"], [/australie|nouvelle-zélande/i, "au"], [/arabie|émirats/i, "me"]];
export const fromOf = w => w.from || ((S.wrestlers || {})[w.n] || {}).from || "";
export function heroOf(G, w, ev) {
  const fr = fromOf(w); if (!fr || !ev) return 0; const c = cityOf(G, ev); if (!c) return 0;
  if (norm(fr).indexOf(norm(c[0])) >= 0 || (c[0] === "Mexico" && /mexico/i.test(fr))) return 2;
  const r = (REG.find(x => x[0].test(fr)) || [0, /,|\(/.test(fr) ? "us" : ""])[1]; return r && r === c[3] && c[3] !== "us" ? 1 : 0;
}
export const heroBonus = (G, ev, all) => all.reduce((s, w) => s + [0, 1.5, 4][heroOf(G, w, ev)], 0);

// ---------- progression du GM (XP, niveaux, talents) ----------
export const TAL = {
  neg: ["Négociateur", "Les catcheurs demandent 8 % de moins."], show: ["Showman", "Le public de tes shows est plus chaud."], coach: ["Formateur", "Le centre de formation progresse 30 % plus vite."],
  dip: ["Diplomate", "Les autres fédérations t’apprécient plus vite."], eye: ["Œil du recruteur", "Tu connais les catcheurs dès qu’ils ont un peu de notoriété."],
  eco: ["Gestionnaire", "Production des shows 10 % moins chère."], pote: ["Ami des catcheurs", "Tes bons moments avec les catcheurs comptent plus."]
};
export const gmx = G => (G.gmx = G.gmx || { xp: 0, lv: 1, pts: 0, tal: [] });
export const hasTal = (G, k) => !!G && !!G.gmx && G.gmx.tal.indexOf(k) >= 0;
export const xpNeed = lv => 80 + lv * 60;
export function xpAdd(G, n, why) {
  const X = gmx(G); X.xp += Math.max(0, Math.round(n));
  while (X.xp >= xpNeed(X.lv)) { X.xp -= xpNeed(X.lv); X.lv++; X.pts++; G._pop = (G._pop || []).concat({ t: "Tu passes niveau " + X.lv + " de GM !", lv: X.lv, m: 0, s: 0 }); }
}
export function takeTal(G, k) { const X = gmx(G); if (!TAL[k] || X.pts < 1 || X.tal.indexOf(k) >= 0) return false; X.pts--; X.tal.push(k); return true; }

// ---------- rêve de carrière (caché tant qu'il ne te l'a pas confié) ----------
export const DREAMS = { titre: "Devenir champion", main: "Être en main event du plus grand show de l’année", tour: "Gagner un tournoi", idol: "Affronter {o}", ville: "Catcher devant les siens, chez lui" };
export function dreamOf(G, w) {
  if (!w || w.ret) return null; if (w.dream) return w.dream;
  const L = ["titre", "main", "tour", "idol"]; if (fromOf(w)) L.push("ville");
  const k = L[Math.floor(((w.id.charCodeAt(0) || 0) + (w.id.charCodeAt(w.id.length - 1) || 0)) % L.length)];
  w.dream = { k: k }; if (k === "idol") { const o = Object.values(G.W).filter(x => x.id !== w.id && x.sx === w.sx && x.pop >= 80 && !x.ret).sort((a, b) => b.pop - a.pop)[Math.floor(rnd() * 5)]; if (o) w.dream.o = o.id; else w.dream.k = "titre"; }
  return w.dream;
}
export const dreamTxt = (G, w) => { const d = dreamOf(G, w); return d ? DREAMS[d.k].replace("{o}", d.o && G.W[d.o] ? G.W[d.o].n : "une légende") : ""; };
function dreamCheck(G, ev, res) {
  if (ev.fed !== G.me || ev.ai) return; const big = ev.id === G.mania, main = res.filter(r => r.it === "m").slice(-1)[0];
  res.filter(r => r.it === "m").forEach(r => idsOf(r).forEach(id => { const w = G.W[id]; if (!w || w.fed !== G.me || (w.dream && w.dream.done)) return; const d = dreamOf(G, w), won = typeof r.win === "number" && (r.sides[r.win] || []).indexOf(id) >= 0;
    const ok = (d.k === "titre" && r.change && won) || (d.k === "main" && big && r === main) || (d.k === "idol" && d.o && idsOf(r).indexOf(d.o) >= 0) || (d.k === "ville" && heroOf(G, w, ev) === 2);
    if (ok) dreamDone(G, w); }));
}
export function dreamDone(G, w) {
  const d = dreamOf(G, w); if (!d || d.done) return; d.done = G.day; bondAdd(w, { a: 10, c: 15, mor: 20 }); xpAdd(G, 20);
  G.scQ = (G.scQ || []).concat({ k: "reve", w: w.id, o: "", until: G.day + 5 });
  news(G, { seg: "coul", f: "nous", t: w.n + " a réalisé son rêve", txt: dreamTxt(G, w) + " : c’est fait. Un moment que " + (w.sx === "f" ? "elle" : "il") + " n’oubliera jamais." });
}

// ---------- house shows (non télévisés, réservés en un geste) ----------
export function houseShow(G, young) {
  const f = meF(G); G.house = G.house || []; const wk = Math.floor(G.day / 7);
  if (G.house.some(h => h.wk === wk)) return { ok: false, txt: "Un house show par semaine, pas plus." };
  const c = CITIES.filter(x => x[3] === (CITIES[f.home || 0] || CITIES[0])[3]), ci = CITIES.indexOf(pick(c.length ? c : CITIES));
  const ev = { id: uid("hs"), fed: G.me, n: "House show · " + CITIES[ci][0], kind: "house", day: G.day, city: ci, items: [], house: true };
  autoCard(G, ev);
  if (young) { const Y = roster(G).filter(w => w.fed === G.me && (w.age <= 26 || w.pop < 40) && !(w.inj && w.inj.until > G.day)).sort((a, b) => a.pop - b.pop); ev.items.filter(it => it.it === "m").slice(0, 3).forEach((it, i) => { const a = Y[i * 2], b = Y[i * 2 + 1]; if (a && b && a.sx === b.sx) it.sides = [[a.id], [b.id]]; }); }
  const R = []; ev.items.filter(it => it.it === "m").slice(0, 5).forEach(it => { it.title = ""; const r = simMatch(G, ev, it, {}); if (r) R.push(r); });
  const W = [...new Set(R.reduce((a, r) => a.concat(idsOf(r)), []))].map(i => G.W[i]).filter(Boolean);
  W.forEach(w => { w.mor = clamp(w.mor + 3); if (w.age <= 26 || w.pop < 40) { const i = 1 + Math.floor(rnd() * 4); w.st[i] = clamp(w.st[i] + 1); } });
  const att = Math.round(Math.min(1500, 250 + Math.pow(f.pop, 1.6) * 2.2) * (0.85 + rnd() * 0.3)), money = Math.round(att * 22 / 1000) - (hasTal(G, "eco") ? 7 : 8);
  f.money += money; G.fin.cur.tix += Math.max(0, money); G.cities = G.cities || {}; G.cities[ci] = (G.cities[ci] || 0) + 1; G.house.push({ wk: wk, d: G.day, city: CITIES[ci][0], att: att, money: money, n: W.length }); cap(G.house, 30);
  const best = R.slice().sort((a, b) => b.r - a.r)[0];
  news(G, { seg: "coul", f: "nous", t: "House show à " + CITIES[ci][0], txt: att + " spectateurs, " + W.length + " catcheurs sur le ring." });
  return { ok: true, txt: "House show à " + CITIES[ci][0] + " : " + att + " spectateurs, " + (money >= 0 ? "+" : "") + fmtK(money) + ". " + W.length + " catcheurs ont tourné" + (young ? ", les jeunes ont pris de l’expérience." : "."), city: CITIES[ci][0], best: best };
}

// ---------- la réunion créative du lundi (idées à garder ou jeter) ----------
export function meetingMake(G) {
  const R = roster(G).filter(w => w.fed === G.me && !w.ret && !(w.inj && w.inj.until > G.day)), C = [];
  const two = (sx) => { const L = R.filter(w => !sx || w.sx === sx).sort(() => rnd() - 0.5); const a = L[0], b = L.find(x => x.id !== (a || {}).id && x.sx === (a || {}).sx && x.al !== a.al) || L[1]; return a && b ? [a, b] : null; };
  const p = two(); if (p) { const ty = pick(Object.keys(STY).filter(k => k !== "classic")); C.push({ k: "sl", ty: ty, a: p[0].id, b: p[1].id, t: STY[ty][0] + " : " + p[0].n + " et " + p[1].n, d: STY[ty][1] }); }
  const up = R.filter(w => w.pop < 55 && w.age <= 30).sort(() => rnd() - 0.5)[0]; if (up) C.push({ k: "push", w: up.id, t: "Mettre " + up.n + " en avant", d: "Plus de victoires et de temps d’antenne pendant quelques semaines." });
  const m = two("f") || two("h"); if (m) C.push({ k: "match", a: m[0].id, b: m[1].id, t: "Au prochain show : " + m[0].n + " contre " + m[1].n, d: "Un match qu’on n’a jamais vu." });
  const h = R.filter(w => w.pop >= 60).sort(() => rnd() - 0.5)[0]; if (h) C.push({ k: "seg", w: h.id, t: "Une grande promo de " + h.n, d: "Au micro en ouverture du prochain show." });
  G.meet = { d: G.day, cards: C.sort(() => rnd() - 0.5), i: 0, kept: 0 };
}
export function meetingPick(G, keep) {
  const M = G.meet; if (!M || M.i >= M.cards.length) return ""; const c = M.cards[M.i++]; if (!keep) return "Idée mise de côté.";
  M.kept++; const nx = G.ev.filter(e => e.fed === G.me && e.kind === "tv" && !e.done && e.day >= G.day).sort((a, b) => a.day - b.day)[0];
  if (c.k === "sl") { G.sl.push(slMake(G, c.ty, c.a, c.b)); return "Histoire lancée (Créatif › Storylines)."; }
  if (c.k === "push") { const w = G.W[c.w]; if (w) { w.push = 1; w.mor = clamp(w.mor + 5); bondAdd(w, { a: 2, c: 2 }); } return "On pousse " + (w ? w.n : "") + "."; }
  const prep = ids => { nx.items = nx.items || []; if (!nx.items.length) autoCard(G, nx); nx.items = nx.items.filter(it => !(it.it === "m" ? idsOf(it) : it.w || []).some(i => ids.indexOf(i) >= 0)); };   // la carte de l'IA d'abord, sans doublon
  if (c.k === "match" && nx) { prep([c.a, c.b]); nx.items.unshift({ it: "m", t: "simple", sides: [[c.a], [c.b]], title: "", stip: "", fin: "auto", cons: "", dur: "moyen", win: "ia", spots: [] }); return "Match ajouté à " + nx.n + " (" + shortDate(nx.day) + ")."; }
  if (c.k === "seg" && nx) { prep([c.w]); nx.items.unshift({ it: "s", k: "promo", w: [c.w] }); return "Promo ajoutée en ouverture de " + nx.n + "."; }
  return "Noté.";
}

// ---------- types d'histoires (pas seulement des turns) ----------
export const STY = {
  classic: ["Rivalité", "Deux camps, une rivalité qui monte de semaine en semaine."],
  quest: ["Quête du titre", "Le camp 1 veut la ceinture : à la fin, il obtient son match de titre."],
  alliance: ["Alliance", "Deux catcheurs apprennent à se faire confiance : à la fin, ils forment une équipe."],
  betray: ["Trahison", "Deux amis… jusqu’au coup de poignard. À la fin, le camp 2 change de camp."],
  ret: ["Retour", "Le camp 1 revient et veut sa revanche : sa popularité grimpe."],
  myst: ["Mystère", "Quelqu’un attaque le camp 1 dans l’ombre. À la fin, on découvre qui."],
  revenge: ["Vengeance", "Le camp 1 n’a pas oublié ce que le camp 2 lui a fait."],
  torch: ["Passage de flambeau", "Le vétéran (camp 1) affronte le jeune (camp 2) : la popularité passe au jeune."]
};
export function slMake(G, ty, a, b, n, len) {
  ty = STY[ty] ? ty : "classic"; const A = G.W[a], B = G.W[b];
  const s = { id: uid("s"), fed: G.me, ty: ty, n: n || (ty === "classic" ? A.n + " contre " + B.n : STY[ty][0] + " : " + A.n + (ty === "myst" ? "" : " et " + B.n)), a: [a], b: [b], len: len || 5, wk: 0, heat: ty === "betray" || ty === "revenge" ? 28 : 20, turn: null, done: false, from: G.day };
  if (ty === "betray" && B) s.turn = { w: b, to: B.al === "heel" ? "face" : "heel" };
  if (ty === "myst") s.hid = b;
  return s;
}
export function slEnd(G, s) {
  const A = G.W[s.a[0]], B = G.W[s.b[0]]; if (!A || !B || s.fed !== G.me) return;
  const good = s.heat >= 50;
  if (s.ty === "quest") { const t = Object.values(G.T).find(t => t.fed === G.me && (t.cat || t.div) === A.sx && champIds(t).length); if (t) { G.shots = (G.shots || []).filter(x => x.t !== t.id).concat({ w: A.id, t: t.id, by: "sl", d: G.day }); news(G, { seg: "ecran", f: "nous", t: A.n + " aura son match de titre", txt: "Sa quête touche au but : " + t.n + "." }); } }
  if (s.ty === "alliance") { relAdd(G, A.id, B.id, 40); if (!(G.teams || []).some(t => t.m.indexOf(A.id) >= 0 && t.m.indexOf(B.id) >= 0)) G.teams.push({ id: uid("t"), fed: G.me, n: A.n.split(" ")[0] + " & " + B.n.split(" ")[0], m: [A.id, B.id], chem: good ? 75 : 60 }); }
  if (s.ty === "betray") relAdd(G, A.id, B.id, -60);
  if (s.ty === "ret") A.pop = clamp(A.pop + (good ? 5 : 2), 1, 99);
  if (s.ty === "revenge") { A.mor = clamp(A.mor + 8); relAdd(G, A.id, B.id, -20); }
  if (s.ty === "torch") { B.pop = clamp(B.pop + (good ? 6 : 3), 1, 99); A.pop = clamp(A.pop - 1, 1, 99); relAdd(G, A.id, B.id, 20); }
  if (s.ty === "myst") news(G, { seg: "ecran", f: "nous", t: "Le mystère est levé : c’était " + B.n + " !", txt: "Depuis des semaines, " + B.n + " attaquait " + A.n + " dans l’ombre." });
}

// ---------- circuit indé : 3 talents à aller voir, à signer avant la rivale ----------
export function indieMonthly(G) {
  const old = (G.indie || {}).L || []; old.forEach(id => { const w = G.W[id]; if (w && !w.fed && G.riv && G.F[G.riv.id] && rnd() < 0.5) { w.fed = G.riv.id; w.ct = { sal: 40, end: G.day + 365, role: "low" }; news(G, { seg: "coul", f: "transferts", t: G.F[G.riv.id].n + " signe " + w.n, txt: "La rivale a été plus rapide sur le circuit indépendant." }); } });
  const L = [0, 1, 2].map(i => { const w = indie(rnd() < 0.45 ? "f" : "h", G.day); w.pop = clamp(18 + rnd() * 22, 5, 60); w.st = w.st.map((v, j) => clamp(v + (j === 1 ? 8 + rnd() * 12 : rnd() * 6))); w.age = 20 + Math.floor(rnd() * 7); w.fromIndie = 1; G.W[w.id] = w; return w.id; });
  G.indie = { d: G.day, L: L, seen: {} };
  mail(G, { k: "indie", from: "Ton recruteur", role: "Staff", c: "#63d69c", ini: "RE", subj: "3 talents à voir sur le circuit indé", body: "J’ai repéré " + L.map(i => G.W[i].n).join(", ") + ". Va les voir avant la rivale : elle traîne aussi dans ces salles." });
}
export function indieSee(G, id) { const I = G.indie; if (!I || I.L.indexOf(id) < 0 || I.seen[id]) return ""; const f = meF(G); if (f.money < 5) return "Pas assez d’argent."; f.money -= 5; I.seen[id] = 1; G.known = G.known || {}; G.known[id] = G.day + 1; const w = G.W[id]; w.pop = clamp(w.pop + 1, 1, 99); return "Tu as vu " + w.n + " à l’œuvre. Le recruteur a pris des notes (sa fiche)."; }

// ---------- équipes et clans de data/groups.json : liens entre membres ----------
export function groupsLink(G) {
  if (G.grpL) return; G.grpL = 1;
  (G.teams || []).forEach(t => { if (t.m.length === 2 && relGet(G, t.m[0], t.m[1]) < 60) relAdd(G, t.m[0], t.m[1], 60 - relGet(G, t.m[0], t.m[1])); if (t.g) t.chem = Math.max(t.chem || 70, 78); });
  (G.clans || []).forEach(c => { for (let i = 0; i < c.m.length; i++) for (let j = i + 1; j < c.m.length; j++) if (relGet(G, c.m[i], c.m[j]) < 40) relAdd(G, c.m[i], c.m[j], 40 - relGet(G, c.m[i], c.m[j]));
    (G.teams || []).forEach(t => { if (t.fed === c.fed && t.m.every(i => c.m.indexOf(i) >= 0)) t.clan = c.id; }); });
}

// ---------- base commune du modo (data/univers.json : noms et images pour toutes les nouvelles parties) ----------
export const modoBase = () => (udata().uv || {});
export function applyBase(G) {
  const B = modoBase(); Object.keys(B.names || {}).forEach(id => { const w = G.W[id]; if (w) { w.rn0 = w.rn0 || w.n; w.n = B.names[id]; } });
  G.img = G.img || {}; Object.keys(B.img || {}).forEach(k => { if (k.indexOf("w:") === 0 && G.W[k.slice(2)]) G.W[k.slice(2)].pic = B.img[k]; else if (!G.img[k]) G.img[k] = B.img[k]; });
}

// ---------- Butterfly Effect : une décision d'aujourd'hui revient des années plus tard ----------
export function seed(G, k, w, o) { G.bfly = G.bfly || []; if (G.bfly.some(b => b.k === k && b.w === w)) return; G.bfly.push({ k: k, w: w, o: o || "", d: G.day, at: G.day + 240 + Math.floor(rnd() * 600) }); cap(G.bfly, 60); }
export function butterflyMonthly(G) {
  (G.bfly || []).filter(b => !b.done && b.at <= G.day).forEach(b => {
    b.done = G.day; const w = G.W[b.w]; if (!w || w.ret) return; const yrs = Math.max(1, Math.round((G.day - b.d) / 365));
    if (b.k === "fired" && w.fed !== G.me) { w.pop = clamp(w.pop + 8, 1, 99); w.st[1] = clamp(w.st[1] + 5); bondAdd(w, { r: 15 });
      mail(G, { k: "info", from: w.n, role: w.fed ? (G.F[w.fed] || {}).n || "" : "Agent libre", c: "#ff8a7e", ini: "BF", w: w.id, subj: w.n + " n’a pas oublié", body: "Il y a " + yrs + " an" + (yrs > 1 ? "s" : "") + ", tu " + (w.sx === "f" ? "l’as laissée" : "l’as laissé") + " partir. Aujourd’hui " + (w.sx === "f" ? "elle" : "il") + " est devenu" + e_(w) + " une vraie star, et " + (w.sx === "f" ? "elle" : "il") + " le fait savoir partout." });
      buzz(G, { f: "nous", who: w.n, at: "@" + w.n.replace(/\W+/g, "").toLowerCase().slice(0, 14), ini: "BF", c: "#ff8a7e", txt: "On m’a dit que je n’étais pas assez bon. Regardez-moi maintenant. 😏" }); }
    if (b.k === "grudge" && w.fed === G.me) { w.mor = clamp(w.mor - 10);
      mail(G, { k: "info", from: w.n, role: "Catcheur", c: "#ff8a7e", ini: "BF", w: w.id, subj: w.n + " se souvient de ta promesse", body: "Il y a " + yrs + " an" + (yrs > 1 ? "s" : "") + ", tu " + (w.sx === "f" ? "lui" : "lui") + " avais promis quelque chose. " + (w.sx === "f" ? "Elle" : "Il") + " n’a jamais oublié. Au moment de parler contrat, ça va compter." }); bondAdd(w, { c: -8 }); }
    if (b.k === "buried") { const o = w.fed !== G.me && w.fed ? G.F[w.fed] : null; w.pop = clamp(w.pop + 10, 1, 99);
      news(G, { seg: "coul", f: o ? "autres" : "nous", t: w.n + " a explosé", txt: "Le jeune qu’on croyait fini est devenu une tête d’affiche" + (o ? " chez " + o.n : "") + "." }); }
    if (b.k === "leader" && w.fed === G.me) { roster(G).filter(x => x.fed === G.me && relGet(G, x.id, w.id) >= 35).forEach(x => { x.mor = clamp(x.mor - 4); bondAdd(x, { c: -2 }); });
      mail(G, { k: "info", from: "Ton bras droit", role: "Staff", c: "#ffd27a", ini: "BD", subj: "Le vestiaire a de la mémoire", body: "Tu te souviens quand " + w.n + " est venu" + e_(w) + " te parler au nom des autres, et que tu l’as envoyé" + e_(w) + " promener ? Ses amis non plus n’ont pas oublié." }); }
  });
}

// ---------- Ghost of Booking : les vieilles histoires reviennent ----------
export function ghostMonthly(G) {
  if (rnd() > 0.35) return;
  const R = new Set(roster(G).filter(w => w.fed === G.me).map(w => w.id));
  const old = (G.sl || []).filter(s => s.fed === G.me && s.done && s.heat >= 55 && G.day - (s.from + s.len * 7) >= 300 && s.a.concat(s.b).every(i => R.has(i)) && !s.ghost).sort((a, b) => b.heat - a.heat)[0];
  if (old) { old.ghost = G.day; const yrs = Math.max(1, Math.round((G.day - old.from) / 365));
    mail(G, { k: "ghost", from: "Ta directrice créative", role: "Créatif", c: "#c9a7ff", ini: "DC", sl: old.id, w: old.a[0], subj: "Il y a " + yrs + " an" + (yrs > 1 ? "s" : "") + " : « " + old.n + " »", body: "Les fans en parlent encore. " + wn(G, old.a[0]) + " et " + wn(G, old.b[0]) + " sont toujours là… et ils ne se sont jamais vraiment réconciliés. On rallume la mèche ?" }); return; }
  const ex = roster(G).filter(w => w.fed === G.me && (w.hist || []).some(h => /champion/i.test(h.t || "") && G.day - h.d >= 300) && !Object.values(G.T).some(t => champIds(t).indexOf(w.id) >= 0) && !w.ghost)[0];
  if (ex) { ex.ghost = G.day; mail(G, { k: "ghost2", from: "Ta directrice créative", role: "Créatif", c: "#c9a7ff", ini: "DC", w: ex.id, subj: "Et si " + ex.n + " retrouvait sa gloire ?", body: "Ancien" + e_(ex) + " champion" + (ex.sx === "f" ? "ne" : "") + ", " + ex.n + " n’a plus eu sa chance depuis longtemps. Le public adorerait une quête du titre." }); }
}

// ---------- chaque jour / chaque mois ----------
export function extraDaily(G) {
  const t = dateOf(G.day);
  if (t.wd === 1 && !(G.meet && G.meet.d === G.day)) meetingMake(G);
  if (t.dm === 1) { if (G.day > 20) indieMonthly(G); butterflyMonthly(G); ghostMonthly(G); }
  groupsLink(G);
  (G.dev || []).forEach(y => { if (hasTal(G, "coach") && y.prog < 100) y.prog = Math.min(100, y.prog + 0.15); });
}
export function extraAfterShow(G, ev, res) {
  if (ev.fed !== G.me || ev.ai) return;
  xpAdd(G, Math.max(2, ((ev.res && ev.res.r) || 50) / 10) + (ev.id === G.mania ? 20 : 0));
  const ci = ev.city != null ? ev.city : (meF(G).home || 0); G.cities = G.cities || {}; G.cities[ci] = (G.cities[ci] || 0) + 1;
  dreamCheck(G, ev, res);
  (res || []).filter(r => r.it === "m").forEach(r => idsOf(r).forEach(id => { const w = G.W[id]; if (w && w.fed === G.me && w.age <= 25 && (w.lossRun || 0) >= 5 && !w.bfB) { w.bfB = 1; seed(G, "buried", w.id); } }));
}
