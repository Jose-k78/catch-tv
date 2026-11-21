// Mode Univers (21 nov., heure du codage) : l'ADN de la fédération, le mode Mark (le catch comme un vrai sport) et le vocabulaire kayfabe.
// G.dna = { wwe, njpw, aew, lucha, joshi, pure } (100 au total) : le joueur choisit au départ, puis l'ADN bouge avec ce qu'il programme.
// Information cachée : on ne montre jamais les pourcentages, seulement l'ADN principal et la tendance (ce que dit la presse).
// G.mark = true : personne ne choisit le vainqueur, le résultat se joue comme un sport (forme, stats, élan, fatigue, chance).
import { clamp, rnd, pick } from "./world.js";
import { mail, news, champIds } from "./base.js";

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
export const DNA = {
  wwe: { g: "m", n: "Spectacle", ex: "comme la WWE", d: "Les stars, le charisme, les promos et les grandes entrées comptent plus que tout.", c: "#e8423f" },
  njpw: { g: "m", n: "Sport de combat", ex: "comme la NJPW", d: "Des matchs longs et durs, des rivalités qui durent, des tournois prestigieux.", sty: ["bag", "pur"], c: "#f5b13d" },
  aew: { g: "f", n: "Liberté créative", ex: "comme l’AEW", d: "Tous les styles sur la même carte, des matchs techniques et fous.", sty: ["tec", "aer"], c: "#c9a7ff" },
  lucha: { g: "f", n: "Lucha libre", ex: "comme l’AAA et le CMLL", d: "Voltige, vitesse, matchs à six et masques.", sty: ["aer"], c: "#63d69c" },
  joshi: { g: "m", n: "Joshi", ex: "comme Stardom et Marigold", d: "Les catcheuses en tête d’affiche, un rythme rapide et intense.", c: "#ff8ad8" },
  pure: { g: "f", n: "Lutte pure", ex: "comme ROH", d: "Technique, respect de l’adversaire, victoires propres.", sty: ["tec", "pur"], c: "#6fb3ff" }
};
// « le spectacle », « au spectacle » / « la lucha libre », « à la lucha libre »
export const dnaLe = k => (DNA[k].g === "m" ? "le " : "la ") + DNA[k].n.toLowerCase();
export const dnaAu = k => (DNA[k].g === "m" ? "au " : "à la ") + DNA[k].n.toLowerCase();
export const DNA_OF = { WWE: "wwe", TNA: "wwe", AEW: "aew", NJPW: "njpw", AAA: "lucha", CMLL: "lucha", Stardom: "joshi", Marigold: "joshi", ROH: "pure" };
export function dnaInit(G, k) {
  k = DNA[k] ? k : DNA_OF[G.me] || "wwe";
  G.dna = {}; Object.keys(DNA).forEach(x => { G.dna[x] = x === k ? 55 : 9; });
}
export const dnaMain = G => { const d = G.dna || {}; return Object.keys(DNA).sort((a, b) => (d[b] || 0) - (d[a] || 0))[0]; };
// la tendance : l'ADN qui monte derrière le principal (seulement s'il s'approche vraiment)
export const dnaNext = G => { const d = G.dna || {}, L = Object.keys(DNA).sort((a, b) => (d[b] || 0) - (d[a] || 0)); return d[L[1]] >= d[L[0]] - 14 ? L[1] : ""; };
const ofSty = (all, L) => all.filter(w => (L || []).indexOf(w.sty) >= 0).length;
// bonus (ou malus) de note pour un match chez moi, selon mon ADN principal
export function dnaBonus(G, ev, m, all, D) {
  if (!G.dna || ev.fed !== G.me || ev.ai || !all.length) return 0;
  const k = dnaMain(G), s = Math.min(1.3, (G.dna[k] || 55) / 55); let b = 0;
  if (k === "wwe") b = (avg(all.map(w => w.st[5])) + avg(all.map(w => w.st[3])) - 120) / 14 + (m.title ? 1 : 0);
  else if (k === "njpw") b = (D >= 20 ? 3 : D <= 8 ? -2 : 0) + (avg(all.map(w => w.st[1])) - 60) / 12 + Math.min(3, ofSty(all, DNA.njpw.sty));
  else if (k === "aew") b = (new Set(all.map(w => w.sty)).size >= 2 ? 2 : 0) + Math.min(3, (m.spots || []).length * 0.8) + (ofSty(all, DNA.aew.sty) ? 1 : 0);
  else if (k === "lucha") b = Math.min(4.5, ofSty(all, DNA.lucha.sty) * 1.5) + ((m.sides || []).some(x => x.length === 3) ? 2 : 0);
  else if (k === "joshi") b = all.every(w => w.sx === "f") ? 4 : -1;
  else if (k === "pure") b = Math.min(3.6, ofSty(all, DNA.pure.sty) * 1.2) + (m.fin === "clean" || m.fin === "subm" ? 1 : 0);
  return Math.max(-4, Math.min(6, b * s));
}
// après chaque show chez moi : l'ADN bouge un peu selon ce que j'ai programmé
export function dnaShow(G, ev, res) {
  if (!G.dna || ev.fed !== G.me || ev.ai || !res || !res.length) return;
  const inc = {}, add = (k, v) => { inc[k] = (inc[k] || 0) + v; }, sty = new Set();
  res.forEach((r, i) => {
    if (r.it === "s") { add("wwe", 0.5); return; }
    const all = (r.sides || []).reduce((a, s) => a.concat(s), []).map(id => G.W[id]).filter(Boolean); if (!all.length) return;
    all.forEach(w => sty.add(w.sty));
    const main = i === res.length - 1, D = r.dur === "long" || /ironman|falls|marathon/.test(r.t || "") ? 25 : r.dur === "court" ? 6 : 14;
    if (D >= 20) add("njpw", 0.5); if (ofSty(all, ["bag", "pur"]) >= 2) add("njpw", 0.3);
    if (all.every(w => w.sx === "f")) add("joshi", main ? 1 : 0.6);
    if (ofSty(all, ["aer"]) >= 2) add("lucha", 0.5); if ((r.sides || []).some(s => s.length === 3)) add("lucha", 0.4);
    if (ofSty(all, ["tec", "pur"]) >= 2) add("pure", 0.5); if (r.fin === "clean" || r.fin === "subm") add("pure", 0.15); if (r.fin === "cheat" || r.fin === "interf") add("wwe", 0.3);
    if (r.stip || /ladder|tlc|cage|cell|nodq|fca|wargames/.test(r.t || "")) add("aew", 0.4);
    if (r.title || avg(all.map(w => w.pop)) >= 70) add("wwe", 0.3);
  });
  if (sty.size >= 4) add("aew", 0.6);
  const k0 = dnaMain(G);
  Object.keys(inc).forEach(k => { G.dna[k] = (G.dna[k] || 0) + inc[k]; });
  const tot = Object.keys(DNA).reduce((s, k) => s + (G.dna[k] || 0), 0) || 1;
  Object.keys(DNA).forEach(k => { G.dna[k] = Math.round((G.dna[k] || 0) * 1000 / tot) / 10; });
  const k1 = dnaMain(G);
  if (k1 !== k0) {
    mail(G, { k: "info", from: "La presse spécialisée", role: "Magazine", c: DNA[k1].c, ini: "PR", subj: "Ta fédération a changé de visage", body: "Les fans le disent partout : ton show ressemble de plus en plus " + dnaAu(k1) + " (" + DNA[k1].ex + ").\nLes catcheurs de ce style auront plus envie de venir chez toi ; le public attend maintenant ce genre de matchs." });
    news(G, { seg: "coul", f: "nous", t: "Nouvelle identité", txt: "Le show change de style : place " + dnaAu(k1) + "." });
  }
}
// un catcheur aime-t-il ton style ? (négociation et recrutement)
export function dnaLike(G, w) {
  if (!G.dna || !w) return false; const k = dnaMain(G);
  if (k === "joshi") return w.sx === "f";
  if (k === "wwe") return w.st[3] >= 68 || w.st[5] >= 70;
  return (DNA[k].sty || []).indexOf(w.sty) >= 0;
}

// ---------- mode Mark : le vainqueur se joue sur le ring ----------
const form = w => Math.max(-4, Math.min(4, (w.winRun || 0) - (w.lossRun || 0)));
export function sportWinner(G, m, mod, noDraw) {
  const S = (m.sides || []).map(s => s.map(i => G.W[i]).filter(Boolean)), t = m.title && G.T[m.title], ch = t ? champIds(t) : [];
  const sc = S.map(s => s.length ? avg(s.map(w => w.st[1] * 0.4 + w.st[4] * 0.15 + w.st[5] * 0.1 + w.en * 0.25 + (w.mom || 0) / 6 + form(w) * 2 - (w.inj && w.inj.until > G.day ? 15 : 0))) + (s.some(w => ch.indexOf(w.id) >= 0) ? 4 : 0) + rnd() * 45 : -999);
  const r = mod && mod.runin && G.W[mod.runin];
  if (r) S.forEach((s, i) => { if (s.some(w => w.al === r.al)) sc[i] += 10; });
  if (!noDraw && rnd() < (S.length > 2 ? 0 : 0.03)) return "nul";
  return sc.indexOf(Math.max(...sc));
}
// ce que le GM fait à l'écran (sécurité, sanction, relance) change la fin, jamais en désignant le vainqueur
export function markFinish(G, m, mod, win, fin, notes) {
  const S = (m.sides || []).map(s => s.map(i => G.W[i]).filter(Boolean)), name = i => (S[i] || []).map(w => w.n).join(" et ");
  if (mod.sec && (fin === "cheat" || fin === "interf") && !mod.runin) { fin = "clean"; notes.push("La sécurité a empêché toute intervention"); }
  if (mod.sanc && fin === "cheat" && typeof win === "number" && S.length === 2) { notes.push("Disqualification : " + name(win) + " a triché sous les yeux de l’arbitre"); win = 1 - win; fin = "dq"; }
  if (mod.restart && !mod.medic && (win === "nul" || fin === "dq" || fin === "co" || fin === "nc")) { win = sportWinner(G, m, mod, true); fin = "clean"; notes.push("Le GM relance le match : il faut un vainqueur !"); mod.restarted = true; }
  return { win: win, fin: fin };
}

// ---------- vocabulaire kayfabe (mode Mark) : aucun mot « hors écran » dans le texte affiché ----------
const KF = [
  [/\bHeel turn\b/g, "Passe du côté des méchants"], [/\bFace turn\b/g, "Revient du côté des gentils"],
  [/\bstorylines\b/g, "rivalités"], [/\bStorylines\b/g, "Rivalités"], [/\bstoryline\b/g, "rivalité"], [/\bStoryline\b/g, "Rivalité"],
  [/\bheels\b/g, "méchants"], [/\bheel\b/g, "méchant"], [/\bHeels\b/g, "Méchants"], [/\bHeel\b/g, "Méchant"],
  [/(^|[·(\/]\s?|passe |Face et )face(?=$|[\s·),.\/])(?!\s?à)/g, "$1gentil"], [/^Face$/g, "Gentil"], [/Face et méchant/g, "Gentil et méchant"],
  [/\bbotchs\b/g, "ratés"], [/\bbotch\b/g, "raté"], [/\bBotchs?\b/g, "Raté"],
  [/\bgimmicks\b/g, "personnages"], [/\bgimmick\b/g, "personnage"], [/\bGimmicks\b/g, "Personnages"], [/\bGimmick\b/g, "Personnage"],
  [/\bpush\b/g, "mise en avant"], [/\bPush\b/g, "Mise en avant"], [/\bsquash\b/g, "match express"], [/\bSquash\b/g, "Match express"],
  [/\bturns\b/g, "changements de camp"], [/\bturn\b/g, "changement de camp"], [/\bTurn\b/g, "Changement de camp"],
  [/\bGorilla position\b/g, "coulisses"], [/\bla Gorilla\b/g, "les coulisses"], [/\bGorilla\b/g, "Coulisses"],
  [/\bbooker\b/g, "programmer"], [/\bbooké(e?s?)\b/g, "programmé$1"], [/\bbooking\b/g, "programmation"], [/\bBooking\b/g, "Programmation"], [/\bkayfabe\b/gi, ""]
];
export const kfText = t => KF.reduce((s, r) => s.replace(r[0], r[1]), t);
export const kfy = html => String(html).replace(/>([^<>]+)</g, (m, t) => ">" + kfText(t) + "<");
