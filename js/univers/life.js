// Mode Univers v2 : la vie du monde, jour après jour — storylines (aussi celles de l'IA), relations, push du public, demandes des
// catcheurs, âge et progression, mentors, retraites et tournées d'adieu, événements hors du ring, IA (signatures, licenciements, stratégie),
// partenariats, médias, salaires et revenus, objectifs, réputation, Hall of Fame, magazine TCC 100, résumé de la semaine.
import { promiseBroken } from "./vn.js";
import { slEnd } from "./extra.js";
import { rivalWeek } from "./goals.js";
import { clamp, rnd, pick, uid, dateOf, dayLabel, shortDate, fmtK, fmtM, stars, salOf, indie, trainee } from "./world.js";
import { CELEBS, SPONS, MAGN, CITIES, TOURS } from "./data.js";
import { meF, wn, roster, avail, injured, mail, news, buzz, FANS, relGet, relAdd, relsOf, staffQ, myStaff, ach, isBig, champIds, ini, e_, cap, teamName } from "./base.js";
import { gimOf, fitOf } from "./v2.js";
import { demandOf, part } from "./deal.js";
import { quarterEval, jobOffers } from "./biz.js";
import { nextBig } from "./match.js";

const say = (G, w, o) => mail(G, Object.assign({ from: w.n, role: "Catcheu" + (w.sx === "f" ? "se" : "r"), c: "#f5b13d", ini: ini(w.n), w: w.id }, o));

// ---------- chaque jour ----------
export function lifeDaily(G) {
  const f = meF(G);
  // négociations : les autres fédérations montent leurs offres ; à la date limite, la meilleure gagne
  Object.values(G.neg || {}).forEach(N => {
    if (N.done) return; const w = G.W[N.w]; if (!w) { N.done = true; return; }
    if (N.riv.length && rnd() < 0.12) { const r = pick(N.riv); r.sal = Math.round(r.sal * 1.06 / 10) * 10; N.log.push(["riv", (G.F[r.fed] || {}).n + " monte son offre à " + fmtK(r.sal) + "."]); }
    if (N.until < G.day) { N.done = true; if (N.riv.length && (!w.fed || w.fed === G.me)) { const r = N.riv.slice().sort((a, b) => b.sal - a.sal)[0]; signAI(G, w, r.fed, r.sal); if (N.round > 0) mail(G, { k: "info", from: "Agent de " + w.n, role: "Agent", c: "#ff8a7e", ini: "AG", subj: w.n + " signe chez " + (G.F[r.fed] || {}).n, body: "Nous n’avons pas trouvé d’accord à temps. " + w.n + " a choisi " + (G.F[r.fed] || {}).n + " (" + fmtK(r.sal) + " par an).", imp: false }); } }
  });
  Object.keys(G.auct || {}).forEach(id => { const A = G.auct[id], w = G.W[id]; if (!w || w.fed) { delete G.auct[id]; return; } if (A.until < G.day && !(G.neg[id] && !G.neg[id].done)) { const r = A.riv.slice().sort((a, b) => b.sal - a.sal)[0]; if (r) signAI(G, w, r.fed, r.sal); delete G.auct[id]; } });
  // prêts entre fédérations, apparitions passées, tournées d'adieu
  Object.values(G.W).forEach(w => {
    if (w.guest && w.guest.until < G.day) { if (w.guest.inv || w.guest.lend) news(G, { seg: "coul", f: "nous", t: w.n + " rentre chez " + ((G.F[w.fed] || {}).n || "lui"), txt: "Fin du prêt." }); w.guest = null; }
    if (w.farewell && w.farewell.until < G.day && !w.ret) retireW(G, w, true);
  });
  G.appear = (G.appear || []).filter(a => { const e = (G.ev || []).find(x => x.id === a.ev); return e && !e.done; });
  // cérémonie du Hall of Fame la veille du plus grand show ; conférence de presse une semaine avant un grand show
  const nb = nextBig(G), y = dateOf(G.day).y;
  if (nb && nb.day - G.day === 1 && !(G.hofDone || {})[y] && (nb.id === G.mania || dateOf(nb.day).m >= 2) && !G.mail.some(m => m.k === "hof" && dateOf(m.d).y === y)) mail(G, { k: "hof", from: "Hall of Fame", role: f.n, c: "#f5b13d", ini: "HOF", subj: "Cérémonie du Hall of Fame : qui intronises-tu ?", body: "Demain c’est " + nb.n + ". Ce soir, la cérémonie du Hall of Fame.\nChoisis une légende à introniser (Monde › Hall of Fame)." });
  if (nb && nb.day - G.day === 7 && !nb.press) { nb.press = 1; mail(G, { k: "press", from: "Ton attaché de presse", role: "Médias", c: "#6fb3ff", ini: "PR", subj: "Conférence de presse avant " + nb.n, body: "Les journalistes attendent. Quel ton donne-t-on à la conférence ?", ev: nb.id }); }
  // événements hors du ring
  if (rnd() < 0.075) outside(G);
}
function signAI(G, w, fid, sal) {
  if (!G.F[fid]) return; w.fed = fid; w.ct = { sal: sal, end: G.day + 365 + Math.floor(rnd() * 400), role: w.pop > 70 ? "up" : "mid", exc: true, cl: {} }; w.br = fid === "WWE" ? pick(G.F[fid].shows).n : "";
  news(G, { seg: "coul", f: "transferts", t: G.F[fid].n + " signe " + w.n, txt: w.n + " rejoint " + G.F[fid].n + (w.pop > 70 ? " : une belle prise." : ".") });
}
export function retireW(G, w, farewellDone) {
  const was = w.fed; w.ret = true; w.leg = true; w.fed = ""; w.ct = null; w.farewell = null;
  Object.values(G.T).forEach(t => { if (champIds(t).indexOf(w.id) >= 0) { t.champ = t.div === "tag" ? [] : ""; t.since = G.day; } });
  news(G, { seg: "coul", f: was === G.me ? "nous" : "autres", t: w.n + " prend sa retraite", txt: farewellDone ? "Fin de la tournée d’adieu : une page se tourne." : "Après une longue carrière, " + w.n + " raccroche les bottes." });
  if (was === G.me) mail(G, { k: "retrole", from: w.n, role: "Légende", c: "#a3abbd", ini: ini(w.n), subj: "Merci pour tout. Et maintenant ?", body: "Je raccroche les bottes, mais je peux rester dans la maison : coach, producteur, commentateur, GM…", w: w.id });
}

// ---------- événements hors du ring ----------
function outside(G) {
  const f = meF(G), R = roster(G).filter(w => avail(G, w)), w = pick(R.length ? R : [null]);
  const L = [];
  if (w) {
    L.push([3, () => { w.off = G.day + 14 + Math.floor(rnd() * 14); w.pop = clamp(w.pop + 4, 1, 99); mail(G, { k: "info", from: "Agent de " + w.n, role: "Agent", c: "#c9a7ff", ini: "AG", subj: w.n + " tourne dans un film !", body: "Un rôle dans un film d’action : " + w.n + " sera absent" + e_(w) + " jusqu’au " + dayLabel(w.off) + ".\nÀ son retour, sa popularité aura monté." }); news(G, { seg: "coul", f: "nous", t: w.n + " au cinéma", txt: "Un rôle dans un film d’action." }); }]);
    L.push([3, () => { w.pop = clamp(w.pop + 2, 1, 99); buzz(G, { f: "nous", who: w.n, at: "@" + w.n.replace(/\W+/g, "").toLowerCase().slice(0, 14), ini: ini(w.n), c: "#f5b13d", txt: "Merci à l’émission de ce matin, c’était top ! Rendez-vous au prochain show." }); news(G, { seg: "coul", f: "nous", t: w.n + " invité" + e_(w) + " à la télé", txt: "Une émission du matin a reçu " + w.n + "." }); }]);
    L.push([2, () => { w.mor = clamp(w.mor + 15); w.off = G.day + 7; mail(G, { k: "info", from: w.n, role: "Catcheu" + (w.sx === "f" ? "se" : "r"), c: "#63d69c", ini: ini(w.n), subj: "Je me marie !", body: "Je prends une semaine pour mon mariage. Merci boss !", imp: false }); }]);
    L.push([2, () => { w.mor = clamp(w.mor + 10); w.off = G.day + 10; mail(G, { k: "info", from: w.n, role: "Catcheu" + (w.sx === "f" ? "se" : "r"), c: "#63d69c", ini: ini(w.n), subj: "Une naissance dans la famille", body: "Je serai absent" + e_(w) + " une dizaine de jours. Merci de ta compréhension.", imp: false }); }]);
    L.push([1, () => { w.mor = clamp(w.mor - 10); w.off = G.day + 7; mail(G, { k: "info", from: "Le médecin", role: "Ton staff", c: "#a3abbd", ini: "DR", subj: w.n + " traverse un deuil", body: w.n + " a perdu un proche. Une semaine de repos.", imp: false }); }]);
    L.push([2, () => { w.pop = clamp(w.pop + 4, 1, 99); w.crowd = clamp((w.crowd || 40) + 10); buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#6fb3ff", txt: "La vidéo de " + w.n + " fait 10 millions de vues 🔥" }); news(G, { seg: "coul", f: "nous", t: "Vidéo virale pour " + w.n, txt: "Tout le monde en parle." }); }]);
    L.push([2, () => { w.pop = clamp(w.pop - 2, 1, 99); mail(G, { k: "scandal", from: "Ton responsable réseaux sociaux", role: "Ton staff", c: "#ff8a7e", ini: "RS", subj: "Polémique : un post de " + w.n + " choque", body: "Un message de " + w.n + " sur les réseaux fait scandale. Que fais-tu ?", w: w.id }); buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#ff8a7e", txt: "Le post de " + w.n + "… sérieusement ?" }); }]);
    L.push([1, () => { w.off = G.day + 3; mail(G, { k: "info", from: "Ton directeur des tournées", role: "Ton staff", c: "#ffd27a", ini: "DT", subj: w.n + " : valise perdue", body: "La compagnie aérienne a perdu la valise de " + w.n + " (tenue de ring comprise). Retour dans 3 jours.", imp: false }); }]);
    L.push([2, () => { w.off = G.day + 2 + Math.floor(rnd() * 3); mail(G, { k: "info", from: "Ton directeur des tournées", role: "Ton staff", c: "#ffd27a", ini: "DT", subj: w.n + " : problème d’avion", body: "Son vol est annulé : pas là avant le " + dayLabel(w.off) + ".", imp: false }); }]);
    L.push([1, () => { w.off = G.day + 14 + Math.floor(rnd() * 21); mail(G, { k: "info", from: "Ton avocat", role: "Ton staff", c: "#ffd27a", ini: "AV", subj: w.n + " : problème de visa", body: "Ses papiers ne sont pas prêts : " + w.n + " ne peut pas voyager avant le " + dayLabel(w.off) + "." }); }]);
    L.push([1, () => { w.mor = clamp(w.mor - 5); news(G, { seg: "coul", f: "rumeurs", t: "Rumeur : " + w.n + " voudrait partir", txt: "Des sources parlent de tensions avec la direction." }); mail(G, { k: "rumor", from: "Ton bras droit", role: "Ton staff", c: "#c9a7ff", ini: "BD", subj: "Rumeur de départ : " + w.n, body: "Les sites parlent du départ de " + w.n + ". On le rassure ?", w: w.id }); }]);
    L.push([1, () => { w.pop = clamp(w.pop + 1, 1, 99); w.mor = clamp(w.mor + 4); news(G, { seg: "coul", f: "nous", t: w.n + " sort un livre", txt: "Son autobiographie est en librairie." }); }]);
  }
  L.push([1, () => { const ev = (G.ev || []).filter(e => e.fed === G.me && !e.done && e.day > G.day + 1 && e.kind === "tv")[0]; if (ev) { ev.storm = true; mail(G, { k: "storm", from: "Ton régisseur", role: "Production", c: "#ff8a7e", ini: "PR", subj: "Alerte tempête pour " + ev.n + " (" + shortDate(ev.day) + ")", body: "Une grosse tempête est annoncée. On maintient le show (moins de public) ou on l’annule ?", ev: ev.id }); } }]);
  L.push([1, () => { const s = (G.spons || []).filter(x => x.until > G.day)[0]; if (s) { s.until = G.day; mail(G, { k: "info", from: s.n, role: "Sponsor", c: "#ff8a7e", ini: "SP", subj: s.n + " arrête le partenariat", body: "Suite à un changement de stratégie, " + s.n + " arrête son contrat de pub.", imp: false }); } }]);
  L.push([1, () => { const nb = nextBig(G); if (nb && nb.day - G.day > 6) mail(G, { k: "celeb", from: "Agent de " + pick(CELEBS), role: "Célébrité", c: "#c9a7ff", ini: "★", subj: "Une célébrité veut venir à " + nb.n, body: "Une apparition pendant le show ? Prix : 80 k$. Ça ferait parler de vous.", ev: nb.id }); }]);
  L.push([1, () => { const c = pick(CITIES.map((x, i) => [x, i])); const nb = nextBig(G); if (nb && nb.day - G.day > 6) mail(G, { k: "city", from: "La mairie de " + c[0][0], role: "Ville", c: "#63d69c", ini: "V", subj: c[0][0] + " veut accueillir " + nb.n, body: "Nous offrons 150 k$ et une salle pleine si " + nb.n + " a lieu chez nous.", ev: nb.id, city: c[1] }); }]);
  // le monde : une fédération de l'IA en difficulté, ou une nouvelle qui apparaît
  L.push([0.6, () => { const o = Object.values(G.F).filter(x => x.ai && x.money < -3000)[0]; if (o) collapse(G, o.id); }]);
  L.push([0.4, () => { if (Object.keys(G.F).length < 12) newFed(G); }]);
  let tot = L.reduce((s, x) => s + x[0], 0), r = rnd() * tot; for (const x of L) { r -= x[0]; if (r <= 0) { x[1](); break; } }
}
function collapse(G, fid) {
  const o = G.F[fid]; if (!o || fid === G.me) return;
  roster(G, fid).forEach(w => { if (w.fed === fid) { w.fed = ""; w.ct = null; } });
  Object.keys(G.T).forEach(k => { if (G.T[k].fed === fid) delete G.T[k]; }); G.ev = G.ev.filter(e => e.fed !== fid); delete G.F[fid];
  news(G, { seg: "coul", f: "autres", t: o.n + " ferme ses portes", txt: "La fédération fait faillite : tous ses catcheurs deviennent agents libres." });
  mail(G, { k: "info", from: "Ton recruteur", role: "Ton staff", c: "#63d69c", ini: "RE", subj: o.n + " a fermé", body: "Beaucoup de catcheurs sont libres d’un coup : c’est le moment de recruter (Monde › Catcheurs › Libres)." });
}
function newFed(G) {
  const NM = [["Pacific Pro Wrestling", "PPW"], ["Euro Clash Wrestling", "ECW2"], ["Neo Lucha", "NEO"], ["Hard Hits Wrestling", "HHW"], ["Rising Sun Pro", "RSP"], ["Iron City Wrestling", "ICW2"]].filter(x => !G.F[x[1]]);
  const x = pick(NM); if (!x) return;
  const id = x[1]; G.F[id] = { id: id, n: x[0], sh: id, c: pick(["#9fcbff", "#ffd27a", "#a6efc6", "#ff9a90", "#c9a7ff"]), ai: true, pop: 22, aud0: 0.12, money: 1500, shows: [{ n: id + " TV", wd: pick([0, 2, 4, 6]) }], big: "PPV", aud: [], last: null, tv: { n: pick(["Neo Stream", "Planète Catch"]), pay: 30, min: 0.1, end: G.day + 365 }, strat: "jeunes", venue: 1, tix: 20, mixed: false, split: false, reg: { us: 20, eu: 20, jp: 20, mx: 20, au: 20, me: 10 }, home: Math.floor(rnd() * CITIES.length), slot: { h: 21, len: 120 }, exp: {} };
  const fa = Object.values(G.W).filter(w => !w.fed && !w.ret && w.pop < 50 && !(w.nc > G.day)).sort(() => rnd() - 0.5).slice(0, 10);
  fa.forEach(w => { w.fed = id; w.ct = { sal: Math.round(salOf(w) * 0.5 / 10) * 10, end: G.day + 365, role: "mid", exc: true, cl: {} }; });
  for (let i = fa.length; i < 12; i++) { const w = indie(i % 3 === 0 ? "f" : "h", G.day); w.fed = id; w.ct = { sal: 30, end: G.day + 365, role: "mid", exc: true, cl: {} }; G.W[w.id] = w; }
  G.T[id + "-t0"] = { id: id + "-t0", fed: id, n: x[0] + " Championship", div: "h", cat: "h", champ: "", since: G.day, defs: 0, pres: 30, hist: [] };
  news(G, { seg: "coul", f: "autres", t: "Une nouvelle fédération : " + x[0], txt: "Elle lance son show " + id + " TV avec des catcheurs du circuit indépendant." });
}

// ---------- chaque semaine (le lundi) ----------
export function lifeWeekly(G) {
  const f = meF(G), R = roster(G), wk = Math.floor(G.day / 7);
  // storylines (les tiennes et celles de l'IA) : heat, chapitres, fin, changement de camp
  (G.sl || []).forEach(s => {
    if (s.done) return; s.wk++;
    const chap = s.plan && s.plan[s.wk - 1], kinds = s.kinds || [];
    if (chap && kinds.length) { const ok = (segKinds[chap] || [chap]).some(k => kinds.indexOf(k) >= 0); s.heat = clamp(s.heat + (ok ? 8 : -2)); if (ok) s.chOk = (s.chOk || 0) + 1; }
    s.kinds = [];
    if (!(s.met >= G.day - 7)) s.heat = clamp(s.heat - 4);
    if (s.wk >= s.len) {
      s.done = true;
      if (s.turn) { const w = G.W[s.turn.w]; if (w && w.al !== s.turn.to) { w.al = s.turn.to; w.hist.push({ d: G.day, t: (s.turn.to === "heel" ? "Heel" : "Face") + " turn" }); news(G, { seg: "ecran", f: s.fed === G.me ? "nous" : "autres", t: w.n + (s.turn.to === "heel" ? " fait son heel turn !" : " fait son face turn !"), txt: "À la fin de la storyline « " + s.n + " », " + w.n + " change de camp." }); if (s.fed === G.me) ach(G, "turn"); } }
      slEnd(G, s);
      if (s.fed === G.me) mail(G, { k: "info", from: "Ta directrice créative", role: "Créatif", c: "#c9a7ff", ini: "DC", subj: "Fin de la storyline « " + s.n + " »", body: "Heat finale : " + s.heat + "/100." + (s.chOk ? "\nChapitres réussis : " + s.chOk + "." : "") + (s.heat > 60 ? "\nLe public a adoré." : "\nElle n’a pas vraiment pris."), imp: false });
    }
  });
  // l'IA écrit aussi ses storylines
  Object.values(G.F).forEach(o => {
    if (o.id === G.me || (G.sl || []).filter(s => !s.done && s.fed === o.id).length >= 2) return;
    const L = roster(G, o.id).filter(w => avail(G, w)).sort((a, b) => b.pop - a.pop).slice(0, 12), a = pick(L), b = a && pick(L.filter(x => x.id !== a.id && x.sx === a.sx));
    if (a && b) G.sl.push({ id: uid("s"), fed: o.id, n: a.n + " contre " + b.n, a: [a.id], b: [b.id], len: 6 + Math.floor(rnd() * 5), wk: 0, heat: 20, turn: rnd() < 0.2 ? { w: a.id, to: a.al === "face" ? "heel" : "face" } : null, done: false, from: G.day });
  });
  if ((G.sl || []).length > 140) G.sl = G.sl.filter(s => !s.done || s.wk > -1).slice(-120);
  // moral des catcheurs pas utilisés
  const big = R.length > 60 ? 0.5 : 1; R.forEach(w => { if (G.day - Math.max(w.last, 0) > 24 && avail(G, w) && w.ct && w.fed === G.me) w.mor = clamp(w.mor - (w.ct.role === "me" ? 4 : w.ct.role === "up" ? 2 : w.ct.role === "mid" ? 0.7 : 0) * big); });
  // centre de développement (coach, marque de développement)
  const cq = staffQ(G, "coach"), dv = (f.exp || {}).dev ? 1.5 : 1;
  (G.dev || []).forEach(y => { const was = y.prog; y.prog = Math.min(100, y.prog + (2 + y.pot * 1.5 + rnd() * 3) * (1 + cq / 100) * dv); if (was < 100 && y.prog >= 100) mail(G, { k: "young", from: y.coach, role: "Centre de développement", c: "#63d69c", ini: "CO", subj: y.n + " est prêt" + (y.sx === "f" ? "e" : ""), body: y.n + " a fini sa formation. Tu peux l" + (y.sx === "f" ? "a" : "e") + " faire monter dans l’effectif.", y: y.id }); });
  // hype du prochain grand show (et de « la route vers… »)
  const nb = nextBig(G); if (nb) { const heat = (G.sl || []).filter(s => !s.done && s.fed === G.me).reduce((s, x) => s + x.heat, 0); G.hype[nb.id] = clamp((G.hype[nb.id] || 3) + heat / 150 + (f.lastR > 65 ? 0.6 : -0.2) + (nb.id === G.mania ? 0.4 : 0) + (rnd() - 0.4), 0, 10); }
  aiSigning(G);
  // sponsors (le directeur commercial aide)
  const bq = staffQ(G, "biz");
  if (rnd() < 0.14 + bq / 400) { const pay = Math.round((20 + f.pop * 1.8) * (1 + bq / 200) / 5) * 5, min = Math.round(f.aud0 * 0.9 * 100) / 100; mail(G, { k: "sponsor", from: pick(SPONS), role: "Sponsor", c: "#ffd27a", ini: "SP", subj: "Offre de pub : " + pay + " k$ par show", body: "Nous voulons notre logo sur ton ring pendant 6 mois.\n" + pay + " k$ par show, si l’audience reste au-dessus de " + fmtM(min) + ".", pay: pay, min: min }); }
  // promesses ratées
  (G.prom || []).forEach(p => { if (p.st === "cours" && p.until < G.day) { p.st = "ratee"; promiseBroken(G, p); G.rep = clamp((G.rep || 50) - 1); const w = G.W[p.w]; if (w) { w.mor = clamp(w.mor - 20); say(G, w, { k: "info", c: "#ff8a7e", subj: "Tu m’avais promis…", body: "Tu n’as pas tenu ta promesse (" + p.txt.toLowerCase() + "). Je m’en souviendrai.", imp: false }); } } });
  // relations : clans, mentors, amitiés qui créent des tag teams, rivalités qui explosent
  (G.clans || []).forEach(c => c.m.forEach((a, i) => c.m.slice(i + 1).forEach(b => relAdd(G, a, b, 1))));
  Object.keys(G.ment || {}).forEach(y => { const v = G.ment[y], Y = G.W[y], V = G.W[v]; if (!Y || !V || Y.fed !== G.me || V.fed !== G.me) { delete G.ment[y]; return; } relAdd(G, y, v, 3); [1, 2, 3].forEach(i => { Y.st[i] = clamp(Y.st[i] + 0.15 + V.st[i] / 1000); }); V.mor = clamp(V.mor + ((V.pers || []).indexOf("Mentor") >= 0 ? 2 : 0.5)); });
  Object.keys(G.rel || {}).forEach(k => {
    const v = G.rel[k], p = k.split("|"), a = G.W[p[0]], b = G.W[p[1]]; if (!a || !b || a.fed !== b.fed || !a.fed) return;
    if (v >= 90 && !(G.teams || []).some(t => t.m.indexOf(a.id) >= 0 && t.m.indexOf(b.id) >= 0) && (a.sx === b.sx || (G.F[a.fed] || {}).mixed)) {
      const t = { id: uid("t"), fed: a.fed, n: a.n.split(" ")[0] + " & " + b.n.split(" ")[0], m: [a.id, b.id], chem: 80, auto: true }; G.teams.push(t);
      if (a.fed === G.me) { ach(G, "team"); mail(G, { k: "team", from: "Ta directrice créative", role: "Créatif", c: "#c9a7ff", ini: "DC", subj: "Nouvelle équipe : " + a.n + " et " + b.n, body: "Ils sont inséparables : une tag team est née ! Tu peux lui donner un nom.", tm: t.id }); }
    }
    if (v <= -70 && a.fed === G.me && rnd() < 0.2) { G.tens.push({ a: a.id, b: b.id, d: G.day }); cap(G.tens, 12); a.mor = clamp(a.mor - 4); b.mor = clamp(b.mor - 4); mail(G, { k: "conflict", from: "Ton agent de sécurité", role: "Ton staff", c: "#ff8a7e", ini: "SE", subj: "Bagarre en coulisses : " + a.n + " et " + b.n, body: "Ils ne se supportent plus. Que fais-tu ?", a: a.id, b: b.id }); }
  });
  // élan, gimmicks qui s'usent, public
  Object.values(G.W).forEach(w => {
    if (w.ret) return; w.mom = Math.round((w.mom || 0) * 0.85);
    const g = gimOf(w); g.wk = (g.wk || 0) + 1; if (g.wk > 52) g.fresh = Math.max(40, (g.fresh || 100) - (w.pop > 80 ? 0.2 : 0.6));
    w.crowd = clamp((w.crowd || 40) + (w.st[3] - 60) / 40 + (w.mom || 0) / 25 + (rnd() - 0.5) * 2 - (w.push > 0 ? 0 : (w.crowd > 70 ? 0.4 : 0)));
  });
  // le public pousse un catcheur / le public rejette un catcheur poussé
  R.forEach(w => {
    if (w.fed !== G.me) return;
    if ((w.crowd || 0) >= 75 && !(w.push > 0) && w.pop < 72 && !(w.crowdAsk > G.day - 60)) { w.crowdAsk = G.day; mail(G, { k: "crowd", from: "Ton bras droit", role: "Ton staff", c: "#63d69c", ini: "BD", subj: "Le public pousse " + w.n + " !", body: "Les fans scandent son nom à chaque show, son merch part comme des petits pains.\nOn le suit (push) ou on l’ignore ?", w: w.id }); }
    if (w.al === "face" && ((w.ct && w.ct.role === "me") || w.push > 0) && ((w.crowd || 50) < 30 || w.st[3] < 50) && w.pop > 55 && rnd() < 0.06 && !(w.booAsk > G.day - 90)) { w.booAsk = G.day; mail(G, { k: "boo", from: "Ton bras droit", role: "Ton staff", c: "#ff8a7e", ini: "BD", subj: "Le public hue " + w.n, body: "Il devait être le héros, mais le public le rejette. On continue, on le fait passer heel, ou on change son personnage ?", w: w.id }); }
  });
  // demandes des catcheurs, blessés motivés, retraites
  if (R.length && rnd() < 0.35) request(G, pick(R.filter(w => w.fed === G.me && w.mor > 35 && w.pop > 35)));
  R.forEach(w => {
    if (w.fed !== G.me) return;
    if (w.inj && w.inj.until - G.day >= 7 && !w.inj.grave && !w.inj.asked && w.mor >= 60 && (w.pers || []).some(p => p === "Bosseur" || p === "Ambitieux") && rnd() < 0.5) { w.inj.asked = 1; say(G, w, { k: "playhurt", subj: "Je veux catcher, même blessé" + e_(w), body: "Je sais que je suis blessé" + e_(w) + ", mais je ne veux pas rater les shows. Laisse-moi catcher !" }); }
    if (w.age >= 39 && !w.farewell && !w.retAsk && rnd() < 0.015 + (w.inj && w.inj.grave ? 0.05 : 0)) { w.retAsk = G.day; say(G, w, { k: "retire", c: "#a3abbd", subj: "Je pense à la retraite", body: "Mon corps me dit stop. J’aimerais finir en beauté. Une tournée d’adieu ?" }); }
    if (w.mor < 25 && !w.ask && w.ct) { w.ask = true; say(G, w, { k: "askrel", c: "#ff8a7e", subj: "Je veux partir", body: "Ça ne va plus. Je demande à être libéré" + e_(w) + " de mon contrat." }); }
  });
  Object.values(G.W).forEach(w => { if (!w.ret && w.fed && w.fed !== G.me && w.age >= 44 && rnd() < 0.006) retireW(G, w); });
  // les autres fédérations contactent tes catcheurs en fin de contrat
  R.forEach(w => { if (w.fed !== G.me || !w.ct || w.ct.end - G.day > 90 || w.pop < 55 || (G.aiCont || {})[w.id]) return; const o = pick(Object.values(G.F).filter(x => x.id !== G.me && x.pop >= w.pop - 15 && !(x.onlyF && w.sx !== "f"))); if (o && rnd() < (o.strat === "agressif" ? 0.16 : 0.08)) { G.aiCont = G.aiCont || {}; G.aiCont[w.id] = o.id; part(G, o.id).rel -= 3; mail(G, { k: "info", from: "Ton bras droit", role: "Ton staff", c: "#c9a7ff", ini: "BD", subj: "Rumeur : " + o.n + " a contacté " + w.n, body: "Son contrat finit le " + shortDate(w.ct.end) + ". " + o.n + " lui fait les yeux doux : à la négociation, il demandera plus.", w: w.id, imp: false }); } });
  // prêts entre fédérations et partenariats
  Object.values(G.W).forEach(w => { if (w.guest && w.guest.fee) { f.money += w.guest.fee; G.fin.cur[w.guest.fee > 0 ? "pub" : "prod"] += Math.abs(w.guest.fee); } });
  Object.keys(G.part || {}).forEach(k => { const p = G.part[k]; if (!G.F[k]) { delete G.part[k]; return; } if (p.deal) { p.rel = clamp(p.rel + 1, -100, 100); if (p.deal.until < G.day) { p.deal = null; mail(G, { k: "info", from: G.F[k].n, role: "Partenaire", c: "#6fb3ff", ini: G.F[k].sh.slice(0, 2), subj: "Fin du partenariat avec " + G.F[k].n, body: "Notre accord d’un an est terminé. On peut en signer un nouveau (Activité › Partenaires).", imp: false }); } } });
  if (rnd() < 0.04) { const o = pick(Object.values(G.F).filter(x => x.id !== G.me && !(part(G, x.id).deal) && part(G, x.id).rel >= 20)); if (o) mail(G, { k: "partoffer", from: "Le GM de " + o.n, role: o.n, c: o.c || "#6fb3ff", ini: o.sh.slice(0, 2), subj: o.n + " propose un partenariat", body: "Un accord d’un an : échanger des catcheurs, des shows communs… Intéressé ?", fed: o.id }); }
  // fuites (signatures secrètes) et médias
  Object.values(G.W).forEach(w => { if (w.secret && !w.leak && rnd() < 0.1) { w.leak = true; news(G, { seg: "coul", f: "rumeurs", t: "Fuite : " + w.n + " aurait signé avec " + f.n, txt: "Plusieurs sites l’affirment. La surprise est un peu gâchée." }); } });
  if (rnd() < 0.15) { const w = pick(R.length && rnd() < 0.6 ? R : Object.values(G.W).filter(x => x.fed && !x.ret && x.pop > 50)); if (w) podcast(G, w); }
  // titres : prestige qui baisse sans défense
  Object.values(G.T).forEach(t => { if (!champIds(t).length) t.pres = clamp((t.pres || 50) - 0.5); else if (G.day - Math.max(t.since, t.lastDef || -99) > 30) t.pres = clamp((t.pres || 50) - 1); });
  // tournée à l'étranger
  if (G.tourA && G.day >= G.tourA.from) {
    if (G.day <= G.tourA.until) { const T = G.tourA, inc = Math.round((TOURS[T.reg] ? TOURS[T.reg][0][1] : 150) * 1.15 * (0.6 + (f.reg[T.reg] || 20) / 100)); f.money += inc; G.fin.cur.tix += inc; f.reg[T.reg] = clamp((f.reg[T.reg] || 20) + 3); R.forEach(w => { if (avail(G, w)) { w.en = clamp(w.en - 6); w.pop = clamp(w.pop + 0.3, 1, 99); } }); }
    else { ach(G, "abroad"); news(G, { seg: "coul", f: "nous", t: "Fin de la tournée : " + G.tourA.n, txt: "Popularité de " + f.n + " là-bas : " + f.reg[G.tourA.reg] + "/100." }); G.tourA = null; }
  }
  // résumé de la semaine
  const prevWk = wk - 1, A = (G.wk || {})[prevWk] || {}, L = Object.keys(A).sort((x, y) => A[y] - A[x]);
  const bm = (G.topM || []).filter(m => m.fed === G.me && m.d >= G.day - 7).sort((a, b) => b.r - a.r)[0] || (G.ev || []).filter(e => e.fed === G.me && e.done && e.day >= G.day - 7 && e.res && e.res.items).reduce((b, e) => b.concat(e.res.items.filter(x => x.it === "m").map(x => ({ r: x.r, txt: x.sides.map(s => s.map(i => wn(G, i)).join(" et ")).join(" contre "), ev: e.n }))), []).sort((a, b) => b.r - a.r)[0];
  G.weeks.push({ w: prevWk, d: G.day - 1, aud: A[G.me] || 0, rank: L.indexOf(G.me) + 1, of: L.length, lead: L[0] || "", best: bm ? { r: bm.r, txt: bm.txt, ev: bm.ev } : null, money: f.money - (G.wMoney == null ? f.money : G.wMoney), news: G.news.filter(n => n.d >= G.day - 7 && n.f === "nous").slice(-3).map(n => n.t) });
  const war = rivalWeek(G, prevWk); if (war) G.weeks[G.weeks.length - 1].war = { won: war.won, me: war.me, them: war.them, n: (G.F[G.riv.id] || {}).n || "" };
  cap(G.weeks, 60); G.wMoney = f.money; if (L[0] === G.me && L.length > 3) ach(G, "top");
  if (G.cfg && G.cfg.stopWk && A[G.me]) G._week = true;
}
const segKinds = { attack: ["attack", "ambush"], promo: ["promo", "bsint"], face: ["face"], contract: ["contract"], brawl: ["brawl"], match: ["match"], betray: ["betray"] };
function request(G, w) {
  if (!w) return; const R = roster(G).filter(x => x.id !== w.id && x.sx === w.sx && avail(G, x)), friend = relsOf(G, w.id).find(r => r.v >= 50 && G.W[r.id] && G.W[r.id].fed === G.me), rival = relsOf(G, w.id).reverse().find(r => r.v <= -30 && G.W[r.id] && G.W[r.id].fed === G.me);
  const L = [];
  if (rival || R.length) { const o = rival ? G.W[rival.id] : pick(R.sort((a, b) => b.pop - a.pop).slice(0, 5)); if (o) L.push(["vs", "Je veux affronter " + o.n, "Donne-moi " + o.n + ". Je vais lui montrer qui je suis.", o.id]); }
  L.push(["turn", w.al === "face" ? "Je veux passer heel" : "Je veux passer face", w.al === "face" ? "J’en ai assez d’être le gentil. Laisse-moi montrer mon côté sombre." : "Le public m’aime de plus en plus. Laisse-moi devenir un héros.", ""]);
  if (friend && !(G.teams || []).some(t => t.m.indexOf(w.id) >= 0)) L.push(["partner", "Je veux faire équipe avec " + wn(G, friend.id), "On s’entend super bien avec " + wn(G, friend.id) + ". Fais-nous faire équipe !", friend.id]);
  if (G.day - Math.max(w.last, 0) > 14) L.push(["more", "Je veux catcher plus", "Ça fait longtemps que je n’ai pas catché. Mets-moi sur la carte !", ""]);
  if (w.en < 45) L.push(["rest", "J’ai besoin de repos", "Je suis à bout. Une semaine de repos, s’il te plaît.", ""]);
  const x = pick(L); if (!x) return;
  say(G, w, { k: "req", rq: x[0], o: x[3], subj: x[1], body: x[2] });
}
function podcast(G, w) {
  const mine = w.fed === G.me, f = meF(G);
  if (mine && w.mor < 45) { G.rep = clamp((G.rep || 50) - 1); roster(G).forEach(x => { x.mor = clamp(x.mor - 0.5); }); news(G, { seg: "coul", f: "nous", t: w.n + " critique la direction dans un podcast", txt: "« On ne me donne aucune chance ici. » Ambiance tendue en coulisses." }); buzz(G, { f: "fans", who: "Fan de catch", at: pick(FANS), ini: "FA", c: "#ff8a7e", txt: "Le podcast de " + w.n + "… il règle ses comptes avec " + f.n + " !" }); }
  else if (mine && w.mor >= 70) { G.rep = clamp((G.rep || 50) + 0.5); news(G, { seg: "coul", f: "nous", t: w.n + " : « Je suis heureux" + e_(w) + " chez " + f.n + " »", txt: "Dans un podcast, " + w.n + " dit du bien de la direction." }); }
  else news(G, { seg: "coul", f: "rumeurs", t: w.n + " parle de son avenir dans un podcast", txt: "« On verra ce que l’avenir me réserve. »" });
}
function aiSigning(G) {
  Object.values(G.F).forEach(f => {
    if (f.id === G.me) return; const p = { stars: 0.35, jeunes: 0.3, econome: 0.15, agressif: 0.35 }[f.strat] || 0.25; if (rnd() > p) return;
    let fa = Object.values(G.W).filter(w => !w.fed && !w.ret && !(w.nc > G.day) && w.age < 46 && w.pop <= f.pop + 10 && (!f.onlyF || w.sx === "f") && !(G.neg[w.id] && !G.neg[w.id].done) && !(G.auct || {})[w.id]);
    if (f.strat === "jeunes") fa = fa.filter(w => w.age <= 28 || w.pot >= 3); fa.sort((a, b) => b.pop - a.pop);
    const w = fa[Math.floor(rnd() * Math.min(f.strat === "stars" ? 2 : 5, fa.length))]; if (!w) return;
    if (w.pop >= 60) { G.auct = G.auct || {}; if (!G.auct[w.id]) { G.auct[w.id] = { until: G.day + 7, riv: [{ fed: f.id, sal: Math.round(demandOf(G, w) * (0.95 + rnd() * 0.3) / 10) * 10 }] }; news(G, { seg: "coul", f: "rumeurs", t: "Enchères pour " + w.n, txt: f.n + " lui a fait une offre. D’autres fédérations pourraient suivre." }); } else G.auct[w.id].riv.push({ fed: f.id, sal: Math.round(demandOf(G, w) * (0.95 + rnd() * 0.3) / 10) * 10 }); return; }
    signAI(G, w, f.id, salOf(w));
  });
}

// ---------- chaque mois (le 1er) ----------
export function lifeMonthly(G) {
  const f = meF(G), R = roster(G).filter(w => w.fed === G.me), d = dateOf(G.day - 1);
  const sal = Math.round(R.filter(w => !(w.susp > G.day)).reduce((s, w) => s + (w.ct ? w.ct.sal : 0), 0) / 12), ssal = Math.round(Object.values(G.staff || {}).filter(s => s.fed === G.me).reduce((s, x) => s + x.sal, 0) / 12);
  const sq = staffQ(G, "social"), bq = staffQ(G, "biz");
  let mer = 0; (G.merch || []).forEach(p => { const w = G.W[p.w]; if (!w || w.fed !== G.me) return; const sold = Math.round(Math.pow(w.pop, 1.6) / 6 * (p.type === "Figurine" ? 0.4 : p.type === "Casquette" ? 0.8 : 1) * (30 / Math.max(10, p.price)) * (0.8 + f.pop / 100) * (1 + (w.crowd || 40) / 200) * (1 + (sq + bq) / 400)); p.sold = sold; p.tot = (p.tot || 0) + sold; mer += Math.round(sold * p.price * (w.ct && w.ct.cl && w.ct.cl.merch ? 0.8 : 0.9) / 1000); });
  const lic = (G.lic || []).filter(x => x.until > G.day).reduce((s, x) => s + x.pay, 0); if (lic) f.pop = clamp(f.pop + 0.3, 5, 99);
  let rest = 0; if (G.loan) { const p = Math.min(G.loan.left, G.loan.mo); G.loan.left -= p; rest = p; if (G.loan.left <= 0) { G.loan = null; mail(G, { k: "info", from: "Ta banque", role: "Banque", c: "#63d69c", ini: "BQ", subj: "Prêt remboursé", body: "Ton prêt est entièrement remboursé.", imp: false }); } }
  const cur = G.fin.cur, inv = f.inv ? Math.round((cur.tv + cur.tix + cur.pub + mer + lic) * f.inv) : 0;
  cur.merch += mer + lic; cur.sal += sal + ssal; cur.prod += rest + inv; f.money += mer + lic - sal - ssal - rest - inv;
  if ((f.exp || {}).stream) f.exp.subs = Math.max(2000, Math.round((f.exp.subs || 8000) + (f.pop - 40) * 140 + ((f.lastR || 60) - 60) * 90));
  G.fin.hist.push(Object.assign({ m: d.m, y: d.y }, G.fin.cur)); cap(G.fin.hist, 24); G.fin.cur = { tv: 0, tix: 0, merch: 0, pub: 0, sal: 0, prod: 0 };
  if (f.money < 0) { f.debtM = (f.debtM || 0) + 1; mail(G, { k: "info", from: "Ton comptable", role: "Ton staff", c: "#ff8a7e", ini: "CP", subj: "Attention : plus d’argent", body: "Ton compte est à " + fmtK(f.money) + ". Baisse les salaires, trouve des sponsors, une licence, ou fais un prêt (Activité › Business)." }); } else f.debtM = 0;
  if (f.debtM >= 3 && f.money < -1500 && G.mode !== "sandbox") { G.over = { k: "bankrupt", d: G.day }; mail(G, { k: "fired", from: "Le tribunal de commerce", role: f.n, c: "#ff6b5e", ini: "TC", subj: f.n + " fait faillite", body: "Trois mois dans le rouge : la fédération ferme. Merci d’avoir joué." }); }
  if (G.mode === "sandbox" && f.money < 1000) f.money += 5000;
  // âge, progression, entraînement ciblé
  const cq = staffQ(G, "coach");
  Object.values(G.W).forEach(w => {
    if (w.ret) return; const mine = w.fed === G.me;
    if (w.age < 27) { const g = 0.18 + (w.pot || 1) * 0.05 + (mine ? cq / 600 : 0.05); [1, 2, 3].forEach(i => { if (rnd() < 0.7) w.st[i] = clamp(w.st[i] + g); }); }
    if (w.age >= 35) w.st[4] = clamp(w.st[4] - 0.3, 20); if (w.age >= 38) { w.st[1] = clamp(w.st[1] - 0.15); w.st[0] = clamp(w.st[0] - 0.1); }
    w.st[5] = clamp(w.st[5] + (w.pop - w.st[5]) * 0.05);
    if (mine && w.train >= 0 && w.train <= 6) w.st[w.train] = clamp(w.st[w.train] + 0.5 * (1 + cq / 100));
  });
  // nouveaux talents : circuit indé, jeunes à fort potentiel, candidatures au centre de formation
  ["f", "h"].forEach(sx => { const n = Object.values(G.W).filter(w => !w.fed && !w.ret && w.sx === sx).length; if (n < (sx === "f" ? 6 : 14)) for (let i = 0; i < 2; i++) { const w = indie(sx, G.day); G.W[w.id] = w; news(G, { seg: "coul", f: "transferts", t: "Circuit indépendant : " + w.n, txt: w.n + " cherche une fédération (agent" + (sx === "f" ? "e" : "") + " libre)." }); } });
  if (rnd() < 0.6) { const w = indie(rnd() < 0.5 ? "f" : "h", G.day); w.age = 19 + Math.floor(rnd() * 3); w.pot = 3 + Math.floor(rnd() * 3); w.st = w.st.map((v, i) => i === 4 ? v : clamp(v - 6)); w.hist[0].t = "Jeune espoir du circuit indépendant"; G.W[w.id] = w; news(G, { seg: "coul", f: "transferts", t: "Un jeune espoir : " + w.n, txt: w.age + " ans, gros potentiel. À suivre !" }); }
  if (myStaff(G, "coach").length && (G.dev || []).length < 4 && f.money > 0 && rnd() < 0.4) { const y = trainee(); G.dev.push(y); mail(G, { k: "info", from: y.coach, role: "Centre de développement", c: "#63d69c", ini: "CO", subj: "Candidature spontanée : " + y.n, body: y.n + " (" + y.age + " ans) rejoint ton centre de formation.", imp: false }); }
  // l'IA : argent, licenciements selon sa stratégie
  Object.values(G.F).forEach(o => {
    if (o.id === G.me) return; const ro = roster(G, o.id).filter(w => w.fed === o.id), rs = ro.reduce((s, w) => s + (w.ct ? w.ct.sal : 0), 0) / 12;
    o.money = Math.round(o.money + o.aud0 * 1100 + o.pop * 25 - rs);
    const cap0 = o.id === "WWE" ? 190 : o.pop > 70 ? 110 : 60, cut = (o.money < 0 ? 3 : 0) + (ro.length > cap0 ? 2 : 0) + (o.strat === "econome" ? 1 : 0);
    if (cut && rnd() < 0.6) ro.filter(w => !champIds(Object.values(G.T).find(t => champIds(t).indexOf(w.id) >= 0) || {}).length).sort((a, b) => (a.pop + (G.day - a.last < 30 ? 15 : 0)) - (b.pop + (G.day - b.last < 30 ? 15 : 0))).slice(0, cut).forEach(w => { w.fed = ""; w.ct = null; w.nc = G.day + 90; news(G, { seg: "coul", f: "transferts", t: o.n + " libère " + w.n, txt: w.n + " sera libre de signer ailleurs le " + shortDate(w.nc) + "." }); if ((G.watch || []).indexOf(w.id) >= 0) mail(G, { k: "fa", from: "Ton recruteur", role: "Ton staff", c: "#63d69c", ini: "RE", subj: w.n + " est libéré" + e_(w) + " !", body: "Tu le suivais : il pourra signer le " + dayLabel(w.nc) + ".", w: w.id }); });
  });
  // contrat TV : offres des diffuseurs ; licences qui finissent ; recruteur
  if (f.tv.end - G.day <= 31 && f.tv.end - G.day > 0 && !G.mail.some(m => m.k === "tvoffers" && m.d > G.day - 30)) mail(G, { k: "tvoffers", from: "Ton directeur commercial", role: "Ton staff", c: "#6fb3ff", ini: "DC", subj: "Le contrat TV finit bientôt : 3 diffuseurs font une offre", body: "Notre contrat avec " + f.tv.n + " finit le " + dayLabel(f.tv.end) + ".\nCompare les offres dans Activité › Contrats TV et pub." });
  if (myStaff(G, "scout").length && rnd() < 0.5) { const L = Object.values(G.W).filter(w => !w.fed && !w.ret && !(w.nc > G.day) && w.pop <= f.pop + 15).sort((a, b) => (b.st[1] + b.st[5] + (b.pot || 0) * 6) - (a.st[1] + a.st[5] + (a.pot || 0) * 6)).slice(0, 3); if (L.length) mail(G, { k: "scout", from: "Ton recruteur", role: "Ton staff", c: "#63d69c", ini: "RE", subj: "Rapport du recruteur : 3 talents libres", body: L.map(w => "· " + w.n + " (" + w.age + " ans, ring " + w.st[1] + ", star power " + w.st[5] + ")").join("\n"), imp: false, ids: L.map(w => w.id) }); }
  if (d.m % 3 === 2 && G.day > 30) quarterEval(G);
  jobOffers(G, false);
}

// ---------- chaque année ----------
export function lifeYearly(G, y) {
  // magazine TCC 100
  G.mag = G.mag || {};
  const L = Object.values(G.W).filter(w => !w.ret && w.fed).map(w => ({ w: w.id, n: w.n, fed: w.fed, s: Math.round(w.pop * 0.55 + (w.rec[0] - w.rec[1]) * 0.6 + (w.nm ? w.sr / w.nm : 50) * 0.35 + Object.values(G.T).filter(t => (t.hist || []).some(h => h.w.indexOf(w.id) >= 0 && (h.to == null || h.to > G.day - 365))).length * 6) })).sort((a, b) => b.s - a.s).slice(0, 100);
  G.mag[y] = L;
  const mine = L.slice(0, 10).filter(x => x.fed === G.me).length; G.rep = clamp((G.rep || 50) + mine * 1.5);
  mail(G, { k: "mag", from: MAGN, role: "Magazine", c: "#ffd27a", ini: "100", subj: "Le " + MAGN + " de l’Année " + y + " est sorti", body: "N°1 : " + (L[0] ? L[0].n : "—") + ".\n" + (mine ? mine + " de tes catcheurs sont dans le top 10." : "Aucun de tes catcheurs dans le top 10.") + "\nMonde › Magazine pour le voir.", y: y });
  // Hall of Fame : l'IA intronise une légende si personne ne l'a fait
  if (!(G.hofDone || {})[y]) { const leg = Object.values(G.W).filter(w => w.ret && w.leg && !(G.hof || []).some(h => h.n === w.n)).sort((a, b) => b.pop - a.pop)[0]; if (leg) G.hof.push({ n: leg.n, pic: leg.pic, y: "Année " + y, k: "hof", by: "", wid: leg.id }); }
  if (G.mode !== "sandbox" && !G.over) ach(G, "year");
}
export function hofInduct(G, wid) {
  const w = G.W[wid], y = dateOf(G.day).y; if (!w || (G.hofDone || {})[y]) return "";
  G.hof.push({ n: w.n, pic: w.pic, y: "Année " + y, k: "hof", by: G.me, wid: wid }); G.hofDone[y] = true; ach(G, "hof");
  const nb = nextBig(G); if (nb) G.hype[nb.id] = clamp((G.hype[nb.id] || 3) + 1, 0, 10);
  news(G, { seg: "ecran", f: "nous", t: w.n + " entre au Hall of Fame", txt: "Une cérémonie pleine d’émotion, la veille du grand show." });
  return w.n + " entre au Hall of Fame !";
}
