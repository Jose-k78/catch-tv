// Mode Univers : Ma fédé, Créatif, Activité, préparation d'un show (la carte des matchs) et résultats.
import { ACT, FORM } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { STYLES, ROLES, MONTHS, dayLabel, shortDate, dateOf, fmtM, fmtK, stars, recTxt, clamp, rnd, pick, uid, trainee } from "./world.js";
import { meF, roster, avail, injured, risk, teamName, wn, mail, news, buzz, playMatch, playShow, autoCard, heatBetween, DUR, SPOTS } from "./sim.js";
import { U, go, redraw, persist, shell, tabs, chips, face, crest, imgT, imgEv, imgTeam, imgBtn } from "./core.js";
import { promoteYoung } from "./ui.js";

const bar = (v, c) => '<span class="uvbar"><i style="width:' + clamp(v) + "%" + (c ? ";background:" + c : "") + '"></i></span>';
const enC = v => v >= 60 ? "#63d69c" : v >= 35 ? "#ffd27a" : "#ff8a7e";
const morTxt = v => v >= 65 ? "Bon" : v >= 45 ? "Moyen" : "Mauvais";
const morC = v => v >= 65 ? "#63d69c" : v >= 45 ? "#ffd27a" : "#ff8a7e";
const e_ = w => (w && w.sx === "f" ? "e" : "");
const ini = n => String(n || "?").split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
const DIVL = { h: "Masculin", f: "Féminin", tag: "Par équipes" };
const big = ev => ev.kind === "ple" || ev.kind === "ppv";
const kindL = ev => ev.kind === "tv" ? "Show TV" : ev.kind.toUpperCase();
export const divOf = (G, w) => (G.dv || {})[w.id] || (w.sx === "f" ? "f" : "h");
const mine = G => roster(G).sort((a, b) => b.pop - a.pop);
const champIds = t => Array.isArray(t.champ) ? t.champ : t.champ ? [t.champ] : [];
const champName = (G, t) => champIds(t).length ? teamName(G, champIds(t)) : "Vacant";
const BELT_SVG = '<svg class="uvbeltph" viewBox="0 0 64 32" aria-hidden="true"><rect x="1" y="9" width="62" height="14" rx="5"></rect><ellipse cx="32" cy="16" rx="14" ry="13"></ellipse><circle cx="32" cy="16" r="6"></circle></svg>';
function wOpts(G, sel, o) {
  o = o || {};
  return '<option value="">' + esc(o.ph || "— Choisir —") + "</option>" + mine(G).filter(o.f || (() => true)).map(w => {
    const ok = avail(G, w), tag = !o.book ? "" : " · " + Math.round(w.en) + " %" + (injured(G, w) ? " · blessé" + e_(w) : w.off > G.day ? " · absent" + e_(w) : (G.rest || {})[w.id] > G.day ? " · au repos" : w.en < 40 ? " · fatigué" + e_(w) : "");
    return '<option value="' + esc(w.id) + '"' + (w.id === sel ? " selected" : "") + (o.book && !ok && w.id !== sel ? " disabled" : "") + ">" + esc(w.n) + tag + "</option>";
  }).join("");
}
const ask = (q, yes, fn) => modal((box, close) => {
  box.classList.add("uvmodal");
  box.innerHTML = "<h3>" + esc(q) + '</h3><button type="button" class="uvbtn del" data-y="1">' + esc(yes) + '</button><button type="button" class="uvbtn ghost" data-n="1">Annuler</button>';
  box.addEventListener("click", e => { if (e.target.closest("[data-n]")) close(); if (e.target.closest("[data-y]")) { close(); fn(); } });
});
const pay = (G, k) => { const f = meF(G); if (f.money < k) { toast("Pas assez d’argent (" + fmtK(f.money) + ")"); return false; } f.money -= k; G.fin.cur.prod += k; return true; };
const done = () => { persist(); redraw(); };

// ======================= MA FÉDÉ =======================
export function fedeView(tab) {
  const G = U.G; tab = tab || "e";
  const T = tabs("#/univers/fede", [["e", "Mon effectif"], ["dev", "Développement"], ["inf", "Infirmerie"], ["p", "Promesses"], ["m", "Moral"]], tab);
  const R = mine(G);
  let body = "";
  if (tab === "e") {
    const dv = U.f.eff, L = dv === "tous" ? R : R.filter(w => divOf(G, w) === dv), sal = R.reduce((s, w) => s + (w.ct ? w.ct.sal : 0), 0);
    body = chips("eff", [["tous", "Tous"]].concat(G.divs.filter(d => d.id !== "tag").map(d => [d.id, d.n])), dv) +
      '<p class="uvmut">' + L.length + " catcheur" + (L.length > 1 ? "s" : "") + " · salaires : " + fmtK(sal) + " par an</p>" +
      (L.length ? L.map(w => '<a class="uvw" href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 40) + '<span class="uvgrow"><b>' + esc(w.n) + "</b><small>" + (w.ct ? ROLES[w.ct.role] + " · " : "") + STYLES[w.sty][0] + " · " + (w.al === "heel" ? "Heel" : "Face") + " · " + recTxt(w.rec) + "</small>" +
        (injured(G, w) ? '<small class="uvko">Blessé' + e_(w) + " jusqu’au " + esc(shortDate(w.inj.until)) + "</small>" : '<span class="uvenl">' + bar(w.en, enC(w.en)) + "<i>" + Math.round(w.en) + " %</i></span>") +
        '</span><span class="uvnote">' + Math.round(w.pop) + "<small>POP</small></span></a>").join("") : '<p class="uvempty">Personne dans cette division.</p>');
  } else if (tab === "dev") {
    const D = G.dev || [];
    body = '<div class="uvtile"><p class="uvsm">Les jeunes progressent chaque semaine. Quand la barre est pleine, tu peux les faire monter dans ton effectif.</p><button type="button" class="uvbtn pri" data-act="uvrecruit"' + (D.length >= 6 ? " disabled" : "") + ">Recruter un jeune (30 k$)</button>" + (D.length >= 6 ? '<p class="uvmut">6 jeunes au maximum.</p>' : "") + "</div>" +
      (D.length ? D.map(y => '<div class="uvcard"><div class="uvrow"><span class="uvav ini" style="width:40px;height:40px;background:#63d69c">' + esc(ini(y.n)) + '</span><div class="uvgrow"><b>' + esc(y.n) + "</b><small>" + y.age + " ans · " + esc(y.coach) + ' · potentiel <span class="uvstars" aria-label="' + y.pot + ' sur 5">' + "★".repeat(y.pot) + "☆".repeat(5 - y.pot) + "</span></small></div></div>" +
        bar(y.prog, y.prog >= 100 ? "#63d69c" : "") + '<div class="uvrow2">' + (y.prog >= 100 ? '<button type="button" class="uvbtn pri" data-act="uvpromote" data-y="' + esc(y.id) + '">' + (y.sx === "f" ? "La" : "Le") + " faire monter</button>" : '<span class="uvmut">Formation : ' + Math.round(y.prog) + " %</span>") +
        '<button type="button" class="uvbtn ghost" data-act="uvfire" data-y="' + esc(y.id) + '">Renvoyer</button></div></div>').join("") : '<p class="uvempty">Le centre est vide : recrute un jeune.</p>');
  } else if (tab === "inf") {
    const I = R.filter(w => injured(G, w)), O = R.filter(w => !injured(G, w) && w.off > G.day), Tt = R.filter(w => !injured(G, w) && w.en < 45);
    body = '<h3 class="uvh3">Blessés</h3>' + (I.length ? I.map(w => '<div class="uvcard"><div class="uvrow">' + face(G, w, 40) + '<div class="uvgrow"><b>' + esc(w.n) + "</b><small>" + esc(w.inj.what) + (w.inj.grave ? " · grave" : "") + "</small><small>Retour : " + esc(dayLabel(w.inj.until)) + " (" + (w.inj.until - G.day) + " j)</small></div></div>" +
      (w.inj.spec ? '<p class="uvmut">Déjà vu' + e_(w) + " par un spécialiste.</p>" : '<button type="button" class="uvbtn" data-act="uvheal" data-w="' + esc(w.id) + '">Envoyer chez un spécialiste (50 k$)</button>') + "</div>").join("") : '<p class="uvempty">Personne n’est blessé.</p>') +
      (O.length ? '<h3 class="uvh3">Absents</h3>' + O.map(w => '<div class="uvcard uvrow">' + face(G, w, 36) + '<div class="uvgrow"><b>' + esc(w.n) + "</b><small>Absent" + e_(w) + " jusqu’au " + esc(dayLabel(w.off)) + "</small></div></div>").join("") : "") +
      '<h3 class="uvh3">À surveiller (fatigue)</h3><p class="uvsm">Plus la barre d’endurance est basse, plus le risque de blessure monte. Une semaine de repos la remplit vite.</p>' +
      (Tt.length ? Tt.map(w => { const r = risk(w); return '<div class="uvcard"><div class="uvrow">' + face(G, w, 36) + '<div class="uvgrow"><b>' + esc(w.n) + '</b><span class="uvenl">' + bar(w.en, enC(w.en)) + "<i>" + Math.round(w.en) + ' %</i></span><small class="uv' + r[1] + '">Risque de blessure : ' + r[0] + "</small></div></div>" +
        ((G.rest || {})[w.id] > G.day ? '<p class="uvok">Au repos jusqu’au ' + esc(shortDate(G.rest[w.id])) + "</p>" : '<button type="button" class="uvbtn" data-act="uvrest" data-w="' + esc(w.id) + '">Repos une semaine</button>') + "</div>"; }).join("") : '<p class="uvempty">Tout le monde est en forme.</p>');
  } else if (tab === "p") {
    const P = (G.prom || []).slice().reverse();
    body = P.length ? P.map(p => { const w = G.W[p.w]; return '<div class="uvcard uvrow">' + (w ? face(G, w, 36) : "") + '<div class="uvgrow"><b>' + esc(w ? w.n : "?") + "</b><small>" + esc(p.txt) + '</small></div><span class="uvstat ' + (p.st === "tenue" ? "ok" : p.st === "ratee" ? "ko" : "mid") + '">' + (p.st === "tenue" ? "Tenue" : p.st === "ratee" ? "Ratée" : "En cours") + "</span></div>"; }).join("")
      : '<p class="uvempty">Aucune promesse. Tu peux en faire dans le dialogue avec un catcheur (sa fiche › Dialogue) ou en répondant à son courrier.</p>';
  } else {
    const avgM = R.length ? Math.round(R.reduce((s, w) => s + w.mor, 0) / R.length) : 0, c = [0, 0, 0];
    R.forEach(w => c[w.mor >= 65 ? 0 : w.mor >= 45 ? 1 : 2]++);
    const why = w => [G.day - w.last > 21 ? "pas utilisé" + e_(w) + " depuis longtemps" : "", (G.prom || []).some(p => p.w === w.id && p.st === "ratee") ? "promesse non tenue" : "", (G.tens || []).some(t => t.a === w.id || t.b === w.id) ? "conflit en coulisses" : "", w.rec[1] > w.rec[0] + 3 ? "trop de défaites" : "", w.ct && w.ct.role === "low" && w.pop > 50 ? "rôle trop petit" : ""].filter(Boolean).join(", ");
    body = '<div class="uvtile"><div class="uvth">Moral du vestiaire <i>' + avgM + ' / 100</i></div><div class="uvbig" style="color:' + morC(avgM) + '">' + morTxt(avgM) + "</div>" + bar(avgM, morC(avgM)) +
      '<div class="uvkv3"><div><b class="uvok">' + c[0] + "</b>contents</div><div><b>" + c[1] + '</b>moyens</div><div><b class="uvko">' + c[2] + "</b>pas contents</div></div></div>" +
      '<h3 class="uvh3">Les moins contents</h3>' + R.slice().sort((a, b) => a.mor - b.mor).slice(0, 8).map(w => '<a class="uvw" href="#/univers/c/' + esc(w.id) + '/d">' + face(G, w, 36) + '<span class="uvgrow"><b>' + esc(w.n) + "</b><small>" + esc(why(w) || "rien de grave") + '</small></span><span class="uvnote" style="color:' + morC(w.mor) + '">' + Math.round(w.mor) + "<small>MORAL</small></span></a>").join("") +
      '<h3 class="uvh3">Conflits en coulisses</h3>' + ((G.tens || []).length ? G.tens.map((t, i) => '<div class="uvcard uvrow"><div class="uvgrow"><b>' + esc(wn(G, t.a)) + " et " + esc(wn(G, t.b)) + "</b><small>Depuis le " + esc(shortDate(t.d)) + '</small></div><button type="button" class="uvbtn sm" data-act="uvreco" data-i="' + i + '">Réconcilier (10 k$)</button></div>').join("") : '<p class="uvempty">Aucun conflit en ce moment.</p>');
  }
  return shell("fede", "Ma fédération", T, body);
}
ACT.uvrecruit = () => { const G = U.G; if ((G.dev || []).length >= 6 || !pay(G, 30)) return; const y = trainee(); G.dev.push(y); toast(y.n + " rejoint ton centre de développement"); done(); };
ACT.uvpromote = el => { const G = U.G, y = (G.dev || []).find(x => x.id === el.dataset.y); if (!y) return; promoteYoung(G, y); toast(y.n + " rejoint ton effectif !"); done(); };
ACT.uvfire = el => { const G = U.G, y = (G.dev || []).find(x => x.id === el.dataset.y); if (!y) return; ask("Renvoyer " + y.n + " ?", "Oui, renvoyer", () => { G.dev = G.dev.filter(x => x !== y); done(); }); };
ACT.uvheal = el => { const G = U.G, w = G.W[el.dataset.w]; if (!w || !w.inj || w.inj.spec || !pay(G, 50)) return; w.inj.until = Math.max(G.day + 3, G.day + Math.round((w.inj.until - G.day) * 0.6)); w.inj.spec = true; toast("Retour avancé au " + shortDate(w.inj.until)); done(); };
ACT.uvreco = el => { const G = U.G, t = (G.tens || [])[+el.dataset.i]; if (!t || !pay(G, 10)) return; G.tens.splice(+el.dataset.i, 1); [t.a, t.b].forEach(i => { const w = G.W[i]; if (w) w.mor = clamp(w.mor + 5); }); toast("Ils se serrent la main."); done(); };

// ======================= CRÉATIF =======================
const TH = [
  { k: "tra", re: /trahi|trahison|betray|poignard|dans le dos/, n: (a, b) => "La trahison de " + a.n, p: (a, b) => a.n + " et " + b.n + " étaient proches… jusqu’au soir où " + a.n + " attaque " + b.n + " par derrière.", tA: "heel", same: true },
  { k: "tit", re: /titre|ceinture|champion|gold/, title: true, n: (a, b, t) => "Objectif : " + (t ? t.n : "le titre"), p: (a, b, t) => a.n + " veut le " + (t ? t.n : "titre") + " de " + b.n + ". Défis au micro, attaques en coulisses, puis le match pour le titre au prochain grand show." },
  { k: "ven", re: /vengeance|venge|bless|revanche/, n: a => "La vengeance de " + a.n, p: (a, b) => b.n + " a mis " + a.n + " sur la touche il y a des mois. " + a.n + " revient et ne pense qu’à une chose : se venger." },
  { k: "jal", re: /jalou|envie|ombre/, n: (a, b) => a.n + " dans l’ombre de " + b.n, p: (a, b) => a.n + " en a assez de passer après " + b.n + ". La jalousie grandit semaine après semaine.", tA: "heel" },
  { k: "men", re: /mentor|élève|eleve|maître|maitre|jeune|vétéran|veteran/, n: () => "Le maître et l’élève", p: (a, b) => b.n + " a tout appris à " + a.n + ". Maintenant, l’élève veut dépasser le maître.", age: true },
  { k: "ret", re: /retour|revient|come ?back/, n: a => "Le retour de " + a.n, p: (a, b) => a.n + " fait un retour surprise et vise directement " + b.n + ".", tA: "face" },
  { k: "res", re: /respect|honneur|rival|meilleur/, n: (a, b) => a.n + " contre " + b.n + " : qui est le meilleur ?", p: () => "Deux rivaux qui se respectent. Une série de matchs de plus en plus durs, jusqu’au match décisif." }
];
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function genSL(G, txt, turn) {
  const R = mine(G).filter(w => avail(G, w)), low = (txt || "").toLowerCase();
  if (R.length < 2) return null;
  const named = R.filter(w => { const n = w.n.toLowerCase(); return low.indexOf(n) >= 0 || n.split(/\s+/).filter(p => p.length > 2).some(p => new RegExp("(^|[^a-zà-ÿ])" + reEsc(p) + "($|[^a-zà-ÿ])").test(low)); });
  const th = TH.find(t => t.re.test(low)) || pick(TH);
  let a = named[0], b = named[1], t = null;
  const sameSx = x => R.filter(w => w.sx === x.sx && w.id !== x.id);
  if (th.title) {
    const TT = Object.values(G.T).filter(x => x.fed === G.me && x.div !== "tag" && champIds(x).length && G.W[champIds(x)[0]]);
    t = (a && TT.find(x => (x.div === "f") === (a.sx === "f") && champIds(x)[0] !== a.id)) || pick(TT.length ? TT : [null]);
    if (t) { const c = G.W[champIds(t)[0]]; if (!a || a.id === c.id) a = R.filter(w => w.sx === c.sx && w.id !== c.id)[Math.floor(rnd() * 3)]; b = c; }
  }
  if (th.same && !b && a) { const grp = (G.teams || []).concat(G.clans || []).find(g => g.fed === G.me && g.m.indexOf(a.id) >= 0); if (grp) b = G.W[grp.m.find(i => i !== a.id)]; }
  if (th.same && !a) { const grp = pick(((G.teams || []).concat(G.clans || [])).filter(g => g.fed === G.me && g.m.length >= 2) || []); if (grp) { a = G.W[grp.m[1]]; b = G.W[grp.m[0]]; } }
  if (!a) { const sx = rnd() < 0.65 ? "h" : "f", L = R.filter(w => w.sx === sx); a = L[Math.floor(rnd() * Math.min(10, L.length))] || R[0]; }
  if (!b || b.id === a.id) { let L = sameSx(a); if (th.age) L = L.filter(w => Math.abs(w.age - a.age) >= 6); if (!L.length) L = sameSx(a); if (!L.length) L = R.filter(w => w.id !== a.id); b = L[Math.floor(rnd() * Math.min(8, L.length))]; }
  if (!a || !b) return null;
  if (th.age && a.age > b.age) { const x = a; a = b; b = x; }
  let tn = null;
  const want = turn || th.tA;
  if (want) { if (a.al !== want) tn = { w: a.id, to: want }; else if (b.al !== want && turn) tn = { w: b.id, to: want }; }
  return { n: th.n(a, b, t), p: th.p(a, b, t), a: [a.id], b: [b.id], len: 4 + Math.floor(rnd() * 4), turn: tn, title: t ? t.id : "" };
}
const turnTxt = (G, tn) => tn ? (tn.to === "heel" ? "Heel turn de " : "Face turn de ") + wn(G, tn.w) + " à la fin" : "Pas de changement de camp";
function turnOpts(G, ids, cur) {
  return '<option value="">Pas de turn</option>' + ids.map(i => { const w = G.W[i]; if (!w) return ""; const to = w.al === "heel" ? "face" : "heel", v = i + ":" + to; return '<option value="' + esc(v) + '"' + (cur && cur.w === i && cur.to === to ? " selected" : "") + ">" + (to === "heel" ? "Heel turn de " : "Face turn de ") + esc(w.n) + "</option>"; }).join("");
}
function slCard(G, s) {
  const ed = U.f.sled === s.id, ids = s.a.concat(s.b);
  if (ed) return '<form class="uvcard uvform" data-form="uvsledit" data-s="' + esc(s.id) + '"><label class="uvfld">Nom<input name="n" maxlength="60" value="' + esc(s.n) + '"></label>' +
    '<label class="uvfld">Durée<select name="len">' + [2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => '<option value="' + n + '"' + (n === s.len ? " selected" : "") + ">" + n + " semaines</option>").join("") + "</select></label>" +
    '<label class="uvfld">Fin de la storyline<select name="turn">' + turnOpts(G, ids, s.turn) + '</select></label><div class="uvrow2"><button class="uvbtn pri">Enregistrer</button><button type="button" class="uvbtn ghost" data-act="uvsled" data-s="">Annuler</button></div></form>';
  return '<div class="uvcard"><div class="uvrow"><div class="uvgrow"><b>' + esc(s.n) + "</b><small>" + esc(teamName(G, s.a)) + " contre " + esc(teamName(G, s.b)) + '</small></div><span class="uvmut">Semaine ' + Math.min(s.wk + 1, s.len) + " / " + s.len + "</span></div>" +
    (s.p ? '<p class="uvsm">' + esc(s.p) + "</p>" : "") + '<div class="uvst2"><span>Heat</span>' + bar(s.heat, s.heat >= 60 ? "#ff6b5e" : "#f5b13d") + "<b>" + s.heat + "</b></div>" +
    '<p class="uvsm">' + esc(turnTxt(G, s.turn)) + ' · fais-les s’affronter chaque semaine pour faire monter la heat.</p><div class="uvrow2"><button type="button" class="uvbtn sm" data-act="uvsled" data-s="' + esc(s.id) + '">Modifier</button><button type="button" class="uvbtn sm del" data-act="uvsldel" data-s="' + esc(s.id) + '">Supprimer</button></div></div>';
}
export function creatifView(tab) {
  const G = U.G; tab = tab || "sl";
  const T = tabs("#/univers/creatif", [["div", "Divisions"], ["sl", "Storylines"], ["cl", "Clans"], ["eq", "Équipes"], ["ti", "Titres"], ["to", "Tournois"], ["cla", "Classement"]], tab);
  const R = mine(G);
  let body = "";
  if (tab === "div") {
    body = '<p class="uvsm">Range tes catcheurs comme tu veux. Mettre quelqu’un dans la division féminine ou masculine change aussi les matchs que l’IA lui donne.</p>' + G.divs.map(d => {
      if (d.id === "tag") { const tm = G.teams.filter(t => t.fed === G.me); return '<div class="uvcard"><div class="uvrow"><b class="uvgrow">' + esc(d.n) + '</b><span class="uvmut">' + tm.length + " équipe" + (tm.length > 1 ? "s" : "") + '</span></div><div class="uvmem">' + tm.map(t => '<span class="uvpill">' + esc(t.n) + "</span>").join("") + '</div><a class="uvbtn ghost" href="#/univers/creatif/eq">Gérer les équipes</a></div>'; }
      const M = R.filter(w => divOf(G, w) === d.id);
      return '<div class="uvcard">' + (U.f.dved === d.id ? '<form class="uvinl" data-form="uvdvren" data-d="' + esc(d.id) + '"><input name="n" value="' + esc(d.n) + '" maxlength="40" aria-label="Nom de la division"><button class="uvbtn pri">Enregistrer</button></form>'
        : '<div class="uvrow"><b class="uvgrow">' + esc(d.n) + '</b><span class="uvmut">' + M.length + '</span><button type="button" class="uvbtn sm ghost" data-act="uvdved" data-d="' + esc(d.id) + '">Renommer</button>' + (d.c ? '<button type="button" class="uvbtn sm del" data-act="uvdvdel" data-d="' + esc(d.id) + '">Supprimer</button>' : "") + "</div>") +
        '<div class="uvmem">' + M.map(w => '<span class="uvpill">' + face(G, w, 22) + esc(w.n) + (d.c ? '<button type="button" data-act="uvdvrm" data-w="' + esc(w.id) + '" aria-label="Retirer ' + esc(w.n) + '">×</button>' : "") + "</span>").join("") + "</div>" +
        '<form class="uvinl" data-form="uvdvadd" data-d="' + esc(d.id) + '"><select name="w" aria-label="Ajouter un catcheur à ' + esc(d.n) + '">' + wOpts(G, "", { ph: "Ajouter un catcheur…", f: w => divOf(G, w) !== d.id }) + '</select><button class="uvbtn">Ajouter</button></form></div>';
    }).join("") + '<form class="uvcard uvinl" data-form="uvdvnew"><input name="n" maxlength="40" placeholder="Nom de la nouvelle division" aria-label="Nom de la nouvelle division" required><button class="uvbtn pri">Créer</button></form>';
  } else if (tab === "sl") {
    const A = G.sl.filter(s => s.fed === G.me && !s.done), Dn = G.sl.filter(s => s.fed === G.me && s.done).slice(-8).reverse(), I = U.f.gen;
    body = '<div class="uvtile uvgen"><div class="uvth">Générateur de storylines</div><p class="uvsm">Écris une idée avec des noms ou des mots comme « trahison », « titre », « vengeance », « retour »… ou laisse vide pour une surprise.</p>' +
      '<input id="uvslt" class="uvin" maxlength="160" placeholder="Ex. : trahison entre deux partenaires" value="' + esc(U.f.gtxt || "") + '" aria-label="Ton idée de storyline">' +
      '<select id="uvslturn" class="uvin" aria-label="Changement de camp"><option value="">Turn : au choix du générateur</option><option value="heel"' + (U.f.gturn === "heel" ? " selected" : "") + '>Avec un heel turn</option><option value="face"' + (U.f.gturn === "face" ? " selected" : "") + '>Avec un face turn</option></select>' +
      '<button type="button" class="uvbtn pri" data-act="uvslgen">' + (I ? "Autre idée" : "Proposer une storyline") + "</button>" +
      (I ? '<div class="uvidea"><b>' + esc(I.n) + "</b><p>" + esc(I.p) + '</p><div class="uvvs">' + face(G, G.W[I.a[0]], 34) + "<span>" + esc(teamName(G, I.a)) + "</span><i>contre</i><span>" + esc(teamName(G, I.b)) + "</span>" + face(G, G.W[I.b[0]], 34) + '</div><p class="uvsm">' + I.len + " semaines · " + esc(turnTxt(G, I.turn)) + '</p><button type="button" class="uvbtn pri" data-act="uvsllaunch">Lancer cette storyline</button></div>' : "") + "</div>" +
      '<h3 class="uvh3">En cours</h3>' + (A.length ? A.map(s => slCard(G, s)).join("") : '<p class="uvempty">Aucune storyline en cours.</p>') +
      '<details class="uvdet"><summary>Créer une storyline à la main</summary><form class="uvform" data-form="uvslnew"><label class="uvfld">Nom<input name="n" maxlength="60" required placeholder="Nom de la storyline"></label>' +
      '<label class="uvfld">Camp 1<select name="a" required>' + wOpts(G, "") + '</select></label><label class="uvfld">Camp 2<select name="b" required>' + wOpts(G, "") + "</select></label>" +
      '<label class="uvfld">Durée<select name="len">' + [3, 4, 5, 6, 8, 10].map(n => '<option value="' + n + '"' + (n === 5 ? " selected" : "") + ">" + n + " semaines</option>").join("") + "</select></label>" +
      '<label class="uvfld">Fin<select name="turn"><option value="">Pas de turn</option><option value="a">Le camp 1 change de camp</option><option value="b">Le camp 2 change de camp</option></select></label><button class="uvbtn pri">Créer</button></form></details>' +
      (Dn.length ? '<h3 class="uvh3">Terminées</h3>' + Dn.map(s => '<div class="uvline"><span class="uvgrow">' + esc(s.n) + '</span><span class="uvmut">heat ' + s.heat + "</span></div>").join("") : "");
  } else if (tab === "cl" || tab === "eq") {
    const isC = tab === "cl", L = (isC ? G.clans : G.teams).filter(x => x.fed === G.me);
    body = '<p class="uvsm">' + (isC ? "Un clan = 3 catcheurs ou plus qui se battent ensemble." : "Une équipe = 2 catcheurs. Plus ils font équipe, meilleure est leur entente.") + "</p>" +
      (L.length ? L.map(x => { const lg = imgTeam(G, x); return '<div class="uvcard"><div class="uvrow">' + (lg ? '<img class="uvcrest" src="' + esc(lg) + '" alt="" style="width:40px;height:40px">' : '<span class="uvcrest ini" style="width:40px;height:40px;background:#c9a7ff">' + esc(ini(x.n)) + "</span>") + '<b class="uvgrow">' + esc(x.n) + "</b>" + imgBtn("g:" + x.id, "🖼️") + '<button type="button" class="uvbtn sm del" data-act="uvgrdel" data-g="' + esc(x.id) + '">Supprimer</button></div>' +
        '<div class="uvmem">' + x.m.map(i => G.W[i] ? '<span class="uvpill">' + face(G, G.W[i], 22) + esc(G.W[i].n) + (isC ? '<button type="button" data-act="uvgrrm" data-g="' + esc(x.id) + '" data-w="' + esc(i) + '" aria-label="Retirer ' + esc(G.W[i].n) + '">×</button>' : "") + "</span>" : "").join("") + "</div>" +
        (isC ? '<form class="uvinl" data-form="uvgradd" data-g="' + esc(x.id) + '"><select name="w" aria-label="Ajouter un membre">' + wOpts(G, "", { ph: "Ajouter un membre…", f: w => x.m.indexOf(w.id) < 0 }) + '</select><button class="uvbtn">Ajouter</button></form>' : '<div class="uvst2"><span>Entente</span>' + bar(x.chem, "#63d69c") + "<b>" + x.chem + "</b></div>") + "</div>"; }).join("") : '<p class="uvempty">' + (isC ? "Aucun clan." : "Aucune équipe.") + "</p>") +
      '<form class="uvcard uvform" data-form="uvgrnew" data-t="' + tab + '"><h3 class="uvh3">' + (isC ? "Nouveau clan" : "Nouvelle équipe") + '</h3><label class="uvfld">Nom<input name="n" maxlength="40" required></label>' +
      [1, 2].concat(isC ? [3] : []).map(i => '<label class="uvfld">Membre ' + i + '<select name="m' + i + '" required>' + wOpts(G, "") + "</select></label>").join("") + '<button class="uvbtn pri">Créer</button></form>';
  } else if (tab === "ti") {
    const L = Object.values(G.T).filter(t => t.fed === G.me);
    body = (L.length ? L.map(t => { const im = imgT(G, t), tm = G.teams.filter(x => x.fed === G.me), ch = champIds(t);
      return '<div class="uvcard uvtitle"><div class="uvrow">' + (im ? '<img class="uvbelt big" src="' + esc(im) + '" alt="">' : BELT_SVG) + '<div class="uvgrow"><b>' + esc(t.n) + "</b><small>" + DIVL[t.div] + "</small><small>Champion" + (t.div === "f" ? "ne" : "") + " : <b>" + esc(champName(G, t)) + "</b>" + (ch.length ? " · depuis " + (G.day - t.since) + " jours · " + (t.defs || 0) + " défense" + ((t.defs || 0) > 1 ? "s" : "") : "") + "</small></div></div>" +
        '<div class="uvrow2">' + imgBtn("t:" + t.id, "🖼️ Changer la ceinture") + "</div>" +
        '<form class="uvinl" data-form="uvtch" data-t="' + esc(t.id) + '"><select name="w" aria-label="Nouveau champion">' + (t.div === "tag" ? '<option value="">— Choisir une équipe —</option>' + tm.map(x => '<option value="' + esc(x.id) + '">' + esc(x.n) + "</option>").join("") : wOpts(G, "", { f: w => divOf(G, w) !== (t.div === "f" ? "h" : "f") })) + '</select><button class="uvbtn">Nommer champion</button></form>' +
        '<div class="uvrow2">' + (ch.length ? '<button type="button" class="uvbtn sm ghost" data-act="uvtvac" data-t="' + esc(t.id) + '">Rendre vacant</button>' : "") + '<button type="button" class="uvbtn sm del" data-act="uvtdel" data-t="' + esc(t.id) + '">Supprimer le titre</button></div></div>'; }).join("") : '<p class="uvempty">Aucun titre.</p>') +
      '<form class="uvcard uvform" data-form="uvtnew"><h3 class="uvh3">Nouveau titre</h3><label class="uvfld">Nom<input name="n" maxlength="50" required placeholder="Ex. : Championnat Télévision"></label><label class="uvfld">Pour<select name="div"><option value="h">Les hommes</option><option value="f">Les femmes</option><option value="tag">Les équipes</option></select></label><button class="uvbtn pri">Créer le titre</button></form>';
  } else if (tab === "to") {
    const L = (G.tours || []).filter(t => t.fed === G.me).slice().reverse(), RN = ["Quarts de finale", "Demi-finales", "Finale"];
    body = L.map(t => '<div class="uvcard"><div class="uvrow"><b class="uvgrow">' + esc(t.n) + "</b>" + (t.win ? '<span class="uvstat ok">Vainqueur : ' + esc(wn(G, t.win)) + "</span>" : "") + '</div><div class="uvbr">' + t.r.map((r, i) => '<div class="uvbrc"><small>' + RN[i] + "</small>" + r.map(m => '<div class="uvbrm"><span' + (m.w === m.a ? ' class="w"' : "") + ">" + esc(wn(G, m.a)) + "</span><span" + (m.w === m.b ? ' class="w"' : "") + ">" + esc(m.b ? wn(G, m.b) : "?") + "</span></div>").join("") + "</div>").join("") + "</div>" +
      '<div class="uvrow2">' + (t.win ? "" : '<button type="button" class="uvbtn pri" data-act="uvtoplay" data-t="' + esc(t.id) + '">Jouer : ' + RN[t.cur] + "</button>") + '<button type="button" class="uvbtn sm del" data-act="uvtodel" data-t="' + esc(t.id) + '">Supprimer</button></div></div>').join("") +
      '<form class="uvcard uvform" data-form="uvtonew"><h3 class="uvh3">Nouveau tournoi à 8</h3><p class="uvsm">Les 8 catcheurs les plus populaires de la division, en forme, sont pris. Chaque tour se joue quand tu veux (fatigue comprise).</p><label class="uvfld">Nom<input name="n" maxlength="50" required placeholder="Ex. : King of the Ring"></label><label class="uvfld">Division<select name="div">' + G.divs.filter(d => d.id !== "tag").map(d => '<option value="' + esc(d.id) + '">' + esc(d.n) + "</option>").join("") + '</select></label><button class="uvbtn pri">Créer le tournoi</button></form>';
  } else {
    const pts = w => w.rec[0] * 3 + w.rec[2];
    body = '<p class="uvsm">3 points par victoire, 1 par draw (cette année).</p>' + G.divs.filter(d => d.id !== "tag").map(d => { const L = R.filter(w => divOf(G, w) === d.id).sort((a, b) => pts(b) - pts(a) || b.pop - a.pop).slice(0, 10); if (!L.length) return "";
      return '<h3 class="uvh3">' + esc(d.n) + '</h3><ol class="uvrank">' + L.map(w => '<li><a href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 28) + '<span class="uvgrow">' + esc(w.n) + "<small>" + recTxt(w.rec) + "</small></span><b>" + pts(w) + " pts</b></a></li>").join("") + "</ol>"; }).join("") +
      (G.teams.some(t => t.fed === G.me) ? '<h3 class="uvh3">Équipes</h3><ol class="uvrank">' + G.teams.filter(t => t.fed === G.me).sort((a, b) => b.chem - a.chem).map(t => "<li><span class=\"uvgrow\">" + esc(t.n) + "<small>" + esc(teamName(G, t.m)) + "</small></span><b>" + t.chem + "</b></li>").join("") + "</ol>" : "");
  }
  return shell("creatif", "Créatif", T, body);
}
// divisions
ACT.uvdved = el => { U.f.dved = el.dataset.d; redraw(); };
FORM.uvdvren = f => { const d = U.G.divs.find(x => x.id === f.dataset.d), n = f.n.value.trim(); if (d && n) d.n = n; U.f.dved = ""; done(); };
FORM.uvdvnew = f => { const n = f.n.value.trim(); if (!n) return; U.G.divs.push({ id: uid("d"), n: n, c: true }); done(); };
FORM.uvdvadd = f => {
  const G = U.G, w = G.W[f.w.value], d = f.dataset.d; if (!w) return;
  G.dv = G.dv || {};
  if (d === "h" || d === "f") { w.sx = d; delete G.dv[w.id]; } else G.dv[w.id] = d;
  done();
};
ACT.uvdvrm = el => { const G = U.G; delete (G.dv || {})[el.dataset.w]; done(); };
ACT.uvdvdel = el => { const G = U.G, id = el.dataset.d; ask("Supprimer cette division ?", "Supprimer", () => { G.divs = G.divs.filter(x => x.id !== id); Object.keys(G.dv || {}).forEach(k => { if (G.dv[k] === id) delete G.dv[k]; }); done(); }); };
// storylines
ACT.uvslgen = () => {
  const G = U.G, t = document.getElementById("uvslt"), tu = document.getElementById("uvslturn");
  U.f.gtxt = t ? t.value : ""; U.f.gturn = tu ? tu.value : "";
  const I = genSL(G, U.f.gtxt, U.f.gturn); if (!I) { toast("Il faut au moins 2 catcheurs disponibles"); return; }
  U.f.gen = I; redraw();
};
ACT.uvsllaunch = () => {
  const G = U.G, I = U.f.gen; if (!I) return;
  G.sl.push({ id: uid("s"), fed: G.me, n: I.n, p: I.p, a: I.a, b: I.b, len: I.len, wk: 0, heat: 25, turn: I.turn, done: false, from: G.day });
  news(G, { seg: "ecran", f: "nous", t: "Nouvelle rivalité : " + teamName(G, I.a) + " contre " + teamName(G, I.b), txt: I.p });
  U.f.gen = null; U.f.gtxt = ""; toast("Storyline lancée !"); done();
};
ACT.uvsled = el => { U.f.sled = el.dataset.s; redraw(); };
FORM.uvsledit = f => {
  const G = U.G, s = G.sl.find(x => x.id === f.dataset.s); if (!s) return;
  s.n = f.n.value.trim() || s.n; s.len = +f.len.value || s.len;
  const v = f.turn.value; s.turn = v ? { w: v.split(":")[0], to: v.split(":")[1] } : null;
  U.f.sled = ""; done();
};
ACT.uvsldel = el => { const G = U.G, id = el.dataset.s; ask("Supprimer cette storyline ?", "Supprimer", () => { G.sl = G.sl.filter(x => x.id !== id); done(); }); };
FORM.uvslnew = f => {
  const G = U.G, a = f.a.value, b = f.b.value; if (!a || !b || a === b) { toast("Choisis deux catcheurs différents"); return; }
  const tv = f.turn.value, tw = tv === "a" ? a : tv === "b" ? b : "";
  G.sl.push({ id: uid("s"), fed: G.me, n: f.n.value.trim() || wn(G, a) + " contre " + wn(G, b), a: [a], b: [b], len: +f.len.value || 5, wk: 0, heat: 20, turn: tw ? { w: tw, to: G.W[tw].al === "heel" ? "face" : "heel" } : null, done: false, from: G.day });
  toast("Storyline créée"); done();
};
// clans et équipes
const grOf = (G, id) => G.clans.find(x => x.id === id) || G.teams.find(x => x.id === id);
ACT.uvgrdel = el => { const G = U.G, id = el.dataset.g; ask("Supprimer « " + ((grOf(G, id) || {}).n || "") + " » ?", "Supprimer", () => { G.clans = G.clans.filter(x => x.id !== id); G.teams = G.teams.filter(x => x.id !== id); done(); }); };
ACT.uvgrrm = el => { const G = U.G, g = grOf(G, el.dataset.g); if (!g) return; if (g.m.length <= 3) { toast("Un clan garde au moins 3 membres"); return; } g.m = g.m.filter(i => i !== el.dataset.w); done(); };
FORM.uvgradd = f => { const G = U.G, g = grOf(G, f.dataset.g), w = f.w.value; if (!g || !w || g.m.indexOf(w) >= 0) return; if (g.m.length >= 8) { toast("8 membres au maximum"); return; } g.m.push(w); done(); };
FORM.uvgrnew = f => {
  const G = U.G, isC = f.dataset.t === "cl", m = [f.m1.value, f.m2.value].concat(isC ? [f.m3.value] : []).filter(Boolean);
  if (m.length < (isC ? 3 : 2) || new Set(m).size !== m.length) { toast("Choisis des membres différents"); return; }
  const n = f.n.value.trim(); if (!n) return;
  if (isC) G.clans.push({ id: uid("c"), fed: G.me, n: n, m: m, al: G.W[m[0]].al }); else G.teams.push({ id: uid("t"), fed: G.me, n: n, m: m, chem: 50 });
  toast((isC ? "Clan" : "Équipe") + " créé" + (isC ? "" : "e")); done();
};
// titres
FORM.uvtch = f => {
  const G = U.G, t = G.T[f.dataset.t], v = f.w.value; if (!t || !v) return;
  if (t.div === "tag") { const tm = G.teams.find(x => x.id === v); if (!tm) return; t.champ = tm.m.slice(0, 2); } else t.champ = v;
  t.since = G.day; t.defs = 0;
  champIds(t).forEach(i => { const w = G.W[i]; if (w) { w.hist.push({ d: G.day, t: "Nommé" + e_(w) + " champion" + (w.sx === "f" ? "ne" : "") + " : " + t.n }); w.mor = clamp(w.mor + 8); } });
  news(G, { seg: "ecran", f: "nous", t: champName(G, t) + " : " + t.n, txt: "Le GM a décidé : " + champName(G, t) + " devient champion" + (t.div === "f" ? "ne" : "") + "." });
  done();
};
ACT.uvtvac = el => { const t = U.G.T[el.dataset.t]; if (!t) return; t.champ = t.div === "tag" ? [] : ""; t.since = U.G.day; done(); };
ACT.uvtdel = el => { const G = U.G, t = G.T[el.dataset.t]; if (!t) return; ask("Supprimer le titre « " + t.n + " » ?", "Supprimer", () => { delete G.T[t.id]; done(); }); };
FORM.uvtnew = f => { const G = U.G, n = f.n.value.trim(); if (!n) return; const id = uid("t"); G.T[id] = { id: id, fed: G.me, n: n, div: f.div.value, champ: f.div.value === "tag" ? [] : "", since: G.day, defs: 0 }; toast("Titre créé : choisis son champion ou fais un tournoi"); done(); };
// tournois
FORM.uvtonew = f => {
  const G = U.G, n = f.n.value.trim(), d = f.div.value; if (!n) return;
  const L = mine(G).filter(w => divOf(G, w) === d && avail(G, w)).slice(0, 8);
  if (L.length < 8) { toast("Il faut 8 catcheurs disponibles dans cette division (" + L.length + ")"); return; }
  const s = [0, 7, 3, 4, 1, 6, 2, 5].map(i => L[i].id);
  G.tours = G.tours || []; G.tours.push({ id: uid("o"), fed: G.me, n: n, div: d, r: [[0, 2, 4, 6].map(i => ({ a: s[i], b: s[i + 1], w: "" }))], cur: 0, win: "" });
  news(G, { seg: "ecran", f: "nous", t: "Tournoi : " + n, txt: "8 catcheurs pour une seule place au sommet." }); done();
};
ACT.uvtoplay = el => {
  const G = U.G, t = (G.tours || []).find(x => x.id === el.dataset.t); if (!t || t.win) return;
  const round = t.r[t.cur], out = [];
  round.forEach(m => {
    if (m.w) return;
    const A = G.W[m.a], B = G.W[m.b];
    if (!avail(G, A) || !avail(G, B)) { m.w = avail(G, A) ? m.a : m.b; out.push(wn(G, m.w) + " gagne par forfait"); return; }
    const r = playMatch(G, { a: [m.a], b: [m.b], kind: "simple", dur: "moyen", win: "ia", spots: [] }, { ev: t.n });
    let w = r ? r.win : "a"; if (w === "nul") w = rnd() < 0.5 ? "a" : "b";
    m.w = w === "a" ? m.a : m.b; m.r = r ? r.r : 50; out.push(wn(G, m.w) + " (" + stars(m.r) + ")");
  });
  if (round.length === 1) {
    t.win = round[0].w; const w = G.W[t.win];
    if (w) { w.pop = clamp(w.pop + 4, 1, 99); w.mor = clamp(w.mor + 10); w.hist.push({ d: G.day, t: "Remporte le tournoi " + t.n }); }
    news(G, { seg: "ecran", f: "nous", t: wn(G, t.win) + " remporte " + t.n, txt: "Victoire en finale contre " + wn(G, round[0].w === round[0].a ? round[0].b : round[0].a) + "." });
    toast(wn(G, t.win) + " remporte le tournoi !");
  } else {
    const nx = []; for (let i = 0; i < round.length; i += 2) nx.push({ a: round[i].w, b: round[i + 1].w, w: "" });
    t.r.push(nx); t.cur++; toast("Qualifiés : " + out.join(", "));
  }
  done();
};
ACT.uvtodel = el => { const G = U.G, id = el.dataset.t; ask("Supprimer ce tournoi ?", "Supprimer", () => { G.tours = G.tours.filter(x => x.id !== id); done(); }); };

// ======================= ACTIVITÉ =======================
const MER = { "T-shirt": 25, "Casquette": 20, "Figurine": 40, "Poster": 12 };
const PUB = [
  { re: /autographe|centre|fan|dédicace|dedicace/, n: "Séance d’autographes au centre commercial", cost: 15, pop: 1, hype: 0.5, risk: 0 },
  { re: /télé|tele|tv|émission|emission|matin/, n: "Passage dans une émission de télé du matin", cost: 40, pop: 2, hype: 1, risk: 0.1 },
  { re: /réseau|reseau|tiktok|insta|défi|defi|vidéo|video/, n: "Défi sur les réseaux sociaux", cost: 5, pop: 1.5, hype: 1, risk: 0.25 },
  { re: /film|cinéma|cinema|série|serie/, n: "Rôle dans un film d’action", cost: 80, pop: 3, hype: 1.5, risk: 0.1 },
  { re: /bagarre|presse|conférence|conference|clash/, n: "Bagarre « improvisée » en conférence de presse", cost: 25, pop: 2.5, hype: 2, risk: 0.3 },
  { re: /hôpital|hopital|enfant|école|ecole|charité|charite/, n: "Visite d’un hôpital pour enfants", cost: 10, pop: 1.5, hype: 0.5, risk: 0, mor: 5 }
];
const EVN1 = ["Night of", "Clash of", "Kings of", "Road to", "Rise of", "Storm of", "Battle of", "Throne of"], EVN2 = ["Champions", "Fury", "Glory", "Chaos", "Legends", "Steel", "Thunder", "Honor"];
const EVTH = [
  { re: /cage|acier|steel/, n: "Steel Cage Night", p: "Une soirée où le main event se joue dans une cage d’acier." },
  { re: /rumble|bataille|royal|30/, n: "Royal Battle", p: "Une grande bataille royale : le vainqueur obtient un match de titre." },
  { re: /femme|women|féminin|feminin|reine|queen/, n: "Queens of the Ring", p: "Un événement 100 % féminin, avec le titre féminin en main event." },
  { re: /légende|legende|legend|hommage/, n: "Legends Night", p: "Une soirée hommage, avec des invités surprises du passé." },
  { re: /noël|noel|hiver|neige/, n: "Winter Clash", p: "Le grand show de l’hiver, décor de neige et ambiance de fête." },
  { re: /été|ete|plage|summer/, n: "Summer Heat", p: "Le grand show de l’été en plein air." }
];
const nextFreeSat = (G, from) => { let d = from; while (dateOf(d).wd !== 6 || G.ev.some(e => e.fed === G.me && e.day === d)) d++; return d; };
function genIdea(G, ty, txt) {
  const low = (txt || "").toLowerCase(), R = mine(G);
  if (ty === "ev") {
    const th = EVTH.find(t => t.re.test(low)) || (rnd() < 0.4 ? pick(EVTH) : { n: pick(EVN1) + " " + pick(EVN2), p: "Un grand événement pour faire monter les storylines en cours." });
    const fem = /Queens/.test(th.n), L = R.filter(w => avail(G, w) && (fem ? w.sx === "f" : true)), me = L.slice(0, 2);
    return { ty: ty, n: th.n, p: th.p + (me.length === 2 ? " Main event conseillé : " + me[0].n + " contre " + me[1].n + "." : ""), day: nextFreeSat(G, G.day + 21) };
  }
  const st = PUB.find(t => t.re.test(low)) || pick(PUB), named = R.find(w => low && w.n.toLowerCase().split(/\s+/).some(p => p.length > 2 && low.indexOf(p) >= 0));
  const w = named || R[Math.floor(rnd() * Math.min(5, R.length))];
  return { ty: ty, n: st.n, cost: st.cost, pop: st.pop, hype: st.hype, risk: st.risk, mor: st.mor || 0, w: w ? w.id : "", p: (w ? "Avec " + w.n + ". " : "") + "Coût : " + st.cost + " k$. Popularité en hausse" + (st.risk ? ", mais ça peut mal tourner (" + Math.round(st.risk * 100) + " % de risque)." : ".") };
}
export function activiteView(tab) {
  const G = U.G, f = meF(G); tab = tab || "ev";
  const T = tabs("#/univers/activite", [["ev", "Événements"], ["ct", "Contrats TV et pub"], ["fin", "Finances"], ["mer", "Merchandising"], ["idee", "Générateur d’idées"]], tab);
  let body = "";
  if (tab === "ev") {
    const up = G.ev.filter(e => e.fed === G.me && !e.done).sort((a, b) => a.day - b.day), past = G.ev.filter(e => e.fed === G.me && e.done).sort((a, b) => b.day - a.day).slice(0, 12);
    const evImg = e => { const s = imgEv(G, e); return s ? '<img class="uvevimg" src="' + esc(s) + '" alt="">' : crest(G, G.me, 52); };
    body = up.slice(0, 24).map(e => '<div class="uvev' + (big(e) ? " big" : "") + '">' + evImg(e) + '<div class="uvgrow"><b>' + esc(e.n) + "</b><small>" + esc(dayLabel(e.day)) + " · " + kindL(e) + (e.day === G.day ? " · ce soir" : "") + "</small>" +
      (big(e) ? "<small>Hype " + Math.round(G.hype[e.id] || 3) + " / 10</small>" : "") + (e.card && e.card.length ? '<small class="uvok">Carte prête : ' + e.card.length + " match" + (e.card.length > 1 ? "s" : "") + "</small>" : "") +
      '</div><div class="uvcol"><a class="uvbtn sm pri" href="#/univers/ev/' + encodeURIComponent(e.id) + '">' + (e.day === G.day ? "Jouer" : "Préparer") + '</a><div class="uvrow2">' + imgBtn("e:" + e.fed + "|" + e.n, "🖼️") + (e.day > G.day ? '<button type="button" class="uvbtn sm ghost" data-act="uvevdel" data-id="' + esc(e.id) + '" aria-label="Supprimer ' + esc(e.n) + '">✕</button>' : "") + "</div></div></div>").join("") +
      '<details class="uvdet"><summary>Créer un événement</summary><form class="uvform" data-form="uvevnew"><label class="uvfld">Nom<input name="n" maxlength="40" required placeholder="Ex. : Night of Glory"></label>' +
      '<label class="uvfld">Type<select name="k"><option value="big">Grand événement (' + (f.big === "PLE" ? "PLE" : "PPV") + ')</option><option value="tv">Épisode spécial (TV)</option></select></label>' +
      '<label class="uvfld">Date<select name="d">' + Array.from({ length: 120 }, (x, i) => G.day + 1 + i).map(d => '<option value="' + d + '"' + (dateOf(d).wd === 6 && d >= G.day + 14 && d < G.day + 21 ? " selected" : "") + ">" + esc(dayLabel(d, true)) + "</option>").join("") + '</select></label><button class="uvbtn pri">Créer</button></form></details>' +
      (past.length ? '<h3 class="uvh3">Déjà joués</h3>' + past.map(e => '<a class="uvline" href="#/univers/ev/' + encodeURIComponent(e.id) + '"><span class="uvdate">' + esc(shortDate(e.day)) + '</span><span class="uvgrow">' + esc(e.n) + "</span><b>" + (e.res ? stars(e.res.r) + " · " + fmtM(e.res.aud) : "") + "</b></a>").join("") : "");
  } else if (tab === "ct") {
    const sp = (G.spons || []).filter(s => s.until > G.day), cd = (G.spSeek || -99) + 14 - G.day;
    body = '<div class="uvtile"><div class="uvth">Contrat TV <i>' + esc(f.tv.n) + '</i></div><div class="uvkv"><span>Par show</span>' + fmtK(f.tv.pay) + '</div><div class="uvkv"><span>Objectif d’audience</span>' + fmtM(f.tv.min) + '</div><div class="uvkv"><span>Fin</span>' + esc(dayLabel(f.tv.end, true)) + '</div><p class="uvsm">Le diffuseur proposera un nouveau contrat un mois avant la fin (dans le courrier). Une bonne audience = un meilleur contrat.</p></div>' +
      '<h3 class="uvh3">Sponsors</h3>' + (sp.length ? sp.map(s => '<div class="uvcard"><div class="uvkv"><span><b>' + esc(s.n) + "</b></span>" + fmtK(s.pay) + ' par show</div><p class="uvsm">Payé si l’audience dépasse ' + fmtM(s.min) + " · jusqu’au " + esc(shortDate(s.until)) + "</p></div>").join("") : '<p class="uvempty">Aucun sponsor pour l’instant.</p>') +
      '<button type="button" class="uvbtn pri" data-act="uvspseek"' + (cd > 0 ? " disabled" : "") + ">" + (cd > 0 ? "Chercher un sponsor (dans " + cd + " j)" : "Chercher un sponsor") + "</button>";
  } else if (tab === "fin") {
    const c = G.fin.cur, inc = c.tv + c.tix + c.merch + c.pub, out = c.sal + c.prod, H = G.fin.hist.slice(-12);
    const sal = Math.round(roster(G).reduce((s, w) => s + (w.ct ? w.ct.sal : 0), 0) / 12);
    const net = h => h.tv + h.tix + h.merch + h.pub - h.sal - h.prod, mx = Math.max(1, ...H.map(h => Math.abs(net(h))));
    body = '<div class="uvtile"><div class="uvth">En banque</div><div class="uvbig' + (f.money < 0 ? " uvko" : "") + '">' + fmtK(f.money) + '</div><p class="uvsm">Salaires : environ ' + fmtK(sal) + " par mois (payés le 1er).</p></div>" +
      '<div class="uvtile"><div class="uvth">Ce mois-ci</div>' + [["Droits TV", c.tv], ["Billets", c.tix], ["Merchandising", c.merch], ["Sponsors", c.pub]].map(x => '<div class="uvkv"><span>' + x[0] + '</span><b class="uvok">+' + fmtK(x[1]) + "</b></div>").join("") +
      [["Salaires", c.sal], ["Production et dépenses", c.prod]].map(x => '<div class="uvkv"><span>' + x[0] + '</span><b class="uvko">-' + fmtK(x[1]) + "</b></div>").join("") + '<div class="uvkv tot"><span>Total</span><b class="' + (inc - out >= 0 ? "uvok" : "uvko") + '">' + fmtK(inc - out) + "</b></div></div>" +
      (H.length ? '<div class="uvtile"><div class="uvth">Mois précédents</div><div class="uvchart" role="img" aria-label="Bénéfice des derniers mois">' + H.map(h => { const v = net(h), ht = Math.max(3, Math.round(Math.abs(v) / mx * 46)); return '<div class="uvcb"><span class="up">' + (v >= 0 ? '<i style="height:' + ht + 'px"></i>' : "") + '</span><span class="dn">' + (v < 0 ? '<i style="height:' + ht + 'px"></i>' : "") + "</span><small>" + MONTHS[h.m] + "</small></div>"; }).join("") + "</div>" +
        H.slice().reverse().slice(0, 4).map(h => '<div class="uvkv"><span>' + MONTHS[h.m] + " An " + h.y + '</span><b class="' + (net(h) >= 0 ? "uvok" : "uvko") + '">' + fmtK(net(h)) + "</b></div>").join("") + "</div>" : '<p class="uvempty">Le bilan du premier mois arrive le 1er février.</p>');
  } else if (tab === "mer") {
    const P = (G.merch || []).filter(p => G.W[p.w]);
    body = '<p class="uvsm">Les ventes dépendent de la popularité du catcheur et du prix. Elles sont comptées chaque mois.</p>' +
      (P.length ? P.map(p => { const w = G.W[p.w]; return '<div class="uvcard uvrow">' + face(G, w, 40) + '<div class="uvgrow"><b>' + esc(p.type) + " " + esc(w.n) + "</b><small>" + p.price + " $ · " + (p.sold != null ? p.sold + " vendus le mois dernier · " : "") + (p.tot || 0) + ' au total</small></div><button type="button" class="uvbtn sm ghost" data-act="uvmerdel" data-id="' + esc(p.id) + '">Arrêter</button></div>'; }).join("") : '<p class="uvempty">Aucun produit en vente.</p>') +
      '<form class="uvcard uvform" data-form="uvmernew"><h3 class="uvh3">Nouveau produit (10 k$)</h3><label class="uvfld">Catcheur<select name="w" required>' + wOpts(G, "") + '</select></label><label class="uvfld">Produit<select name="t">' + Object.keys(MER).map(k => '<option value="' + esc(k) + '">' + esc(k) + " (conseillé " + MER[k] + " $)</option>").join("") + '</select></label><label class="uvfld">Prix en $<input type="number" name="p" min="5" max="99" value="25" required></label><button class="uvbtn pri">Lancer le produit</button></form>';
  } else {
    const I = U.f.agen;
    body = '<div class="uvtile uvgen"><div class="uvth">Générateur d’idées</div><p class="uvsm">Une idée d’événement (cage, femmes, légendes, hiver…) ou un coup de pub (télé, réseaux, film, autographes…). Écris quelques mots ou laisse vide.</p>' +
      '<input id="uvagt" class="uvin" maxlength="120" value="' + esc(U.f.agtxt || "") + '" placeholder="Ex. : un show dans une cage" aria-label="Quelques mots pour ton idée">' +
      '<div class="uvrow2"><button type="button" class="uvbtn pri" data-act="uvagen" data-ty="ev">Idée d’événement</button><button type="button" class="uvbtn pri" data-act="uvagen" data-ty="pub">Coup de pub</button></div>' +
      (I ? '<div class="uvidea"><b>' + esc(I.n) + "</b><p>" + esc(I.p) + "</p>" + (I.ty === "ev" ? '<p class="uvsm">Date proposée : ' + esc(dayLabel(I.day, true)) + '</p><button type="button" class="uvbtn pri" data-act="uvagdo">Créer cet événement</button>' : '<button type="button" class="uvbtn pri" data-act="uvagdo">Lancer (' + I.cost + " k$)</button>") + "</div>" : "") + "</div>";
  }
  return shell("activite", "Activité", T, body);
}
FORM.uvevnew = f => {
  const G = U.G, n = f.n.value.trim(), d = +f.d.value; if (!n || !(d > G.day)) return;
  const kind = f.k.value === "tv" ? "tv" : meF(G).big === "PLE" ? "ple" : "ppv";
  G.ev.push({ id: uid(G.me + "-ev"), fed: G.me, n: n, kind: kind, day: d, card: [], seg: [], done: false });
  if (kind !== "tv") G.hype[G.ev[G.ev.length - 1].id] = 3;
  toast("Événement créé : " + n + " (" + shortDate(d) + ")"); done();
};
ACT.uvevdel = el => { const G = U.G, e = G.ev.find(x => x.id === el.dataset.id); if (!e) return; ask("Supprimer « " + e.n + " » du " + shortDate(e.day) + " ?", "Supprimer", () => { G.ev = G.ev.filter(x => x !== e); if (e.kind === "tv") { G.noTv = G.noTv || []; G.noTv.push(e.id); } done(); }); };
ACT.uvspseek = () => {
  const G = U.G, f = meF(G); if ((G.spSeek || -99) + 14 > G.day) return;
  G.spSeek = G.day;
  if (rnd() < 0.3 + f.pop / 200) { const pay = Math.round((15 + f.pop * 1.6) / 5) * 5, min = Math.round(f.aud0 * 0.9 * 100) / 100; mail(G, { k: "sponsor", from: pick(["Volt Energy", "Titan Gym", "Rapido Pizza", "Nova Phone", "Iron Cola", "Kraken Games"]), role: "Sponsor", c: "#ffd27a", ini: "SP", subj: "Offre de pub : " + pay + " k$ par show", body: "Nous voulons notre logo sur ton ring pendant 6 mois.\n" + pay + " k$ par show, si l’audience reste au-dessus de " + fmtM(min) + ".", pay: pay, min: min }); toast("Une offre arrive dans ton courrier !"); }
  else toast("Personne pour l’instant. Réessaie dans 2 semaines.");
  done();
};
FORM.uvmernew = f => {
  const G = U.G, w = f.w.value, p = Math.max(5, Math.min(99, +f.p.value || 25)); if (!w || !pay(G, 10)) return;
  G.merch.push({ id: uid("p"), w: w, type: f.t.value, price: p, tot: 0 }); toast("Produit lancé : " + f.t.value + " " + wn(G, w)); done();
};
ACT.uvmerdel = el => { const G = U.G; G.merch = G.merch.filter(p => p.id !== el.dataset.id); done(); };
ACT.uvagen = el => { const t = document.getElementById("uvagt"); U.f.agtxt = t ? t.value : ""; U.f.agen = genIdea(U.G, el.dataset.ty, U.f.agtxt); redraw(); };
ACT.uvagdo = () => {
  const G = U.G, I = U.f.agen, f = meF(G); if (!I) return;
  if (I.ty === "ev") { const id = uid(G.me + "-ev"); G.ev.push({ id: id, fed: G.me, n: I.n, kind: f.big === "PLE" ? "ple" : "ppv", day: I.day, card: [], seg: [], done: false }); G.hype[id] = 3; toast("Événement créé : " + I.n + " (" + shortDate(I.day) + ")"); }
  else {
    if (!pay(G, I.cost)) return;
    const w = G.W[I.w], nb = G.ev.filter(e => e.fed === G.me && big(e) && !e.done && e.day >= G.day).sort((a, b) => a.day - b.day)[0];
    if (rnd() < I.risk) { f.pop = clamp(f.pop - 1, 5, 99); if (w) buzz(G, { f: "fans", who: "Fan de catch", at: "@fan_de_catch", ini: "FA", c: "#ff8a7e", txt: "Le coup de pub de " + f.n + " avec " + w.n + "… gênant. 😬" }); toast("Raté : le public n’a pas aimé."); }
    else {
      f.pop = clamp(f.pop + I.pop, 5, 99); if (nb) G.hype[nb.id] = clamp((G.hype[nb.id] || 3) + I.hype, 0, 10);
      if (w) { w.pop = clamp(w.pop + I.pop * 1.5, 1, 99); if (I.mor) w.mor = clamp(w.mor + I.mor); buzz(G, { f: "nous", who: w.n, at: "@" + w.n.replace(/\W+/g, "").toLowerCase().slice(0, 14), ini: ini(w.n), c: "#f5b13d", txt: pick(["Merci à tous d’être venus !", "Quelle journée ! On se voit au prochain show.", "Vous êtes les meilleurs fans du monde."]) }); }
      news(G, { seg: "coul", f: "nous", t: I.n, txt: f.n + " fait parler de lui" + (w ? " grâce à " + w.n : "") + "." });
      toast("Réussi : ta fédération fait parler d’elle !");
    }
  }
  U.f.agen = null; done();
};

// ======================= LA CARTE D'UN SHOW =======================
const NEWM = () => ({ a: [], b: [], kind: "simple", title: "", dur: "moyen", win: "ia", spots: [] });
function sideSel(G, name, v, lbl) { return '<select name="' + name + '" aria-label="' + esc(lbl) + '">' + wOpts(G, v || "", { book: true }) + "</select>"; }
function titleOpts(G, m) {
  const L = Object.values(G.T).filter(t => t.fed === G.me && (m.kind === "equipe" ? t.div === "tag" : t.div !== "tag"));
  return '<option value="">' + (m.kind === "equipe" ? "Pas de titre" : "— Quel titre ? —") + "</option>" + L.map(t => '<option value="' + esc(t.id) + '"' + (t.id === m.title ? " selected" : "") + ">" + esc(t.n) + " (" + esc(champName(G, t)) + ")</option>").join("");
}
function matchBox(G, ev, m, i, n) {
  const tag = m.kind === "equipe", sl = m.a[0] && m.b[0] ? heatBetween(G, m.a, m.b) : null, tired = m.a.concat(m.b).some(id => G.W[id] && G.W[id].en < 40);
  return '<fieldset class="uvmatch"><legend>' + (i === n - 1 && n > 1 ? "Main event" : "Match " + (i + 1)) + "</legend>" +
    '<div class="uvrow2"><select name="k' + i + '" aria-label="Type de match"><option value="simple"' + (m.kind === "simple" ? " selected" : "") + '>Simple</option><option value="titre"' + (m.kind === "titre" ? " selected" : "") + '>Pour un titre</option><option value="equipe"' + (tag ? " selected" : "") + ">Par équipes</option></select>" +
    (m.kind !== "simple" ? '<select name="t' + i + '" aria-label="Titre en jeu">' + titleOpts(G, m) + "</select>" : "") + "</div>" +
    '<div class="uvsides"><div>' + sideSel(G, "a" + i + "_0", m.a[0], "Camp 1") + (tag ? sideSel(G, "a" + i + "_1", m.a[1], "Camp 1, partenaire") : "") + '</div><i>contre</i><div>' + sideSel(G, "b" + i + "_0", m.b[0], "Camp 2") + (tag ? sideSel(G, "b" + i + "_1", m.b[1], "Camp 2, partenaire") : "") + "</div></div>" +
    '<div class="uvrow2"><label class="uvmini">Durée<select name="d' + i + '">' + Object.keys(DUR).map(k => '<option value="' + k + '"' + (m.dur === k ? " selected" : "") + ">" + DUR[k][0] + " (" + DUR[k][1] + " min)</option>").join("") + "</select></label>" +
    '<label class="uvmini">Vainqueur<select name="w' + i + '"><option value="ia"' + (m.win === "ia" ? " selected" : "") + '>L’IA décide</option><option value="a"' + (m.win === "a" ? " selected" : "") + '>Camp 1</option><option value="b"' + (m.win === "b" ? " selected" : "") + '>Camp 2</option><option value="nul"' + (m.win === "nul" ? " selected" : "") + ">Draw</option></select></label></div>" +
    '<div class="uvspots" role="group" aria-label="Moments forts">' + Object.keys(SPOTS).map(k => '<label class="uvspot"><input type="checkbox" name="s' + i + '" value="' + k + '"' + ((m.spots || []).indexOf(k) >= 0 ? " checked" : "") + "><span>" + SPOTS[k][0] + "</span></label>").join("") + "</div>" +
    (sl || tired ? '<p class="uvsm">' + (sl ? '<span class="uvhot">Storyline « ' + esc(sl.n) + " » : heat " + sl.heat + "</span> " : "") + (tired ? '<span class="uvko">Quelqu’un est fatigué : le match sera moins bon et le risque de blessure monte.</span>' : "") + "</p>" : "") +
    '<div class="uvrow2">' + (i > 0 ? '<button type="button" class="uvbtn sm ghost" data-act="uvbmv" data-ev="' + esc(ev.id) + '" data-i="' + i + '">Monter</button>' : "") + '<button type="button" class="uvbtn sm del" data-act="uvbdel" data-ev="' + esc(ev.id) + '" data-i="' + i + '">Retirer</button></div></fieldset>';
}
function resultsView(G, ev) {
  const r = ev.res || {}, im = imgEv(G, ev), mineEv = ev.fed === G.me;
  const line = m => { const A = teamName(G, m.a), B = teamName(G, m.b), t = m.title && G.T[m.title];
    return '<div class="uvres"><div class="uvrow"><span class="uvgrow">' + (m.win === "a" ? "<b>" + esc(A) + "</b> bat " + esc(B) : m.win === "b" ? "<b>" + esc(B) + "</b> bat " + esc(A) : esc(A) + " et " + esc(B) + " : draw") + '</span><span class="uvstar">' + stars(m.r) + "</span></div>" +
      (t ? '<small class="' + (m.change ? "uvhot" : "uvmut") + '">' + (m.change ? "Nouveau champion : " : "Le champion garde son titre : ") + esc(t.n) + "</small>" : "") + (m.notes || []).map(x => '<small class="uvko">' + esc(x) + "</small>").join("") + "</div>"; };
  const body = '<a class="uvback" href="#/univers/' + (mineEv ? "activite/ev" : "g") + '">‹ Retour</a><div class="uvevhead">' + (im ? '<img class="uvevimg big" src="' + esc(im) + '" alt="">' : crest(G, ev.fed, 64)) + '<div class="uvgrow"><h2>' + esc(ev.n) + "</h2><small>" + esc(dayLabel(ev.day, true)) + " · " + kindL(ev) + "</small>" + (mineEv ? imgBtn("e:" + ev.fed + "|" + ev.n) : "") + "</div></div>" +
    '<div class="uvkv3"><div><b>' + stars(r.r || 0) + "</b>note</div><div><b>" + fmtM(r.aud || 0) + "</b>téléspectateurs</div>" + (r.money != null ? "<div><b class=\"" + (r.money >= 0 ? "uvok" : "uvko") + '">' + fmtK(r.money) + "</b>recettes</div>" : "") + "</div>" +
    (r.m ? '<h3 class="uvh3">Les matchs</h3>' + r.m.map(line).join("") : "") +
    (r.s && r.s.length ? '<h3 class="uvh3">Au micro</h3>' + r.s.map(s => '<div class="uvres"><div class="uvrow"><span class="uvgrow">Promo de <b>' + esc(wn(G, s.w)) + '</b></span><span class="uvstar">' + stars(s.r) + "</span></div></div>").join("") : "") +
    '<a class="uvbtn pri" href="#/univers/g">Menu général</a>';
  return shell(mineEv ? "activite" : "g", "Résultats", "", body);
}
export function bookView(id) {
  const G = U.G, ev = G.ev.find(e => e.id === id);
  if (!ev) return shell("activite", "Show", "", '<p class="uvempty">Ce show n’existe plus.</p><a class="uvbtn" href="#/univers/activite/ev">Mes événements</a>');
  if (ev.done || ev.fed !== G.me) return resultsView(G, ev);
  ev.card = ev.card || []; ev.seg = ev.seg || [];
  const today = ev.day === G.day, im = imgEv(G, ev);
  const body = '<a class="uvback" href="#/univers/activite/ev">‹ Mes événements</a><div class="uvevhead">' + (im ? '<img class="uvevimg big" src="' + esc(im) + '" alt="">' : crest(G, G.me, 64)) + '<div class="uvgrow"><h2>' + esc(ev.n) + "</h2><small>" + esc(dayLabel(ev.day, true)) + " · " + kindL(ev) + (big(ev) ? " · hype " + Math.round(G.hype[ev.id] || 3) + " / 10" : "") + "</small>" + imgBtn("e:" + ev.fed + "|" + ev.n) + "</div></div>" +
    (today ? "" : '<p class="uvsm">Ce show a lieu le ' + esc(dayLabel(ev.day)) + " : ta carte est gardée jusque-là.</p>") +
    '<form id="uvbook" class="uvbook" data-ev="' + esc(ev.id) + '" onsubmit="return false">' + ev.card.map((m, i) => matchBox(G, ev, m, i, ev.card.length)).join("") +
    '<fieldset class="uvmatch"><legend>Segments au micro</legend>' + ev.seg.map((s, j) => '<div class="uvrow2"><select name="p' + j + '" aria-label="Segment ' + (j + 1) + '">' + wOpts(G, s.w, { book: true }) + '</select><button type="button" class="uvbtn sm del" data-act="uvpdel" data-ev="' + esc(ev.id) + '" data-i="' + j + '">Retirer</button></div>').join("") +
    '<button type="button" class="uvbtn sm" data-act="uvpadd" data-ev="' + esc(ev.id) + '">Ajouter une promo</button></fieldset></form>' +
    '<div class="uvrow2"><button type="button" class="uvbtn" data-act="uvbadd" data-ev="' + esc(ev.id) + '">Ajouter un match</button><button type="button" class="uvbtn ghost" data-act="uvbauto" data-ev="' + esc(ev.id) + '">Carte faite par l’IA</button>' + (ev.card.length ? '<button type="button" class="uvbtn ghost" data-act="uvbclear" data-ev="' + esc(ev.id) + '">Tout effacer</button>' : "") + "</div>" +
    (today ? '<button type="button" class="uvbtn pri big" data-act="uvbplay" data-ev="' + esc(ev.id) + '">Jouer le show</button>' : "");
  return shell("activite", "La carte du show", "", body);
}
const evOf = el => U.G.ev.find(e => e.id === el.dataset.ev);
function readBook(f, ev) {
  const G = U.G, v = n => { const x = f.elements.namedItem(n); return x ? x.value : ""; };
  ev.card = ev.card.map((m, i) => {
    const kind = v("k" + i) || m.kind, tag = kind === "equipe", wasT = m.title;
    const nm = { kind: kind, a: [v("a" + i + "_0")].concat(tag ? [v("a" + i + "_1")] : []).filter(Boolean), b: [v("b" + i + "_0")].concat(tag ? [v("b" + i + "_1")] : []).filter(Boolean), title: kind === m.kind ? v("t" + i) : "", dur: v("d" + i) || "moyen", win: v("w" + i) || "ia", spots: Array.from(f.querySelectorAll('input[name="s' + i + '"]:checked')).map(x => x.value) };
    if (kind === "simple") nm.title = "";
    if (kind === "titre" && !nm.title) { const t = Object.values(G.T).find(t => t.fed === G.me && t.div !== "tag"); nm.title = t ? t.id : ""; }
    // le titre vient d'être choisi : le champion se met dans le camp 1
    if (nm.title && nm.title !== wasT) { const t = G.T[nm.title], c = t ? champIds(t).filter(id => G.W[id] && avail(G, G.W[id])) : []; if (c.length) { nm.b = nm.b.filter(id => c.indexOf(id) < 0); nm.a = tag ? c.slice(0, 2) : [c[0]]; } }
    return nm;
  });
  ev.seg = ev.seg.map((s, j) => ({ w: v("p" + j), kind: "promo" }));
}
if (typeof document !== "undefined") document.addEventListener("change", e => {
  const f = e.target.closest && e.target.closest("#uvbook"); if (!f || !U.G) return;
  const ev = U.G.ev.find(x => x.id === f.dataset.ev); if (!ev || ev.done) return;
  readBook(f, ev); done();
});
const syncBook = ev => { const f = document.getElementById("uvbook"); if (f && f.dataset.ev === ev.id) readBook(f, ev); };
ACT.uvbadd = el => { const ev = evOf(el); if (!ev) return; syncBook(ev); if (ev.card.length >= 10) { toast("10 matchs au maximum"); return; } ev.card.push(NEWM()); done(); };
ACT.uvbdel = el => { const ev = evOf(el); if (!ev) return; syncBook(ev); ev.card.splice(+el.dataset.i, 1); done(); };
ACT.uvbmv = el => { const ev = evOf(el), i = +el.dataset.i; if (!ev || i < 1) return; syncBook(ev); const x = ev.card[i]; ev.card[i] = ev.card[i - 1]; ev.card[i - 1] = x; done(); };
ACT.uvpadd = el => { const ev = evOf(el); if (!ev) return; syncBook(ev); if (ev.seg.length >= 3) { toast("3 promos au maximum"); return; } ev.seg.push({ w: "", kind: "promo" }); done(); };
ACT.uvpdel = el => { const ev = evOf(el); if (!ev) return; syncBook(ev); ev.seg.splice(+el.dataset.i, 1); done(); };
ACT.uvbauto = el => { const ev = evOf(el); if (!ev) return; autoCard(U.G, ev); toast("Carte faite par l’IA : tu peux encore la changer"); done(); };
ACT.uvbclear = el => { const ev = evOf(el); if (!ev) return; ev.card = []; ev.seg = []; done(); };
ACT.uvbplay = el => {
  const G = U.G, ev = evOf(el); if (!ev || ev.done) return; syncBook(ev);
  if (ev.day !== G.day) { toast("Ce show a lieu le " + dayLabel(ev.day)); return; }
  if (!ev.card.length) { toast("Ajoute au moins un match (ou « Carte faite par l’IA »)"); return; }
  const seen = new Set();
  for (let i = 0; i < ev.card.length; i++) {
    const m = ev.card[i], need = m.kind === "equipe" ? 2 : 1, nm = "Match " + (i + 1) + " : ";
    if (m.a.length < need || m.b.length < need) { toast(nm + "il manque des catcheurs"); return; }
    if (m.kind === "titre" && !m.title) { toast(nm + "choisis le titre en jeu"); return; }
    for (const id of m.a.concat(m.b)) { if (seen.has(id)) { toast(wn(G, id) + " est dans deux matchs"); return; } seen.add(id); if (!avail(G, G.W[id])) { toast(wn(G, id) + " ne peut pas catcher"); return; } }
    const t = m.title && G.T[m.title], c = t ? champIds(t) : [];
    if (c.length && !c.every(id => m.a.concat(m.b).indexOf(id) >= 0)) { toast(nm + "le champion (" + champName(G, t) + ") doit être dans le match"); return; }
  }
  ev.seg = ev.seg.filter(s => s.w && !seen.has(s.w) && avail(G, G.W[s.w]));
  playShow(G, ev);
  G.mail.forEach(m => { if (m.k === "show" && m.ev === ev.id && !m.done) { m.done = "Show joué."; m.read = true; } });
  persist(true); window.scrollTo(0, 0); redraw();
};
