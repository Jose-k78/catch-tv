// Mode Univers v2 : le business — salles et billets, tournées à l'étranger, diffuseurs et créneaux, licences, banque et investisseur,
// grandir (2e show, marque de développement, streaming, rachat d'une fédération), vidéos de promo, « la route vers… », objectifs du
// propriétaire, réputation du GM, offres d'emploi, changer de fédération, conseils du bras droit.
import { clamp, rnd, pick, uid, dateOf, dayLabel, shortDate, fmtK, fmtM, WDL } from "./world.js";
import { VENUES, TOURS, REGIONS, NETS, LIC, CITIES } from "./data.js";
import { meF, wn, roster, avail, mail, news, buzz, FANS, ach, isBig, champIds, myStaff, staffQ, e_ } from "./base.js";
import { addStaff, makeObj } from "./v2.js";
import { muCount, timeOf, nextBig } from "./match.js";

export function setVenue(G, i) { meF(G).venue = Math.max(0, Math.min(VENUES.length - 1, +i)); }
export function setTix(G, p) { meF(G).tix = Math.max(5, Math.min(250, Math.round(+p || 25))); }
// ---------- tournée à l'étranger ----------
export function planTour(G, reg, weeks) {
  const T = TOURS[reg] && TOURS[reg][0], f = meF(G); if (!T || G.tourA) return "";
  const cost = T[1] * weeks; if (f.money < cost) return "Pas assez d’argent (" + fmtK(cost) + ")";
  f.money -= cost; G.fin.cur.prod += cost;
  const from = G.day + 3, until = from + weeks * 7; G.tourA = { reg: reg, n: T[0], from: from, until: until, w: weeks };
  const cities = CITIES.map((c, i) => [c, i]).filter(x => x[0][3] === reg);
  (G.ev || []).forEach(e => { if (e.fed === G.me && e.day >= from && e.day <= until && cities.length) e.city = pick(cities)[1]; });
  news(G, { seg: "coul", f: "nous", t: f.n + " part en tournée : " + T[0], txt: weeks + " semaine" + (weeks > 1 ? "s" : "") + " de shows, à partir du " + shortDate(from) + "." });
  return "Tournée réservée : " + T[0] + ", " + weeks + " semaine" + (weeks > 1 ? "s" : "") + " (" + fmtK(cost) + "). Tes shows TV de cette période auront lieu là-bas.";
}
// ---------- diffuseurs ----------
export function tvOffers(G) {
  const f = meF(G), base = f.aud0 * 230 * (0.85 + (G.rep || 50) / 200), L = NETS.slice().sort(() => rnd() - 0.5).slice(0, 3);
  return L.map((n, i) => ({ net: n, pay: Math.round(base * (0.85 + rnd() * 0.4) * (i === 0 ? 1.1 : 1)), min: Math.round(f.aud0 * (0.8 + rnd() * 0.15) * 100) / 100, wd: f.shows[0].wd === (i + 1) % 7 ? f.shows[0].wd : pick([1, 2, 3, 4, 5, f.shows[0].wd]), h: pick([20, 20, 21, 22]), len: pick([120, 120, 180]), y: pick([1, 2, 3]) }));
}
export function takeTv(G, o) {
  const f = meF(G); f.tv = { n: o.net, pay: o.pay, min: o.min, end: G.day + o.y * 365 }; f.slot = { h: o.h, len: o.len };
  if (o.wd !== f.shows[0].wd) { f.shows[0].wd = o.wd; G.ev = G.ev.filter(e => !(e.fed === G.me && e.kind === "tv" && !e.done && e.day > G.day && !(e.items || []).length && e.n === f.shows[0].n)); }
  news(G, { seg: "coul", f: "nous", t: f.n + " signe avec " + o.net, txt: "Le show passera le " + WDL[o.wd] + " à " + o.h + " h (" + o.len / 60 + " h)." });
}
// ---------- licences ----------
export function licOk(G, k) { const L = LIC[k], f = meF(G); return L && f.pop >= L[1] && !(G.lic || []).some(x => x.k === k && x.until > G.day); }
export function takeLic(G, k) { if (!licOk(G, k)) return ""; const L = LIC[k], f = meF(G), pay = Math.round(L[2] * (f.pop / 50)); G.lic = (G.lic || []).concat({ k: k, n: L[0], pay: pay, until: G.day + 365 }); news(G, { seg: "coul", f: "nous", t: L[0] + " " + f.n, txt: "Un accord de licence d’un an est signé." }); return "Licence signée : " + L[0] + ", " + fmtK(pay) + " par mois pendant un an."; }
// ---------- banque ----------
export function borrow(G, amt) { if (G.loan) return "Tu as déjà un prêt en cours"; const f = meF(G), tot = Math.round(amt * 1.08); G.loan = { amt: amt, left: tot, mo: Math.round(tot / 12) }; f.money += amt; return "Prêt de " + fmtK(amt) + " : " + fmtK(G.loan.mo) + " remboursés chaque mois pendant un an."; }
export function investor(G) { const f = meF(G); if (f.inv) return "Tu as déjà un investisseur"; f.inv = 0.05; f.money += 2000; return "Un investisseur met 2 M$ : il prendra 5 % de tes recettes chaque mois."; }
// ---------- grandir ----------
export const EXP = { show2: ["Un 2e show chaque semaine", 500, 40], dev: ["Une marque de développement", 300, 30], stream: ["Ta plateforme de streaming", 2000, 50] };
export function expand(G, k, o) {
  const f = meF(G), E = EXP[k]; if (!E || (f.exp || {})[k]) return ""; if (f.pop < E[2]) return "Il faut une popularité de " + E[2] + "."; if (f.money < E[1]) return "Pas assez d’argent (" + fmtK(E[1]) + ")";
  f.money -= E[1]; G.fin.cur.prod += E[1]; f.exp = f.exp || {}; f.exp[k] = true;
  if (k === "show2") { const used = f.shows.map(s => s.wd), wd = o && o.wd != null ? +o.wd : [5, 3, 4, 2, 6].find(d => used.indexOf(d) < 0); f.shows.push({ n: (o && o.n) || f.sh + " Rampage", wd: wd }); }
  if (k === "stream") f.exp.subs = 8000 + f.pop * 300;
  news(G, { seg: "coul", f: "nous", t: f.n + " grandit", txt: E[0] + " !" });
  return E[0] + " : c’est fait !";
}
export const buyPrice = (G, fid) => { const o = G.F[fid]; if (!o) return 0; return Math.round((Math.max(0, o.money) * 0.4 + roster(G, fid).reduce((s, w) => s + (w.ct ? w.ct.sal : 0), 0) * 0.5 + 1500) / 50) * 50; };
export function buyFed(G, fid) {
  const f = meF(G), o = G.F[fid]; if (!o || fid === G.me) return ""; if (o.pop > f.pop - 10) return o.n + " est trop forte pour être rachetée.";
  const price = buyPrice(G, fid); if (f.money < price) return "Pas assez d’argent (" + fmtK(price) + ")";
  f.money -= price; G.fin.cur.prod += price;
  roster(G, fid).forEach(w => { if (w.fed === fid) { w.fed = G.me; w.hist.push({ d: G.day, t: "Arrive avec le rachat de " + o.n }); } });
  Object.values(G.T).forEach(t => { if (t.fed === fid) { t.fed = G.me; t.n = t.n.indexOf(o.n) >= 0 ? t.n : t.n + " (" + o.sh + ")"; } });
  (G.teams || []).concat(G.clans || []).forEach(t => { if (t.fed === fid) t.fed = G.me; });
  G.ev = G.ev.filter(e => e.fed !== fid); (G.trad || []).forEach(x => { if (x.fed === fid) x.fed = G.me; });
  delete G.F[fid]; f.pop = clamp(f.pop + 4, 5, 99); ach(G, "buy");
  news(G, { seg: "coul", f: "nous", t: f.n + " rachète " + o.n + " !", txt: "Ses catcheurs et ses titres rejoignent " + f.n + "." });
  return o.n + " est à toi : ses catcheurs, ses titres et ses traditions te rejoignent.";
}
export function promoVideo(G, evId) { const ev = (G.ev || []).find(e => e.id === evId), f = meF(G); if (!ev || (ev.promo || 0) >= 3) return ""; if (f.money < 20) return "Pas assez d’argent"; f.money -= 20; G.fin.cur.prod += 20; ev.promo = (ev.promo || 0) + 1; G.hype[ev.id] = clamp((G.hype[ev.id] || 3) + 1, 0, 10); return "Vidéo de promo diffusée : la hype monte (" + ev.promo + "/3)."; }
export const mania = G => (G.ev || []).find(e => e.id === G.mania && !e.done) || null;

// ---------- objectifs du propriétaire, réputation, offres d'emploi ----------
export function quarterEval(G) {
  const f = meF(G), o = G.obj; if (!o || G.mode === "sandbox") return;
  const from = G.day - 91, shows = (G.ev || []).filter(e => e.fed === G.me && e.done && e.day >= from && e.res);
  const tv = shows.filter(e => e.kind === "tv"), audA = tv.length ? tv.reduce((s, e) => s + e.res.aud, 0) / tv.length : 0, rA = shows.length ? shows.reduce((s, e) => s + e.res.r, 0) / shows.length : 0;
  const k = G.diff === "facile" ? 0.7 : G.diff === "difficile" ? 1.3 : 1, lines = []; let d = 0;
  o.goals.forEach(g => { const v = g.k === "aud" ? audA : g.k === "money" ? f.money : rA, ok = v >= g.v; d += ok ? 8 : -12 * k; lines.push((ok ? "✓ " : "✗ ") + (g.k === "aud" ? "Audience moyenne " + fmtM(v) + " (objectif " + fmtM(g.v) + ")" : g.k === "money" ? "En banque " + fmtK(v) + " (objectif " + fmtK(g.v) + ")" : "Note moyenne " + Math.round(v) + " (objectif " + g.v + ")")); });
  o.sec = clamp((o.sec || 70) + d); G.rep = clamp((G.rep || 50) + d / 4);
  if (o.sec <= 0 && G.mode !== "sandbox") { G.over = { k: "fired", d: G.day }; mail(G, { k: "fired", from: "Le propriétaire", role: f.n, c: "#ff6b5e", ini: "PR", subj: "Tu es viré.", body: "Les résultats ne sont pas là.\n" + lines.join("\n") + "\nMerci pour ton travail. " + (G.rep >= 35 ? "D’autres fédérations pourraient te contacter." : "") }); jobOffers(G, true); return; }
  mail(G, { k: "info", from: "Le propriétaire", role: f.n, c: "#f5b13d", ini: "PR", subj: "Bilan du trimestre : " + (d >= 0 ? "bon travail" : "il faut faire mieux"), body: lines.join("\n") + "\nConfiance du propriétaire : " + o.sec + " / 100." });
  G.obj = makeObj(G, o.q + 1); G.obj.sec = o.sec;
}
export function jobOffers(G, force) {
  if (G.mode === "sandbox") return [];
  const f = meF(G), rep = G.rep || 50, L = Object.values(G.F).filter(o => o.id !== G.me && o.pop <= f.pop + (rep - 40) / 1.5 + 10 && (force || o.pop > f.pop - 10)).sort(() => rnd() - 0.5).slice(0, force ? 3 : 1);
  if (!force && (rep < 60 || rnd() > 0.35)) return [];
  L.forEach(o => mail(G, { k: "job", from: "Le président de " + o.n, role: o.n, c: o.c || "#6fb3ff", ini: o.sh.slice(0, 2), subj: "Deviens le GM de " + o.n + " ?", body: "Ta réputation est arrivée jusqu’à nous (" + Math.round(rep) + "/100).\nNous aimerions que tu prennes la tête de " + o.n + ".", fed: o.id }));
  return L;
}
export function switchFed(G, fid) {
  const old = G.me, o = G.F[fid]; if (!o) return "";
  G.F[old].ai = true; o.ai = false; G.me = fid; G.over = null;
  Object.values(G.staff || {}).forEach(s => { if (s.fed === old && s.w && !(G.W[s.w] || {}).fed) s.w = ""; });
  const need = { comm: 2, prod: 1, writer: 1, coach: 1, med: 1, ref: 2, ann: 1 };
  Object.keys(need).forEach(r => { let have = Object.values(G.staff).filter(s => s.fed === fid && s.role === r).length; while (have < need[r]) { addStaff(G, { role: r, fed: fid, q: clamp(45 + rnd() * 25) }); have++; } });
  G.obj = makeObj(G, (G.obj ? G.obj.q : 0) + 1); G.obj.sec = 70;
  news(G, { seg: "coul", f: "nous", t: "Nouveau GM à " + o.n, txt: "L’ancien GM de " + G.F[old].n + " prend les commandes." });
  mail(G, { k: "info", from: "Le président", role: o.n, c: "#f5b13d", ini: "PR", subj: "Bienvenue à " + o.n, body: "Te voilà à la tête de " + o.n + ". Ton ancienne fédération est maintenant gérée par l’IA." });
  return "Tu es maintenant le GM de " + o.n + ".";
}

// ---------- le bras droit : conseils ----------
export function advise(G, ev) {
  const f = meF(G), R = roster(G), T = [];
  const unused = R.filter(w => G.day - Math.max(w.last, 0) > 21 && avail(G, w) && w.ct && w.ct.role !== "low"); if (unused.length >= 2) T.push([2, unused.length + " catcheurs n’ont pas catché depuis 3 semaines : leur moral baisse (" + unused.slice(0, 3).map(w => w.n).join(", ") + ").", "#/univers/fede/m"]);
  R.filter(w => w.en < 30 && !w.inj).slice(0, 2).forEach(w => T.push([3, w.n + " est épuisé" + e_(w) + " (" + Math.round(w.en) + " %) : un peu de repos évitera une blessure.", "#/univers/c/" + w.id]));
  R.filter(w => w.ct && w.ct.end - G.day <= 30 && w.ct.end > G.day).slice(0, 2).forEach(w => T.push([3, "Le contrat de " + w.n + " finit le " + shortDate(w.ct.end) + ".", "#/univers/nego/" + w.id]));
  (G.sl || []).filter(s => !s.done && s.fed === G.me && !(s.met >= G.day - 7) && s.wk > 0).slice(0, 2).forEach(s => T.push([2, "La storyline « " + s.n + " » refroidit : fais-les se croiser cette semaine.", "#/univers/creatif/sl"]));
  R.filter(w => (w.crowd || 0) >= 75 && !(w.push > 0)).slice(0, 1).forEach(w => T.push([3, "Le public pousse " + w.n + " : tu le suis ?", "#/univers/c/" + w.id]));
  Object.values(G.T).filter(t => t.fed === G.me && champIds(t).length && G.day - Math.max(t.since, t.lastDef || -99) > 30).slice(0, 2).forEach(t => T.push([2, "Le " + t.n + " n’a pas été défendu depuis plus de 30 jours.", "#/univers/creatif/ti"]));
  if (myStaff(G, "comm").length < 1) T.push([3, "Tu n’as pas de commentateur : tes matchs perdent des points à la télé.", "#/univers/fede/staff"]);
  R.filter(w => (w.lossRun || 0) >= 4).slice(0, 1).forEach(w => T.push([2, w.n + " a perdu " + w.lossRun + " fois de suite : il ne fait plus peur.", "#/univers/c/" + w.id]));
  if (f.money < 300) T.push([3, "Ta caisse est presque vide : cherche des sponsors, une licence ou un prêt.", "#/univers/activite/biz"]);
  if (ev && !ev.done) {
    const over = timeOf(G, ev) - (ev.len || (isBig(ev) ? 240 : (f.slot || {}).len || 120)); if (over > 10) T.push([3, "Ton show déborde de " + over + " min : la télé coupera la fin.", ""]); if (over < -40) T.push([1, "Ton show est un peu court : ajoute un match ou un segment.", ""]);
    (ev.items || []).forEach(it => { if (it.it === "m" && it.sides && muCount(G, it.sides) >= 2) T.push([2, "Affiche usée : " + it.sides.map(s => s.map(i => wn(G, i)).join(" et ")).join(" contre ") + " a déjà eu lieu plusieurs fois.", ""]); });
  }
  const nb = nextBig(G); if (nb && nb.day - G.day <= 14 && (G.hype[nb.id] || 3) < 4) T.push([2, nb.n + " arrive (" + dayLabel(nb.day) + ") et la hype est basse : vidéo de promo, storylines, grosse signature…", "#/univers/activite/ev"]);
  return T.sort((a, b) => b[0] - a[0]);
}
export const regName = r => REGIONS[r] || r;
