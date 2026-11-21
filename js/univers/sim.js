// Mode Univers : le temps qui passe (un jour, « Jour suivant »), les shows des autres fédérations, les contrats qui finissent,
// le début de partie. Le moteur des matchs est dans match.js, la vie du monde dans life.js, les contrats dans deal.js.
import { missionsDaily, rivalMonthly } from "./goals.js";
import { dateOf, dayLabel, shortDate, clamp, rnd, pick, salOf, trainee, fmtK, stars, lastSat } from "./world.js";
import { meF, wOf, wn, roster, avail, injured, risk, teamName, mail, news, buzz, isBig, champIds, ini, e_, cap } from "./base.js";
import { DUR } from "./data.js";
import { SPOTS, heatBetween as hb2, autoCard, runShow, simMatch, nextBig } from "./match.js";
import { lifeDaily, lifeWeekly, lifeMonthly, lifeYearly } from "./life.js";
import { demandOf } from "./deal.js";
import { brandDay, brandMonthly } from "./brand.js";

export { meF, wOf, wn, roster, avail, injured, risk, teamName, mail, news, buzz, DUR, SPOTS, autoCard };
export const playShow = runShow;
export const heatBetween = (G, a, b) => hb2(G, [a, b]);
// ancienne forme d'un match ({ a, b }) : utilisée par quelques écrans
export function playMatch(G, m, ctx) { const r = simMatch(G, { fed: G.me, n: (ctx || {}).ev || "", day: G.day, kind: "tv" }, { it: "m", t: m.kind === "equipe" ? "tag" : "simple", sides: [m.a, m.b], title: m.title || "", dur: m.dur || "moyen", win: m.win === "a" ? 0 : m.win === "b" ? 1 : m.win === "nul" ? "nul" : "ia", spots: m.spots || [], fin: "auto", cons: "", stip: "" }); if (r) r.win = r.win === 0 ? "a" : r.win === 1 ? "b" : "nul"; return r; }

// ---------- shows de la fédération du joueur (14 jours à l'avance) ----------
export const MY_EV_AHEAD = 14;
export function ensureMyEvents(G) {
  const f = meF(G);
  for (let d = G.day; d <= G.day + MY_EV_AHEAD; d++) {
    const wd = dateOf(d).wd;
    f.shows.forEach(s => {
      if (s.wd !== wd || (G.solo && s.n !== G.solo)) return;   // WWE un seul show : les autres shows ont leur GM
      const id = G.me + "-tv-" + d + "-" + s.n;
      if (!G.ev.some(e => e.id === id) && (G.noTv || []).indexOf(id) < 0) G.ev.push({ id: id, fed: G.me, n: s.n, kind: "tv", day: d, items: [], done: false, br: f.split ? s.n : "" });
    });
  }
}
export const myEventToday = G => G.ev.find(e => e.fed === G.me && e.day === G.day && !e.done);
export const nextMyEvents = (G, n) => G.ev.filter(e => e.fed === G.me && e.day >= G.day && !e.done).sort((a, b) => a.day - b.day).slice(0, n || 3);

function aiDay(G) {
  const wd = dateOf(G.day).wd;
  Object.values(G.F).forEach(f => {
    if (f.id === G.me) return;
    f.shows.forEach(s => { if (s.wd === wd) { const ev = { id: f.id + "-" + G.day + s.n, fed: f.id, n: s.n, kind: "tv", day: G.day, br: f.split ? s.n : "" }; autoCard(G, ev); runShow(G, ev); } });
  });
  G.ev.filter(e => e.fed !== G.me && e.day === G.day && !e.done).forEach(e => { autoCard(G, e); runShow(G, e); e.items = []; e.res = { r: e.res.r, aud: e.res.aud }; });
  // on ne garde pas les vieux shows en mémoire (la sauvegarde reste légère)
  if (G.ev.length > 260) G.ev = G.ev.filter(e => !e.done || e.day > G.day - 120 || (e.fed === G.me && isBig(e)));
  G.ev.forEach(e => { if (e.done && e.fed === G.me && e.day < G.day - 21 && e.res && e.res.items && !isBig(e)) e.res.items = e.res.items.map(x => x.it === "m" ? { it: "m", t: x.t, sides: x.sides, win: x.win, r: x.r, fin: x.fin, title: x.title, change: x.change } : { it: "s", k: x.k, w: x.w, r: x.r }); });
}
function dailyBody(G) {
  Object.values(G.W).forEach(w => {
    if (w.ret) return;
    const rest = G.rest && G.rest[w.id] > G.day;
    if (w.last !== G.day) w.en = clamp(w.en + 4 + w.st[4] / 40 + (rest ? 12 : 0) + (injured(G, w) ? 3 : 0));
    w.mor = clamp(w.mor + (w.mor < 60 ? 0.3 : w.mor > 70 ? -0.2 : 0));
    if (w.inj && w.inj.until === G.day && w.fed === G.me) mail(G, { k: "info", from: "Le médecin", role: "Ton staff", c: "#63d69c", ini: "DR", subj: w.n + " est de retour", body: w.n + " est guéri" + e_(w) + " et peut catcher à nouveau.", imp: !!(G.cfg && G.cfg.stopInj) });
    if (w.inj && w.inj.until <= G.day) w.inj = null;
  });
}
function contracts(G) {
  Object.values(G.W).forEach(w => {
    if (!w.fed || !w.ct || w.ret) return;
    if (w.fed === G.me) {
      const key = w.ct.role === "me" || w.mor < 45 || (G.aiCont || {})[w.id];
      if (!key && w.ct.end <= G.day) { w.ct.end = G.day + 365; w.hist.push({ d: G.day, t: "Prolonge d’un an" }); mail(G, { k: "info", from: "Agent de " + w.n, role: "Agent", c: "#63d69c", ini: "AG", subj: w.n + " prolonge d’un an", body: "Content" + e_(w) + " chez toi, " + w.n + " signe un an de plus au même salaire (" + fmtK(w.ct.sal) + " par an).", imp: false }); return; }
      if (key && w.ct.end - G.day === 30) mail(G, { k: "agent", from: "Agent de " + w.n, role: "Agent", c: "#63d69c", ini: "AG", subj: "Le contrat de " + w.n + " finit dans 30 jours", body: "Si tu veux le garder, il faut négocier maintenant.\nSinon il partira le " + dayLabel(w.ct.end) + "." + ((G.aiCont || {})[w.id] ? "\nAttention : " + ((G.F[G.aiCont[w.id]] || {}).n || "une autre fédération") + " l’a contacté." : ""), w: w.id });
      if (w.ct.end <= G.day) { const to = (G.aiCont || {})[w.id]; w.fed = ""; w.ct = null; w.br = ""; news(G, { seg: "coul", f: "transferts", t: w.n + " quitte " + meF(G).n, txt: "Son contrat est terminé : " + w.n + " est maintenant agent libre." }); mail(G, { k: "info", from: w.n, role: "Ancien catcheur", c: "#a3abbd", ini: ini(w.n), subj: "Je pars", body: "Mon contrat est fini. Bonne chance pour la suite.", imp: false }); if (to && G.F[to] && w.pop >= 55) { G.auct = G.auct || {}; G.auct[w.id] = { until: G.day + 5, riv: [{ fed: to, sal: Math.round(demandOf(G, w) * 1.1 / 10) * 10 }] }; } delete (G.aiCont || {})[w.id]; }
      return;
    }
    if (w.ct.end <= G.day) {
      const tamp = (G.cont || {})[w.id];
      if ((w.pop > 45 || rnd() < 0.5) && !(tamp && tamp.int >= 55)) w.ct.end = G.day + 365 + Math.floor(rnd() * 365);
      else {
        const was = w.fed; w.fed = ""; w.ct = null; w.br = ""; news(G, { seg: "coul", f: "transferts", t: w.n + " quitte " + ((G.F[was] || {}).n || ""), txt: w.n + " est maintenant agent libre." + (tamp ? " Il n’a pas voulu prolonger." : "") });
        if ((G.watch || []).indexOf(w.id) >= 0 || tamp) mail(G, { k: "fa", from: "Ton recruteur", role: "Ton staff", c: "#63d69c", ini: "RE", subj: w.n + " est libre !", body: (tamp ? "Ta prise de contact a marché : " : "Tu suivais " + w.n + " : ") + "son contrat est fini. C’est le moment de lui faire une offre.", w: w.id });
        if (w.pop >= 60) { G.auct = G.auct || {}; G.auct[w.id] = { until: G.day + 7, riv: [] }; Object.values(G.F).filter(o => o.id !== G.me && o.id !== was && o.pop >= w.pop - 15 && !(o.onlyF && w.sx !== "f")).slice(0, 2).forEach(o => G.auct[w.id].riv.push({ fed: o.id, sal: Math.round(demandOf(G, w) * (0.95 + rnd() * 0.3) / 10) * 10 })); }
      }
      if (G.cont) delete G.cont[w.id];
    }
  });
  // non-concurrence finie : le catcheur libéré peut signer
  Object.values(G.W).forEach(w => { if (w.nc === G.day && !w.fed && (G.watch || []).indexOf(w.id) >= 0) mail(G, { k: "fa", from: "Ton recruteur", role: "Ton staff", c: "#63d69c", ini: "RE", subj: w.n + " peut signer dès aujourd’hui", body: "Sa clause de non-concurrence est finie.", w: w.id }); });
}
function yearly(G) {
  const y = dateOf(G.day - 1).y, A = awardsOf(G, y);
  G.awards[y] = A;
  news(G, { seg: "ecran", f: "nous", t: "Les awards de l’Année " + y, txt: A.map(a => a.cat + " : " + a.who).join(" · ") });
  mail(G, { k: "info", from: "TCC Awards", role: "Récompenses", c: "#f5b13d", ini: "AW", subj: "Les awards de l’Année " + y, body: A.map(a => a.cat + " : " + a.who).join("\n") });
  A.forEach(a => { if (a.fed === G.me) G.rep = clamp((G.rep || 50) + 2); });
  lifeYearly(G, y);
  Object.values(G.W).forEach(w => { w.car = [w.car[0] + w.rec[0], w.car[1] + w.rec[1], w.car[2] + w.rec[2]]; w.rec = [0, 0, 0]; w.age++; w.p0 = w.pop; w.nm = 0; w.sr = 0; });
  const yy = y + 1; Object.keys(G.F).forEach(k => { const old = G.ev.filter(e => e.fed === k && /-big-/.test(e.id)); const names = old.map(e => e.n).filter((n, i, a) => a.indexOf(n) === i); for (let m = 0; m < 12; m++) G.ev.push({ id: k + "-big-" + yy + "-" + m, fed: k, n: names.length ? names[m % names.length] : "Grand show " + (m + 1), kind: G.F[k].big === "PLE" ? "ple" : "ppv", day: lastSat(yy, m), items: [], done: false }); });
  const mn = G.ev.find(e => e.fed === G.me && e.id === G.me + "-big-" + yy + "-3"); if (mn) G.mania = mn.id;
  G.best = { match: null, show: null };
}
export function awardsOf(G, y) {
  const W = Object.values(G.W).filter(w => !w.ret && w.fed);
  const gain = w => (w.pop - w.p0) + w.rec[0] * 0.8, best = (L, f) => L.slice().sort((a, b) => f(b) - f(a))[0], sc = w => w.pop + (w.rec[0] - w.rec[1]) * 0.4 + (w.nm ? w.sr / w.nm - 60 : 0) * 0.3;
  const men = best(W.filter(w => w.sx === "h"), sc), women = best(W.filter(w => w.sx === "f"), sc), rev = best(W, gain), feud = (G.sl || []).slice().sort((a, b) => b.heat - a.heat)[0];
  const tag = (G.teams || []).filter(t => t.m.every(i => G.W[i])).sort((a, b) => b.chem + avg2(b.m.map(i => G.W[i].pop)) - a.chem - avg2(a.m.map(i => G.W[i].pop)))[0];
  const fn = w => w ? w.n + " (" + ((G.F[w.fed] || {}).n || "libre") + ")" : "—";
  return [
    { cat: "Catcheur de l’année", who: fn(men), fed: men && men.fed }, { cat: "Catcheuse de l’année", who: fn(women), fed: women && women.fed },
    { cat: "Équipe de l’année", who: tag ? tag.n + " (" + ((G.F[tag.fed] || {}).n || "") + ")" : "—", fed: tag && tag.fed },
    { cat: "Match de l’année", who: G.best.match ? G.best.match.txt + " (" + stars(G.best.match.r) + ")" : "—" },
    { cat: "Feud de l’année", who: feud ? feud.n + " (heat " + feud.heat + ")" : "—", fed: feud && feud.fed },
    { cat: "Révélation", who: fn(rev), fed: rev && rev.fed }, { cat: "Show de l’année", who: G.best.show ? G.best.show.txt + " (" + stars(G.best.show.r) + ")" : "—" }
  ];
}
const avg2 = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

// un jour passe
export function stepDay(G) {
  G.day++;
  const t = dateOf(G.day);
  dailyBody(G);
  aiDay(G);
  brandDay(G);
  lifeDaily(G);
  missionsDaily(G);
  contracts(G);
  if (t.wd === 1) lifeWeekly(G);
  if (t.dm === 1) { lifeMonthly(G); rivalMonthly(G); brandMonthly(G); }
  if (t.m === 0 && t.dm === 1 && G.day > 0) yearly(G);
  ensureMyEvents(G);
  const ev = myEventToday(G);
  if (ev && !ev.storm) mail(G, { k: "show", from: "Ton régisseur", role: "Production", c: "#f5b13d", ini: "PR", subj: "Ce soir : " + ev.n, body: "Le show de ce soir t’attend. Prépare la carte, joue-le en direct depuis la Gorilla position, ou laisse l’IA faire.", ev: ev.id, imp: false });
}
// « Jour suivant » (sans écran de chargement : pour les tests et le mode instantané)
export function nextDay(G) {
  const today = myEventToday(G);
  if (today) return { block: today };
  G._new = 0; G._week = false; let n = 0;
  do { stepDay(G); n++; } while (n < 45 && !G._new && !G._week && !myEventToday(G) && !G.over);
  return { days: n };
}
export function startGame(G) {
  ensureMyEvents(G);
  const f = meF(G);
  if (!(G.dev || []).length) G.dev = [trainee(), trainee()];
  const nm = G.ev.filter(e => e.fed === G.me && isBig(e)).sort((a, b) => a.day - b.day); G.mania = (nm[3] || nm[nm.length - 1] || {}).id || "";
  mail(G, { k: "info", from: "Le propriétaire", role: f.n, c: "#f5b13d", ini: "PR", subj: "Bienvenue, " + ((G.gm && G.gm.n && G.gm.n !== "Le GM") ? G.gm.n : "nouveau GM") + " !", body: "Te voilà à la tête de " + f.n + (G.solo ? " (" + G.solo + ")" : "") + ".\nTon but : faire la meilleure audience de l’année" + (G.mode === "sandbox" ? " (mode bac à sable : pas de pression)." : ", et tenir les objectifs de chaque trimestre (Bureau).") + "\n« Jour suivant » fait défiler les jours jusqu’au prochain message ou au prochain show.\nTon premier show : " + ((nextMyEvents(G, 1)[0] || {}).n || "bientôt") + "." });
  if (f.id === "ME") mail(G, { k: "info", from: "Ton recruteur", role: "Ton staff", c: "#63d69c", ini: "RE", subj: "Ton roster de départ", body: "Tu commences avec " + roster(G).length + " agents libres peu connus.\nPlus ta fédération sera célèbre, plus tu pourras signer des stars (Monde › Catcheurs du monde)." });
  news(G, { seg: "coul", f: "nous", t: f.n + " a un nouveau GM", txt: "Les fans attendent de voir ce que ça va donner." });
  G.wMoney = f.money;
}
