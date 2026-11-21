// Mode Univers (21 nov., heure du codage) : la vie en coulisses, façon visual novel — scènes avec des choix et des conséquences
// (amitié, confiance, rivalité avec le GM ; jamais de romance), SMS / DM des catcheurs et du staff, informations cachées
// (seuls l'argent, l'audience et la popularité sont des chiffres ; le reste se découvre par le staff, les messages et les événements),
// économie du vestiaire (influence, respect, alliances).
// Lien GM ↔ catcheur (caché) : w.b = { a: amitié, c: confiance, r: rivalité } de -50 à 50 (rivalité 0 à 50).
import { clamp, rnd, pick, uid, shortDate, dateOf } from "./world.js";
import { meF, roster, isMine, relsOf, relGet, champIds, myStaff, wn, e_, cap, mail } from "./base.js";

const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
export const bond = w => (w.b = w.b || { a: 0, c: 0, r: 0 });
export function bondAdd(w, fx) {
  if (!w || !fx) return; const b = bond(w);
  if (fx.a) b.a = clamp(b.a + fx.a, -50, 50); if (fx.c) b.c = clamp(b.c + fx.c, -50, 50); if (fx.r) b.r = clamp(b.r + fx.r, 0, 50);
  if (fx.mor) w.mor = clamp(w.mor + fx.mor); if (fx.pop) w.pop = clamp(w.pop + fx.pop, 1, 99);
}
// effets : sur le ring (note des matchs), à la table des négociations, au recrutement
export const bondPerf = (G, all) => { const L = all.filter(w => w.b && w.fed === G.me); return L.length ? Math.max(-3, Math.min(3, avg(L.map(w => (w.b.a + w.b.c) / 30 - w.b.r / 40)))) : 0; };
export const bondNeg = w => (w.b ? (w.b.a + w.b.c) / 8 - w.b.r / 12 : 0) + (w.gml || 0) / 8;
export const bondWord = w => { const b = w.b || { a: 0, c: 0, r: 0 }; return b.r >= 25 ? "te cherche des ennuis" : b.a + b.c >= 40 ? "te fait entièrement confiance" : b.a + b.c >= 15 ? "t’apprécie" : b.a + b.c <= -25 ? "ne te supporte plus" : b.a + b.c <= -8 ? "se méfie de toi" : "reste neutre avec toi"; };

// ---------- informations cachées ----------
export const grade = v => v >= 85 ? "Exceptionnel" : v >= 72 ? "Très bon" : v >= 60 ? "Bon" : v >= 45 ? "Correct" : "Faible";
export const known = (G, w) => !!w && (isMine(G, w) || w.fed === G.me || w.pop >= 60 || !!(G.known || {})[w.id] || myStaff(G, "scout").some(s => s.q >= 70));
export const enWord = v => v >= 80 ? "En pleine forme" : v >= 60 ? "En forme" : v >= 40 ? "Fatigué" : "Épuisé";
export const relWord = v => v >= 70 ? "Très proches" : v >= 35 ? "Amis" : v >= 10 ? "Bons rapports" : v > -10 ? "Neutres" : v > -40 ? "Tendus" : "Ennemis";
export const qWord = q => q >= 80 ? "excellent" : q >= 65 ? "très bon" : q >= 50 ? "bon" : q >= 35 ? "moyen" : "débutant";
export const repWord = v => v >= 80 ? "Légende du métier" : v >= 65 ? "Très respecté" : v >= 50 ? "Respecté" : v >= 35 ? "En train de faire ses preuves" : "On doute de toi";
const learn = (G, id) => { G.known = G.known || {}; G.known[id] = G.day + 1; };

// ---------- le vestiaire : influence, respect, alliances ----------
export const influence = (G, w) => w.pop * 0.5 + (w.age >= 30 && w.age <= 42 ? 10 : 0) + ((w.pers || []).indexOf("Leader du vestiaire") >= 0 ? 25 : 0) + (Object.values(G.T).some(t => champIds(t).indexOf(w.id) >= 0) ? 10 : 0) + ((G.clans || []).some(c => c.m[0] === w.id) ? 8 : 0);
export function locker(G) {
  const R = roster(G).filter(w => w.fed === G.me && !w.ret), ids = new Set(R.map(w => w.id));
  const leaders = R.slice().sort((a, b) => influence(G, b) - influence(G, a)).slice(0, 3);
  const groups = (G.clans || []).filter(c => c.fed === G.me).map(c => ({ n: c.n, m: c.m.filter(i => ids.has(i)) })).filter(g => g.m.length >= 2);
  const inG = new Set(groups.reduce((a, g) => a.concat(g.m), []));
  // bandes d'amis : catcheurs reliés par une amitié forte (≥ 50)
  const seen = new Set();
  R.forEach(w => { if (seen.has(w.id) || inG.has(w.id)) return; const L = [w.id], q = [w.id]; seen.add(w.id);
    while (q.length) { const x = q.shift(); relsOf(G, x).forEach(r => { if (r.v >= 50 && ids.has(r.id) && !seen.has(r.id) && !inG.has(r.id)) { seen.add(r.id); L.push(r.id); q.push(r.id); } }); }
    if (L.length >= 2) groups.push({ n: "", m: L }); });
  const alone = R.filter(w => !relsOf(G, w.id).some(r => r.v >= 30 && ids.has(r.id)) && !groups.some(g => g.m.indexOf(w.id) >= 0));
  const tens = []; R.forEach(w => relsOf(G, w.id).forEach(r => { if (r.v <= -40 && ids.has(r.id) && w.id < r.id) tens.push([w.id, r.id]); }));
  (G.tens || []).forEach(t => { if (ids.has(t.a) && ids.has(t.b) && !tens.some(x => (x[0] === t.a && x[1] === t.b) || (x[0] === t.b && x[1] === t.a))) tens.push([t.a, t.b]); });
  return { leaders, groups, alone, tens };
}
// chaque lundi : les leaders entraînent leurs amis (dans le bon ou le mauvais sens)
export function lockerWeekly(G) {
  const L = locker(G);
  L.leaders.forEach(l => { const b = bond(l), v = b.a + b.c - b.r; if (Math.abs(v) < 15) return;
    relsOf(G, l.id).filter(r => r.v >= 35 && G.W[r.id] && G.W[r.id].fed === G.me).forEach(r => { const w = G.W[r.id]; w.mor = clamp(w.mor + (v > 0 ? 1 : -2)); if (v < -25) bondAdd(w, { c: -1 }); });
    if (v < -25 && rnd() < 0.5) telAdd(G, { k: "hint", who: "right", n: "Ton bras droit", txt: "Attention : " + l.n + " monte le vestiaire contre toi. Ses amis commencent à le suivre." }); });
}

// ---------- les scènes (visual novel) ----------
// bg : couloir, bureau, vestiaire, parking, cantine, presse ; {n} = le catcheur, {o} = l'autre, {e} = accord (e / rien), {il} / {Il}
const F = (G, s, w, o) => s.replace(/\{n\}/g, w ? w.n : "").replace(/\{o\}/g, o ? o.n : "").replace(/\{e\}/g, w && w.sx === "f" ? "e" : "").replace(/\{il\}/g, w && w.sx === "f" ? "elle" : "il").replace(/\{Il\}/g, w && w.sx === "f" ? "Elle" : "Il");
const champ = (G, w) => Object.values(G.T).some(t => champIds(t).indexOf(w.id) >= 0);
const mineW = (G, w) => !!w && w.fed === G.me && !w.ret;
export const SCN = {
  perdu: { bg: "vestiaire", ok: (G, w) => mineW(G, w) && (w.lossRun || 0) >= 2, t: ["{n} est assis{e} seul{e} sur le banc, une serviette sur la tête.", "« Encore perdu… Tu crois toujours en moi ? »"],
    ch: [["« Je crois en toi. Ton heure va venir. »", { c: 6, a: 3, mor: 6 }, "{n} relève la tête : « Merci. Je ne l’oublierai pas. »"],
      ["« Prouve-moi que tu le mérites. »", { r: 3, mor: 2 }, "{n} serre les dents : « Très bien. Tu vas voir. »"],
      ["« Les résultats, c’est toi qui les fais. »", { c: -6, a: -3, mor: -4 }, "{n} jette la serviette et sort sans un mot."]] },
  champion: { bg: "vestiaire", ok: (G, w) => mineW(G, w) && champ(G, w), t: ["Le vestiaire applaudit {n}, la ceinture sur l’épaule.", "« Alors, boss ? Fier de ton champion ? »"],
    ch: [["« Tu le mérites. Tout le monde le sait. »", { a: 5, c: 3, mor: 5 }, "« Ça me touche, vraiment. »"],
      ["« Maintenant, il faut la garder. »", { c: 3, r: 1 }, "{n} rit : « Qu’ils viennent tous. »"],
      ["« Ne prends pas la grosse tête. »", { a: -3, r: 4 }, "« La grosse tête ? Moi ? On verra qui rira le dernier. »"]] },
  blesse: { bg: "vestiaire", ok: (G, w) => mineW(G, w) && w.inj && w.inj.until > G.day, t: ["{n} sort du cabinet du médecin, le bras en écharpe… ou presque.", "« Je peux catcher, je te jure. Ne me mets pas de côté. »"],
    ch: [["« Ta santé passe avant tout. Repose-toi. »", { c: 6, a: 4, mor: -2 }, "« … D’accord. Merci de penser à moi. »"],
      ["« Si le médecin dit oui, tu catches. »", { c: 2 }, "« Marché conclu. »"],
      ["« On a besoin de toi ce soir. Serre les dents. »", { c: -4, mor: 3 }, "{n} hoche la tête, mais grimace en partant."]] },
  jaloux: { bg: "cantine", ok: (G, w, o) => mineW(G, w) && w.ct && w.ct.role !== "me" && o && mineW(G, o) && o.ct && o.ct.role === "me", other: (G, w) => roster(G).filter(x => x.fed === G.me && x.ct && x.ct.role === "me" && x.id !== w.id), t: ["À la cantine, {n} pose son plateau un peu trop fort.", "« Pourquoi c’est toujours {o} en haut de l’affiche ? Moi aussi je remplis les salles. »"],
    ch: [["« Ton tour viendra. Continue comme ça. »", { c: 3, mor: 2 }, "« J’espère que tu dis vrai. »"],
      ["« Va le dire à {o}, en face. »", { r: 2, mor: 1, rel: -10 }, "{n} se lève : « Avec plaisir. »"],
      ["« Le public décide, pas toi. »", { a: -4, c: -2, mor: -3 }, "« Le public ? Il ne me voit jamais. »"]] },
  fete: { bg: "parking", ok: (G, w) => mineW(G, w) && (w.pers || []).indexOf("Fêtard") >= 0, t: ["Sur le parking, {n} et quelques catcheurs chargent une glacière.", "« On fête la tournée ce soir ! Tu viens, boss ? »"],
    ch: [["« J’arrive ! Une heure, pas plus. »", { a: 7, c: 1 }, "Tout le monde t’acclame. Tu rentres tard… mais le vestiaire t’adore."],
      ["« Amusez-vous, mais soyez à l’heure demain. »", { c: 2 }, "« Promis, chef ! »"],
      ["« Pas de fête avant un show. Point. »", { a: -4, r: 2, mor: -3 }, "La glacière retourne dans le coffre."]] },
  conseil: { bg: "cantine", ok: (G, w, o) => mineW(G, w) && w.age >= 35 && o, other: (G, w) => roster(G).filter(x => x.fed === G.me && x.age <= 28 && x.id !== w.id), t: ["{n}, café à la main, te fait signe de t’asseoir.", "« Tu as vu {o} à l’entraînement ? Ce gamin a quelque chose. »"],
    ch: [["« Raconte-moi. »", { a: 3, c: 2, learn: 1 }, "{n} te parle longtemps de {o}. Tu en sais plus, maintenant."],
      ["« Tu pourrais le prendre sous ton aile ? »", { c: 3, mentor: 1 }, "« Avec plaisir. Je vais lui apprendre le métier. »"],
      ["« Je n’ai pas le temps. »", { a: -2 }, "{n} hausse les épaules et retourne à son café."]] },
  presse: { bg: "presse", ok: (G, w) => mineW(G, w) && w.pop >= 55, t: ["Conférence de presse. Un journaliste se tourne vers toi.", "« Est-ce que {n} est vraiment le meilleur de votre effectif ? »"],
    ch: [["« Le meilleur. Et de loin. »", { a: 4, c: 3, pop: 1 }, "{n} sourit fièrement à côté de toi."],
      ["« Un des meilleurs. La concurrence est rude. »", { c: 1 }, "La salle note. {n} ne dit rien."],
      ["« Il a encore tout à prouver. »", { r: 5, pop: 0.5, mor: -2 }, "{n} te fixe, glacial. Les flashs crépitent."]] },
  rumeur: { bg: "couloir", ok: (G, w) => mineW(G, w) && w.ct && w.ct.end - G.day < 120, t: ["Dans le couloir, {n} t’attrape par le bras.", "« On raconte que tu ne vas pas me garder. C’est vrai ? »"],
    ch: [["« Faux. On va parler de ton contrat. »", { c: 5, mor: 4, go: "nego" }, "« Enfin ! Je passe à ton bureau. »"],
      ["« Rien n’est décidé. »", { c: -1 }, "« Ça veut tout dire… »"],
      ["« Ça dépendra de tes prochains matchs. »", { r: 3, mor: 2 }, "« Message reçu. »"]] },
  idee: { bg: "bureau", ok: (G, w, o) => mineW(G, w) && o && mineW(G, o), other: (G, w) => roster(G).filter(x => x.fed === G.me && x.id !== w.id && x.sx === w.sx && x.al !== w.al), t: ["{n} frappe à la porte de ton bureau, un carnet à la main.", "« J’ai une idée : une rivalité contre {o}. Ça peut être énorme. »"],
    ch: [["« J’adore. On lance ça. »", { a: 5, c: 4, mor: 6, feud: 1 }, "« Tu ne le regretteras pas ! » (une rivalité commence)"],
      ["« Laisse-moi y réfléchir. »", { c: 1 }, "« D’accord. Mais ne réfléchis pas trop longtemps. »"],
      ["« Les idées, c’est moi qui les ai. »", { a: -5, c: -4, r: 3, mor: -5 }, "Le carnet se referme d’un coup sec."]] },
  dispute: { bg: "couloir", ok: (G, w, o) => mineW(G, w) && o && mineW(G, o), other: (G, w) => roster(G).filter(x => x.fed === G.me && x.id !== w.id && relGet(G, w.id, x.id) <= -20), t: ["Des cris dans le couloir : {n} et {o} se font face.", "« Dis-lui de se calmer, boss, ou je m’en occupe ! »"],
    ch: [["Les séparer et parler à chacun.", { c: 3, rel: 8 }, "Le calme revient. Ils s’évitent, mais ça va mieux."],
      ["« Réglez ça sur le ring. »", { r: 1, rel: -6, feud: 1 }, "Les deux sourient, menaçants. (une rivalité commence)"],
      ["Une amende pour les deux.", { c: -3, mor: -3, rel: 4 }, "Ils râlent, mais ils se tiennent tranquilles."]] },
  famille: { bg: "parking", ok: (G, w) => mineW(G, w), t: ["{n} t’attend près de sa voiture, le téléphone à la main.", "« Un événement important dans ma famille ce week-end. Je peux avoir 3 jours ? »"],
    ch: [["« Bien sûr. Profite. »", { a: 6, c: 5, rest: 3 }, "« Merci, boss. Vraiment. »"],
      ["« Seulement si tu es là pour le prochain show. »", { c: 1, rest: 2 }, "« Je serai là. »"],
      ["« Pas maintenant, on a besoin de toi. »", { a: -5, c: -5, mor: -6 }, "{n} raccroche, la mâchoire serrée."]] },
  merci: { bg: "bureau", ok: (G, w) => mineW(G, w) && (w.winRun || 0) >= 2, t: ["{n} passe la tête dans ton bureau.", "« Juste pour te dire merci. Je n’ai jamais été aussi bien qu’ici. »"],
    ch: [["« C’est toi qui fais le travail. »", { a: 4, c: 3, mor: 4 }, "« On fait une bonne équipe. »"],
      ["« Continue comme ça. »", { c: 2 }, "« Compte sur moi. »"],
      ["« Ne te repose pas sur tes lauriers. »", { r: 2 }, "« Jamais. »"]] },
  leader: { bg: "couloir", ok: (G, w, o) => mineW(G, w) && o, lead: 1, other: (G, w) => roster(G).filter(x => x.fed === G.me && x.id !== w.id && x.mor < 50), t: ["{n}, une des voix qui comptent dans le vestiaire, te prend à part.", "« Les gars ne sont pas contents. {o} en a marre d’être oublié{oe}. »"],
    ch: [["« Merci de me prévenir. Je m’en occupe. »", { c: 6, a: 2, help: 1 }, "« C’est pour ça que je t’en parle. »"],
      ["« Chacun son travail. Le tien, c’est catcher. »", { c: -6, r: 4 }, "« Comme tu veux. Le vestiaire s’en souviendra. »"],
      ["« Dis-leur de venir me voir directement. »", { c: 1 }, "« Ils n’oseront pas. Mais je transmets. »"]] },
  extra: { bg: "vestiaire", ok: (G, w) => mineW(G, w) && w.age <= 32, t: ["{n} est encore là après l’entraînement, trempé{e} de sueur.", "« Tu peux me payer des séances en plus avec un coach ? Je veux progresser. »"],
    ch: [["« Oui. (30 k$) »", { a: 3, c: 4, train: 1, money: -30 }, "« Tu ne le regretteras pas ! »"],
      ["« Le coach du roster suffit. »", { c: -1 }, "« Dommage. »"],
      ["« Commence par arriver à l’heure. »", { a: -3, r: 2 }, "« Sérieux ? »"]] },
  libre: { bg: "couloir", ok: (G, w) => !!w && !w.fed && !w.ret && !w.staff, free: 1, t: ["Un ancien de la maison te présente {n}, sans contrat en ce moment.", "« Je cherche un endroit où on me laisse m’exprimer. Votre show me plaît. »"],
    ch: [["« Passe à mon bureau, on va parler contrat. »", { a: 4, c: 4, go: "nego" }, "« Avec plaisir ! »"],
      ["« On garde le contact. »", { a: 3 }, "« Merci. J’attends ton appel. »"],
      ["« Pas de place pour l’instant. »", { a: -2 }, "« Tant pis. Vous ratez quelque chose. »"]] }
};
const SCK = Object.keys(SCN);
// choisir une scène pour un catcheur (ou n'importe qui)
export function sceneFor(G, wid, only) {
  const R = roster(G).filter(w => w.fed === G.me && !w.ret), FA = Object.values(G.W).filter(w => !w.fed && !w.ret && !w.staff && w.pop >= 35);
  const tries = [];
  (only ? [only] : SCK.slice().sort(() => rnd() - 0.5)).forEach(k => { const S = SCN[k]; const pool = wid ? [G.W[wid]] : S.free ? FA.slice().sort(() => rnd() - 0.5).slice(0, 6) : S.lead ? R.slice().sort((a, b) => influence(G, b) - influence(G, a)).slice(0, 3) : R.slice().sort(() => rnd() - 0.5).slice(0, 8);
    pool.forEach(w => { if (!w) return; const os = S.other ? S.other(G, w) : [], o = os.length ? pick(os) : null; if (S.ok(G, w, o)) tries.push({ k: k, w: w.id, o: o ? o.id : "" }); }); });
  const recent = (G.scLog || []).slice(-6).map(x => x.k);
  return tries.find(t => recent.indexOf(t.k) < 0) || tries[0] || null;
}
export function sceneText(G, sc) { const S = SCN[sc.k], w = G.W[sc.w], o = sc.o ? G.W[sc.o] : null, f = s => F(G, s, w, o).replace(/\{oe\}/g, o && o.sx === "f" ? "e" : ""); return { bg: S.bg, t: S.t.map(f), ch: S.ch.map(c => f(c[0])), rep: S.ch.map(c => f(c[2])) }; }
// la réponse choisie : les conséquences (cachées)
export function scenePick(G, sc, i) {
  const S = SCN[sc.k], c = S.ch[i], w = G.W[sc.w], o = sc.o ? G.W[sc.o] : null; if (!c || !w) return null;
  const fx = c[1]; bondAdd(w, fx);
  if (fx.rel && o) { const k = [w.id, o.id].sort().join("|"); G.rel = G.rel || {}; G.rel[k] = clamp((G.rel[k] || 0) + fx.rel, -100, 100); }
  if (fx.learn && o) learn(G, o.id);
  if (fx.mentor && o) { G.ment = G.ment || {}; G.ment[o.id] = w.id; }
  if (fx.rest) { G.rest = G.rest || {}; G.rest[w.id] = G.day + fx.rest; w.off = G.day + fx.rest; }
  if (fx.money) { const f = meF(G); f.money += fx.money; G.fin.cur.prod -= fx.money; }
  if (fx.train) { const i2 = [1, 2, 3, 4][Math.floor(rnd() * 4)]; w.st[i2] = clamp(w.st[i2] + 2); }
  if (fx.help && o) { o.mor = clamp(o.mor + 6); bondAdd(o, { c: 3 }); }
  if (fx.feud && o) G.sl.push({ id: uid("s"), fed: G.me, n: w.n + " contre " + o.n, a: [w.id], b: [o.id], len: 5, wk: 0, heat: 30, turn: null, done: false, from: G.day });
  G.scLog = (G.scLog || []).concat({ k: sc.k, w: w.id, d: G.day, i: i }); cap(G.scLog, 40);
  // la confiance d'un leader se propage un peu à ses amis
  if (influence(G, w) >= 60 && (fx.c || 0) !== 0) relsOf(G, w.id).filter(r => r.v >= 50 && G.W[r.id] && G.W[r.id].fed === G.me).forEach(r => bondAdd(G.W[r.id], { c: Math.sign(fx.c) }));
  return { go: fx.go || "" };
}

// ---------- SMS et DM ----------
// G.tel = [{ id, who (id catcheur | rôle du staff), n, msgs: [[de, texte, jour]], ch: [[libellé, clé]], k, w, o, read }]
export function telAdd(G, t) {
  G.tel = G.tel || []; let th = G.tel.find(x => x.who === t.who);
  if (!th) { th = { id: uid("t"), who: t.who, n: t.n, msgs: [] }; G.tel.push(th); }
  th.msgs.push(["him", t.txt, G.day]); cap(th.msgs, 30); th.ch = t.ch || null; th.k = t.k; th.w = t.w || ""; th.o = t.o || ""; th.read = false; th.d = G.day;
  G.tel.sort((a, b) => (b.d || 0) - (a.d || 0)); cap(G.tel, 40); G._new = (G._new || 0) + (t.k === "hint" ? 0 : 1); return th;
}
export const telUnread = G => (G.tel || []).filter(t => !t.read).length;
const STAFFN = { coach: "Le coach", med: "Le médecin", scout: "Le recruteur", prod: "Le producteur", right: "Ton bras droit" };
const TEL = [
  // le staff : des indices (informations cachées)
  G => { const R = roster(G).filter(w => w.fed === G.me); const w = pick(R); if (!w) return null; const i = w.st.indexOf(Math.max(...w.st.slice(1, 6)));
    const ST2 = ["son physique", "son jeu sur le ring", "le micro", "son charisme", "son endurance", "sa présence de star", "sa régularité"];
    return { k: "hint", who: "coach", n: STAFFN.coach, txt: "À l’entraînement, " + w.n + " m’impressionne : " + ST2[i] + ", c’est " + grade(w.st[i]).toLowerCase() + ". Par contre " + ST2[w.st.indexOf(Math.min(...w.st.slice(1, 6)))] + ", ça reste à travailler.", w: w.id }; },
  G => { const w = roster(G).filter(w => w.fed === G.me && w.en < 45 && !(w.inj && w.inj.until > G.day)).sort((a, b) => a.en - b.en)[0]; if (!w) return null;
    return { k: "rest", who: "med", n: STAFFN.med, w: w.id, txt: w.n + " cache une douleur. Si " + (w.sx === "f" ? "elle" : "il") + " catche encore sans repos, je ne réponds de rien.", ch: [["Une semaine de repos", "rest"], ["Il/elle tiendra", "no"]] }; },
  G => { const fa = Object.values(G.W).filter(w => !w.fed && !w.ret && !w.staff && w.pop >= 40).sort(() => rnd() - 0.5)[0]; if (!fa) return null; learn(G, fa.id);
    return { k: "fa", who: "scout", n: STAFFN.scout, w: fa.id, txt: "Je suis allé voir " + fa.n + " dans une petite salle. Sur le ring, c’est " + grade(fa.st[1]).toLowerCase() + ". Et " + (fa.sx === "f" ? "elle" : "il") + " parle de nous en bien.", ch: [["Ouvre la négociation", "nego"], ["Pas maintenant", "no"]] }; },
  G => { const R = roster(G).filter(w => w.fed === G.me).sort((a, b) => (b.mom || 0) - (a.mom || 0)); const w = R[0]; if (!w) return null;
    return { k: "hint", who: "prod", n: STAFFN.prod, txt: "Le public réagit de plus en plus fort pour " + w.n + ". Ce serait bête de ne pas en profiter.", w: w.id }; },
  // les catcheurs
  G => { const w = pick(roster(G).filter(w => w.fed === G.me && w.last >= G.day - 3)); if (!w) return null;
    return { k: "promo", who: w.id, n: w.n, w: w.id, txt: pick(["Tu as vu mon match d’hier ? 🔥", "Le public était en feu hier soir !! 🙌", "Alors, verdict sur mon match ? 👀"]), ch: [["Énorme ! 🔥", "promo1"], ["Tu peux faire encore mieux", "promo2"], ["(ne pas répondre)", "mute"]] }; },
  G => { const w = pick(roster(G).filter(w => w.fed === G.me && G.day >= 21 && w.last < G.day - 14 && !(w.inj && w.inj.until > G.day))); if (!w) return null;
    return { k: "nocard", who: w.id, n: w.n, w: w.id, txt: "Boss… ça fait deux semaines que je ne suis sur aucune carte. J’ai fait quelque chose de mal ?", ch: [["Tu seras au prochain show", "nocard1"], ["Patience, ton tour arrive", "nocard2"], ["(ne pas répondre)", "mute"]] }; },
  G => { const w = pick(roster(G).filter(w => w.fed === G.me && w.en < 55)); if (!w) return null;
    return { k: "off", who: w.id, n: w.n, w: w.id, txt: "Je suis cassé" + e_(w) + "… je peux souffler quelques jours ?", ch: [["Oui, 4 jours", "off1"], ["Après le prochain show", "off2"], ["Non", "off3"]] }; },
  G => { const w = pick(roster(G).filter(w => w.fed === G.me && (w.winRun || 0) >= 1)); if (!w) return null;
    return { k: "thx", who: w.id, n: w.n, w: w.id, txt: pick(["Merci pour la confiance ce soir 🙏", "Quelle soirée ! Merci boss 💪", "Je te revaudrai ça."]), ch: [["Bravo à toi ! 👏", "thx1"], ["👍", "thx2"]] }; },
  G => { const R = roster(G).filter(w => w.fed === G.me), w = pick(R), o = w && pick(R.filter(x => x.id !== w.id && x.sx === w.sx && x.al !== w.al)); if (!w || !o) return null;
    return { k: "feud", who: w.id, n: w.n, w: w.id, o: o.id, txt: "J’ai une idée : moi contre " + o.n + ". On en parle ?", ch: [["Vas-y, on lance ça", "feud1"], ["Pas maintenant", "feud2"]] }; }
];
export function telDaily(G) {
  if (rnd() > 0.28) return; const L = TEL.slice().sort(() => rnd() - 0.5);
  for (let i = 0; i < L.length; i++) { const t = L[i](G); if (t) { telAdd(G, t); return; } }
}
// mes réponses
export function telReply(G, th, key, lab) {
  const w = th.w && G.W[th.w], o = th.o && G.W[th.o]; let back = "", go = "";
  if (key !== "mute") th.msgs.push(["me", lab, G.day]);
  switch (key) {
    case "rest": if (w) { G.rest = G.rest || {}; G.rest[w.id] = G.day + 7; w.en = clamp(w.en + 10); } back = "Très bien, je le surveille."; break;
    case "nego": go = w ? "#/univers/nego/" + w.id : ""; back = "Je lui dis que tu l’appelles."; break;
    case "promo1": bondAdd(w, { a: 3, mor: 2 }); back = "Merci boss !! 🙏"; break;
    case "promo2": bondAdd(w, { c: 1, r: 2 }); back = "… OK. Je vais bosser."; break;
    case "nocard1": bondAdd(w, { c: 2, mor: 4 }); G.prom.push({ id: uid("p"), w: w.id, t: "show", until: G.day + 10, st: "cours", txt: "Être sur la carte du prochain show" }); back = "Merci, je serai prêt" + e_(w) + " !"; break;
    case "nocard2": bondAdd(w, { c: -1, mor: -1 }); back = "J’espère…"; break;
    case "off1": if (w) { G.rest = G.rest || {}; G.rest[w.id] = G.day + 4; w.off = G.day + 4; bondAdd(w, { a: 3, c: 3 }); } back = "Tu es le meilleur."; break;
    case "off2": bondAdd(w, { c: 1 }); back = "OK, je tiens jusque-là."; break;
    case "off3": bondAdd(w, { a: -3, c: -3, mor: -3 }); back = "…"; break;
    case "thx1": bondAdd(w, { a: 3 }); back = "😁"; break;
    case "thx2": bondAdd(w, { a: 1 }); break;
    case "feud1": if (w && o) G.sl.push({ id: uid("s"), fed: G.me, n: w.n + " contre " + o.n, a: [w.id], b: [o.id], len: 5, wk: 0, heat: 28, turn: null, done: false, from: G.day }); bondAdd(w, { a: 4, c: 3, mor: 5 }); back = "Génial ! Je prépare ma première promo. 🎤"; break;
    case "feud2": bondAdd(w, { c: -1 }); back = "Dommage."; break;
    case "mute": if (w) bondAdd(w, { a: -2, c: -1 }); th.ch = null; th.read = true; return { go: "" };
    case "no": back = "Comme tu veux."; break;
  }
  if (back) th.msgs.push(["him", back, G.day]);
  th.ch = null; th.read = true; return { go: go };
}

// ---------- chaque jour : une scène qui attend, des messages ----------
export function vnDaily(G) {
  telDaily(G);
  if (dateOf(G.day).wd === 1) lockerWeekly(G);
  G.scQ = (G.scQ || []).filter(s => s.until >= G.day);
  if (!G.scQ.length && rnd() < 0.1) { const s = sceneFor(G); if (s) G.scQ.push(Object.assign(s, { until: G.day + 3 })); }
}
// après un de mes shows : quelqu'un veut souvent me voir
export function vnAfterShow(G, ev, res) {
  if (ev.fed !== G.me || ev.ai) return;
  (res || []).filter(r => r.it === "m" && typeof r.win === "number").forEach(r => { (r.sides[r.win] || []).forEach(i => { const w = G.W[i]; if (w && w.fed === G.me && w.b && w.b.r >= 30 && rnd() < 0.3) w.mor = clamp(w.mor - 2); }); });
  if ((G.scQ || []).length < 2 && rnd() < 0.45) { const s = sceneFor(G); if (s) G.scQ = (G.scQ || []).concat(Object.assign(s, { until: G.day + 3 })); }
}
export const promiseKept = (G, p) => { const w = G.W[p.w]; if (w) bondAdd(w, { c: 6 }); };
export const promiseBroken = (G, p) => { const w = G.W[p.w]; if (w) bondAdd(w, { c: -10, r: 3 }); };
