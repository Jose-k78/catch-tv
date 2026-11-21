// Mode Univers (21 nov., heure du codage) : la WWE avec un seul show (G.solo = "Raw" | "SmackDown" | "NXT" | "Evolve").
// Les autres shows ont leur GM (l'IA) : ils jouent leurs shows (sans toucher à mon argent ni à mon audience), proposent des échanges,
// appellent des talents de NXT. Le joueur est toujours là pour le draft (soirée du draft en direct, fin avril), peut échanger à tout moment,
// rencontrer les catcheurs des autres shows, faire monter des talents de NXT / Evolve et envoyer ses catcheurs faire une apparition
// (un autre show de la WWE ou une autre fédération).
import { clamp, rnd, pick, dateOf, shortDate, dayLabel, fmtK } from "./world.js";
import { meF, roster, mail, news, buzz, FANS, champIds, isBig, isMine, e_, cap, relAdd } from "./base.js";
import { autoCard, runShow, idsOf } from "./match.js";
import { part, partAdd } from "./deal.js";
import { dnaLike } from "./dna.js";

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const GMN = ["Marc Delorme", "Sam Okafor", "Lena Varga", "Rico Alvarez", "Nina Castel", "Tom Brannigan"];
export const brands = G => G.solo ? meF(G).shows.map(s => s.n) : [];
export const others = G => brands(G).filter(b => b !== G.solo);
export const brandGM = (G, br) => { G.bgm = G.bgm || {}; if (!G.bgm[br]) { const used = Object.values(G.bgm); G.bgm[br] = GMN.find(n => used.indexOf(n) < 0) || pick(GMN); } return G.bgm[br]; };
export const brandRoster = (G, br) => roster(G, G.me).filter(w => w.br === br);
const isChamp = (G, w) => Object.values(G.T).some(t => champIds(t).indexOf(w.id) >= 0);
export const tradeValue = (G, w) => Math.round(w.pop + avg([w.st[1], w.st[3], w.st[5]]) * 0.3 + (w.age <= 30 ? 6 : w.age >= 40 ? -8 : 0) + (isChamp(G, w) ? 15 : 0));

// ---------- chaque jour ----------
export function brandDay(G) {
  if (!G.solo) return;
  const f = meF(G), wd = dateOf(G.day).wd;
  f.shows.forEach(s => { if (s.wd === wd && s.n !== G.solo) { const ev = { id: f.id + "-" + G.day + s.n, fed: f.id, n: s.n, kind: "tv", day: G.day, br: s.n, ai: true }; autoCard(G, ev); runShow(G, ev); } });
  visitsDay(G);
  const t = dateOf(G.day);
  if (t.m === 3 && t.dm === 22 && !(G.draft && G.draft.y === t.y)) draftOpen(G);
  if (G.draft && G.draft.st === "due" && G.day >= G.draft.until) { draftRun(G, true); }
}
// ---------- chaque mois : les GM des autres shows bougent ----------
export function brandMonthly(G) {
  if (!G.solo) return;
  const ob = others(G).filter(b => b !== "Evolve");
  // un GM propose un échange
  if (ob.length && rnd() < 0.4) {
    const br = pick(ob), mineL = roster(G).filter(w => !isChamp(G, w)).sort((a, b) => b.pop - a.pop), theirs = brandRoster(G, br).filter(w => !isChamp(G, w));
    const want = mineL[Math.floor(rnd() * Math.min(6, mineL.length))], give = theirs.filter(w => w.sx === (want || {}).sx).sort((a, b) => Math.abs(tradeValue(G, a) - tradeValue(G, want) - 3) - Math.abs(tradeValue(G, b) - tradeValue(G, want) - 3))[0];
    if (want && give) mail(G, { k: "trade", from: brandGM(G, br), role: "GM de " + br, c: "#6fb3ff", ini: "GM", w: give.id, give: [give.id], get: [want.id], br: br, subj: br + " te propose un échange", body: "Salut. J’ai besoin de " + want.n + " à " + br + ". En échange, je t’envoie " + give.n + " (popularité " + Math.round(give.pop) + "). Marché conclu ?" });
  }
  // Raw et SmackDown appellent un talent de NXT
  const nxt = brandRoster(G, "NXT").filter(w => w.pop >= 58 && !isChamp(G, w)).sort((a, b) => b.pop - a.pop)[0], up = ["Raw", "SmackDown"].filter(b => b !== G.solo && brands(G).indexOf(b) >= 0);
  if (nxt && up.length && rnd() < 0.35) {
    const to = pick(up);
    if (G.solo === "NXT") mail(G, { k: "callup", from: brandGM(G, to), role: "GM de " + to, c: "#6fb3ff", ini: "GM", w: nxt.id, br: to, subj: to + " veut appeler " + nxt.n, body: nxt.n + " est prêt" + e_(nxt) + " pour le roster principal. Tu le laisses monter ? Ça fait plaisir au catcheur… mais tu perds une de tes stars." });
    else { nxt.br = to; nxt.mor = clamp(nxt.mor + 10); news(G, { seg: "coul", f: "autres", t: nxt.n + " monte à " + to, txt: "Le talent de NXT rejoint le roster principal." }); }
  }
  // les autres GM signent un agent libre si leur effectif est trop court
  ob.forEach(br => { if (brandRoster(G, br).length >= 18 || rnd() > 0.5) return; const fa = Object.values(G.W).filter(w => !w.fed && !w.ret && w.pop < 65 && w.age < 40).sort((a, b) => b.pop - a.pop)[0]; if (!fa) return;
    fa.fed = G.me; fa.br = br; fa.ct = { sal: Math.round((30 + fa.pop * 5) / 10) * 10, end: G.day + 365, role: "mid" }; news(G, { seg: "coul", f: "transferts", t: br + " signe " + fa.n, txt: brandGM(G, br) + " renforce son effectif." }); });
}

// ---------- échanger avec un autre show ----------
// give = mes catcheurs, get = les leurs ; réponse du GM de l'autre show
export function tradeAsk(G, give, get) {
  const G1 = give.map(i => G.W[i]).filter(w => isMine(G, w)), G2 = get.map(i => G.W[i]).filter(w => w && w.fed === G.me && w.br && w.br !== G.solo);
  if (!G1.length || !G2.length) return { ok: false, txt: "Choisis qui tu donnes et qui tu veux." };
  const br = G2[0].br; if (G2.some(w => w.br !== br)) return { ok: false, txt: "Un échange se fait avec un seul show à la fois." };
  G.trd = G.trd || {}; if (G.trd[br] && G.day - G.trd[br] < 7) return { ok: false, txt: brandGM(G, br) + " ne veut plus en parler cette semaine. Reviens dans " + (7 - (G.day - G.trd[br])) + " jours." };
  G.trd[br] = G.day;
  const vg = G1.reduce((s, w) => s + tradeValue(G, w), 0), vt = G2.reduce((s, w) => s + tradeValue(G, w), 0), wish = avg(G2.map(w => (w.gml || 0) / 4 + (dnaLike(G, w) ? 2 : 0)));
  const nThem = brandRoster(G, br).length - G2.length + G1.length, nMe = roster(G).length - G1.length + G2.length;
  if (nMe < 8) return { ok: false, txt: "Il te resterait moins de 8 catcheurs." };
  if (nThem < 8) return { ok: false, txt: brandGM(G, br) + " : « Je n’aurais plus assez de catcheurs. »" };
  if (vg + wish >= vt * 1.05) {
    G1.forEach(w => { w.br = br; w.mor = clamp(w.mor - 3); }); G2.forEach(w => { w.br = G.solo; w.mor = clamp(w.mor + 5 + (w.gml || 0) / 5); });
    news(G, { seg: "coul", f: "transferts", t: "Échange entre " + G.solo + " et " + br, txt: G2.map(w => w.n).join(" et ") + " rejoi" + (G2.length > 1 ? "gnent " : "nt ") + G.solo + " ; " + G1.map(w => w.n).join(" et ") + " part" + (G1.length > 1 ? "ent" : "") + " à " + br + "." });
    return { ok: true, txt: brandGM(G, br) + " : « Marché conclu. » " + G2.map(w => w.n).join(" et ") + " arrive" + (G2.length > 1 ? "nt" : "") + " à " + G.solo + "." };
  }
  const gap = vt * 1.05 - vg - wish;
  return { ok: false, txt: brandGM(G, br) + " : « " + (gap > 25 ? "Tu te moques de moi ? C’est bien trop peu." : gap > 10 ? "Pas assez. Ajoute quelqu’un et on en reparle." : "On y est presque… mais non.") + " »" };
}
// ---------- faire monter un talent de NXT / Evolve ----------
export const callUpPool = G => { const from = G.solo === "NXT" ? ["Evolve"] : G.solo === "Evolve" ? [] : ["NXT", "Evolve"]; return roster(G, G.me).filter(w => from.indexOf(w.br) >= 0 && !w.ret && !isChamp(G, w)); };   // les champions restent dans leur show
export function callUp(G, wid) {
  const w = G.W[wid]; if (!w || callUpPool(G).indexOf(w) < 0) return "";
  if (isChamp(G, w)) return brandGM(G, w.br) + " refuse : on ne prend pas un champion de " + w.br + ".";
  G.cu = (G.cu || []).filter(d => G.day - d < 30); if (G.cu.length >= 2) return "Deux montées par mois au plus. Prochaine possible le " + shortDate(G.cu[0] + 30) + ".";
  const from = w.br; G.cu.push(G.day); w.br = G.solo; w.mor = clamp(w.mor + 10); w.pop = clamp(w.pop + 2, 1, 99);
  news(G, { seg: "ecran", f: "nous", t: w.n + " est appelé" + e_(w) + " à " + G.solo + " !", txt: "Le talent de " + from + " fait ses débuts dans le grand bain." });
  buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#6fb3ff", txt: w.n + " à " + G.solo + " !! Enfin !" });
  return w.n + " monte à " + G.solo + ". " + (w.sx === "f" ? "Elle" : "Il") + " est aux anges.";
}
// ---------- rencontrer un catcheur d'un autre show (dans les couloirs) ----------
const MEET = {
  good: ["{n} te serre la main : « Votre show, c’est ce qui se fait de mieux en ce moment. »", "{n} sourit : « Si un jour il y a une place chez vous… je dis ça, je dis rien. »", "{n} discute longtemps avec toi. Le courant passe."],
  mid: ["{n} reste poli : « Bonne chance pour ce soir. »", "{n} t’écoute, hoche la tête, puis file à l’échauffement.", "{n} : « On verra bien ce que l’avenir nous réserve. »"],
  bad: ["{n} te regarde à peine : « J’ai un show à préparer. »", "{n} soupire : « Ici, au moins, on me respecte. »", "{n} ne s’arrête même pas."]
};
export function meet(G, wid) {
  const w = G.W[wid]; if (!w || w.fed !== G.me || !w.br || w.br === G.solo) return null;
  if (w.met && G.day - w.met < 7) return { txt: "Tu l’as déjà croisé" + e_(w) + " cette semaine.", mood: "" };
  w.met = G.day;
  const v = (w.mor < 50 ? 4 : 0) + (dnaLike(G, w) ? 4 : 0) + ((G.rep || 50) - 50) / 8 + (meF(G).pop - w.pop) / 10 + rnd() * 8 - 2;
  w.gml = clamp((w.gml || 0) + Math.max(-3, Math.round(v)), -20, 40);
  const mood = v >= 6 ? "good" : v >= 1 ? "mid" : "bad";
  return { txt: pick(MEET[mood]).replace("{n}", w.n), mood: mood };
}
// ---------- apparitions : un autre show de la WWE ou une autre fédération ----------
export function hosts(G) {
  const L = others(G).map(b => ({ id: "br:" + b, n: b, wd: (meF(G).shows.find(s => s.n === b) || {}).wd }));
  Object.values(G.F).filter(f => f.id !== G.me && f.shows && f.shows.length).forEach(f => L.push({ id: f.id, n: f.n, wd: f.shows[0].wd, fed: true }));
  return L;
}
export function visit(G, wid, hid) {
  const w = G.W[wid], h = hosts(G).find(x => x.id === hid); if (!isMine(G, w) || !h) return "";
  if (w.inj && w.inj.until > G.day) return w.n + " est blessé" + e_(w) + ".";
  if ((G.visits || []).some(v => v.w === wid && v.day >= G.day)) return w.n + " a déjà une apparition prévue.";
  if (h.fed) { const p = part(G, h.id); if (!p.deal && p.rel < -10) return h.n + " refuse : vos relations sont trop mauvaises."; if (!p.deal && rnd() < 0.35 - p.rel / 100) { partAdd(G, h.id, -1); return h.n + " refuse pour cette fois."; } }
  let d = G.day + 1; while (dateOf(d).wd !== h.wd && d < G.day + 8) d++;
  G.visits = (G.visits || []).concat({ w: wid, h: hid, n: h.n, day: d }); cap(G.visits, 40);
  return w.n + " fera une apparition à " + h.n + " le " + dayLabel(d) + ".";
}
export const busyAway = (G, wid, day) => (G.visits || []).some(v => v.w === wid && v.day === day && !v.done);
function visitsDay(G) {
  (G.visits || []).filter(v => v.day === G.day && !v.done).forEach(v => {
    v.done = true; const w = G.W[v.w]; if (!w || w.fed !== G.me) return;
    const fed = v.h.indexOf("br:") !== 0, host = fed ? G.F[v.h] : null, bl = !fed && (G.brands || {})[v.h.slice(3)], aud = fed ? (host ? host.aud0 : 0.5) : bl && bl.last ? bl.last.aud : 1.5;
    const gain = Math.min(4, 1 + aud * 0.8 + rnd()); w.pop = clamp(w.pop + gain, 1, 99); w.mor = clamp(w.mor + 4);
    let fee = 0; if (fed) { fee = Math.round((10 + w.pop * 1.2) / 5) * 5; meF(G).money += fee; G.fin.cur.pub += fee; partAdd(G, v.h, 3); }
    v.gain = Math.round(gain * 10) / 10;
    news(G, { seg: "ecran", f: "nous", t: w.n + " débarque à " + v.n + " !", txt: "Apparition surprise : le public " + (rnd() < 0.5 ? "explose" : "n’en revient pas") + "." + (fee ? " (" + fmtK(fee) + " pour " + meF(G).n + ")" : "") });
    buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#6fb3ff", txt: "QUOI ?! " + w.n + " à " + v.n + " ce soir !!" });
  });
}

// ---------- les grands événements de la WWE réunissent les shows ----------
export function pleMix(G, ev) {
  if (!G.solo || ev.fed !== G.me || ev.ai || ev.mix || !isBig(ev) || ["Raw", "SmackDown"].indexOf(G.solo) < 0) return;
  ev.mix = true; const add = [];
  ["Raw", "SmackDown"].filter(b => b !== G.solo).forEach(br => {
    const tmp = { id: ev.id + "-" + br, fed: ev.fed, n: ev.n, kind: ev.kind, day: ev.day, br: br, ai: true, items: [] }; autoCard(G, tmp);
    const used = new Set((ev.items || []).reduce((a, it) => a.concat(it.it === "m" ? idsOf(it) : it.w || []), []));
    tmp.items.filter(it => it.it === "m" && !idsOf(it).some(i => used.has(i))).sort((a, b) => (b.title ? 1 : 0) - (a.title ? 1 : 0)).slice(0, 2).forEach(it => { it.ai = br; it.win = "ia"; add.push(it); });
  });
  if (!add.length) return; ev.items = ev.items || []; ev.items.splice(Math.max(0, ev.items.length - 1), 0, ...add);
}

// ---------- la soirée du draft (fin avril) ----------
const DRAFT_N = 5;
export function draftOpen(G) {
  const B = brands(G).filter(b => b !== "Evolve"); if (B.length < 2) return;
  G.draft = { y: dateOf(G.day).y, st: "due", until: G.day + 7, order: B, k: 0, picks: [], n: DRAFT_N * B.length };
  mail(G, { k: "draft", from: "La direction de la WWE", role: "WWE", c: "#e8423f", ini: "WW", subj: "Ce soir : la soirée du draft !", body: "Les GM de " + B.join(", ") + " choisissent chacun leur tour (" + DRAFT_N + " tours). Raw et SmackDown peuvent prendre chez les autres shows et chez NXT ; NXT choisit chez Evolve. Les champions et les 2 plus grandes stars de chaque show sont protégés.\nTu as 7 jours avant que ton bras droit choisisse à ta place." });
  news(G, { seg: "ecran", f: "nous", t: "La soirée du draft approche", txt: "Les shows de la WWE vont s’échanger leurs catcheurs." });
}
const prot = (G, br) => { const L = brandRoster(G, br).sort((a, b) => b.pop - a.pop), P = new Set(br === "NXT" || br === "Evolve" ? [] : L.slice(0, 2).map(w => w.id)); L.forEach(w => { if (isChamp(G, w)) P.add(w.id); }); return P; };
export const draftTurn = G => { const D = G.draft; if (!D) return ""; const r = Math.floor(D.k / D.order.length), i = D.k % D.order.length; return (r % 2 ? D.order.slice().reverse() : D.order)[i]; };
export function draftPool(G, br) {
  const D = G.draft, from = br === "NXT" ? ["Evolve"] : D.order.filter(b => b !== br).concat(["NXT"]).filter((b, i, a) => a.indexOf(b) === i && b !== br), P = {};
  from.forEach(b => { P[b] = prot(G, b); });
  const taken = new Set(D.picks.map(p => p.w));
  return roster(G, G.me).filter(w => from.indexOf(w.br) >= 0 && !P[w.br].has(w.id) && !taken.has(w.id) && !w.ret);
}
const pickVal = (G, w, br) => { const R = brandRoster(G, br), f = R.filter(x => x.sx === "f").length, need = f < R.length * 0.35 && w.sx === "f" ? 8 : 0; return w.pop + w.st[1] / 4 + (w.age < 30 ? 5 : w.age > 40 ? -10 : 0) + need + rnd() * 6; };
export function draftPick(G, wid) {
  const D = G.draft, br = draftTurn(G), w = G.W[wid]; if (!D || D.k >= D.n || !w || draftPool(G, br).indexOf(w) < 0) return null;
  const from = w.br; w.br = br; const p = { br: br, w: w.id, from: from, k: D.k }; D.picks.push(p); D.k++;
  // une équipe part ensemble
  const t = (G.teams || []).find(x => x.fed === G.me && x.m.indexOf(w.id) >= 0); if (t) t.m.forEach(i => { const x = G.W[i]; if (x && x.id !== w.id && x.br === from && !isChamp(G, x)) { x.br = br; p.with = x.id; } });
  if (br !== from) w.mor = clamp(w.mor + (br === G.solo ? 6 : 0));
  return p;
}
// un choix de l'IA (pour le show dont c'est le tour)
function aiPickOne(G) { const D = G.draft, br = draftTurn(G), L = draftPool(G, br); if (!L.length) { D.k++; return null; } const best = L.map(w => [w, pickVal(G, w, br)]).sort((a, b) => b[1] - a[1])[0][0]; return draftPick(G, best.id); }
// next : un seul choix d'un autre show ; skip : jusqu'à mon tour ; auto : jusqu'à la fin, mes choix compris (mon bras droit choisit)
export function draftStep(G, how) {
  const D = G.draft; if (!D || D.st === "done") return; D.st = "live"; let n = 0;
  while (D.k < D.n && n++ < 300) { if (how !== "auto" && draftTurn(G) === G.solo) break; aiPickOne(G); if (how === "next") break; }
  if (D.k >= D.n) draftEnd(G);
}
export const draftRun = (G, auto) => draftStep(G, auto ? "auto" : "skip");
export function draftEnd(G) {
  const D = G.draft; if (!D || D.st === "done") return; D.st = "done";
  const mineIn = D.picks.filter(p => p.br === G.solo), mineOut = D.picks.filter(p => p.from === G.solo);
  mail(G, { k: "info", from: "La direction de la WWE", role: "WWE", c: "#e8423f", ini: "WW", subj: "Le draft est terminé", body: "Arrivent à " + G.solo + " : " + (mineIn.map(p => G.W[p.w].n).join(", ") || "personne") + ".\nPartent : " + (mineOut.map(p => G.W[p.w].n + " (" + p.br + ")").join(", ") || "personne") + "." });
  news(G, { seg: "ecran", f: "nous", t: "Draft " + "WWE : le bilan", txt: D.picks.length + " catcheurs ont changé de show." });
}
