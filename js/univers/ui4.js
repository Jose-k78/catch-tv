// Mode Univers v2 : la carte du show (tous les types de match, enjeux, fins, consignes, open challenge, segments, tournois,
// traditions, mallette), le show en direct depuis la Gorilla position, le rapport détaillé, les tournois, les traditions, le draft.
import { ACT, FORM } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { STYLES, MONTHS, dayLabel, shortDate, dateOf, fmtM, fmtK, stars, clamp, rnd, pick, uid } from "./world.js";
import { MT, STIP, FIN, CONS, DUR, ENT, SEG, VENUES, CITIES, GT } from "./data.js";
import { meF, wn, roster, avail, why, myStaff, isBig, champIds, teamName, sideName, e_, mail, ach } from "./base.js";
import { runTimer } from "./tv.js";
import { SPOTS, mtOf, idsOf, checkMatch, estimate, estimateShow, autoCard, pendingTour, prepShow, stepLive, orderLive, runShow, resLine, timeOf, itemMin, cityOf } from "./match.js";
import { createTour, saveTrad, cashIn, contenders, autoDraft, setBrand, caseOf } from "./crea.js";
import { advise, promoVideo } from "./biz.js";
import { guestsFor } from "./deal.js";
import { U, go, redraw, persist, shell, tabs, chips, face, crest, pickW, wnH, teamH, sidesH, whoIn, imgEv, imgT, imgBtn } from "./core.js";

const bar = (v, c) => '<span class="uvbar"><i style="width:' + clamp(v) + "%" + (c ? ";background:" + c : "") + '"></i></span>';
const MTG = [["Simples et équipes", ["simple", "tag", "mixte", "six", "huit", "handicap"]], ["À plusieurs", ["triple", "fatal4", "battle", "rumble", "gauntlet", "chamber"]], ["Avec du matériel", ["ladder", "tlc", "table", "cage", "cell", "wargames", "ultimatex"]], ["Règles spéciales", ["nodq", "lms", "iquit", "ironman", "falls", "sub", "lumber", "fca"]], ["Défi", ["open"]]];
const NEWM = (o) => Object.assign({ it: "m", t: "simple", sides: [[], []], title: "", stip: "", fin: "auto", cons: "", dur: "moyen", win: "ia", spots: [] }, o || {});
const evOf = el => U.G.ev.find(e => e.id === el.dataset.ev);
// qui peut être mis sur la carte de ce show : l'effectif, les invités (légendes, partenaires), les catcheurs prêtés chez nous
export function poolFor(G, ev) {
  const set = new Map(); roster(G).forEach(w => set.set(w.id, w));
  guestsFor(G, ev).forEach(i => { if (G.W[i]) set.set(i, G.W[i]); });
  if (ev.part) roster(G, ev.part).forEach(w => set.set(w.id, w));
  return Array.from(set.values()).sort((a, b) => b.pop - a.pop);
}
const okFor = (G, ev, w) => w && (w.ret ? guestsFor(G, ev).indexOf(w.id) >= 0 : avail(G, w, ev.day)) && !w.bench;
function wSel(G, ev, name, used, filter) {
  return '<button type="button" class="uvbtn sm uvaddw" data-act="uvpickw" data-k="' + name + '">+ Ajouter un catcheur</button>';
}
const wInfo = (G, ev, w) => { const ok = okFor(G, ev, w); return "Pop " + Math.round(w.pop) + " · endurance " + Math.round(w.en) + " %" + (ok ? (w.en < 40 ? " · fatigué" + e_(w) : "") + (w.ret ? " · légende" : w.fed !== G.me ? " · invité" + e_(w) : "") : " · " + why(G, w)); };
const usedIn = ev => ev.items.reduce((s, it) => s.concat(it.it === "m" ? idsOf(it) : it.w || []), []);

// ---------- la carte ----------
export function bookView(id) {
  const G = U.G, ev = G.ev.find(e => e.id === id);
  if (!ev) return shell("activite", "Show", "", '<p class="uvempty">Ce show n’existe plus.</p><a class="uvbtn" href="#/univers/activite/ev">Mes événements</a>');
  if (ev.done || ev.fed !== G.me) return resultsView(G, ev);
  if (!ev.items) ev.items = [];
  const f = meF(G), today = ev.day === G.day, im = imgEv(G, ev), est = estimateShow(G, ev), tm = timeOf(G, ev), len = ev.len || (isBig(ev) ? 240 : (f.slot || {}).len || 120);
  const c = cityOf(G, ev), tips = advise(G, ev).filter(t => !t[2]).slice(0, 4), live = U.live && U.live.ev === ev.id && !U.live.L.done;
  const comm = myStaff(G, "comm"), sel = ev.comm || comm.slice(0, 2).map(s => s.id);
  const head = '<a class="uvback" href="#/univers/activite/ev">‹ Mes événements</a><div class="uvevhead">' + (im ? '<img class="uvevimg big" src="' + esc(im) + '" alt="">' : crest(G, G.me, 64)) + '<div class="uvgrow"><h2>' + esc(ev.n) + "</h2><small>" + esc(dayLabel(ev.day, true)) + " · " + (c ? esc(c[0]) : "") + (isBig(ev) ? " · hype " + Math.round(G.hype[ev.id] || 3) + " / 10" : "") + (ev.part ? " · avec " + esc((G.F[ev.part] || {}).n || "") : "") + "</small>" + imgBtn("e:" + ev.fed + "|" + ev.n) + "</div></div>" +
    '<div class="uvtile uvest"><div class="uvrow"><span class="uvgrow">Note estimée</span><b class="uvstar">' + (est ? stars(est) : "—") + '</b></div><div class="uvst2 wide"><span>Durée ' + tm + " / " + len + " min</span>" + bar(tm / len * 100, tm > len + 10 ? "#ff8a7e" : tm < len - 40 ? "#ffd27a" : "#63d69c") + "<b>" + (tm > len ? "+" + (tm - len) : tm - len) + "</b></div>" +
    (tips.length ? '<ul class="uvtips">' + tips.map(t => "<li>" + esc(t[1]) + "</li>").join("") + "</ul>" : "") + "</div>" +
    '<details class="uvdet"><summary>Réglages du show</summary><form class="uvform" id="uvshowset" data-ev="' + esc(ev.id) + '" onsubmit="return false">' +
    (comm.length ? '<div class="uvfld">Commentateurs (3 au plus)<div class="uvchips wrap">' + comm.map(s => '<label class="uvspot"><input type="checkbox" name="comm" value="' + esc(s.id) + '"' + (sel.indexOf(s.id) >= 0 ? " checked" : "") + "><span>" + esc(s.n) + " (" + s.q + ")</span></label>").join("") + "</div></div>" : '<p class="uvko">Pas de commentateur dans ton staff (Ma fédé › Staff).</p>') +
    '<label class="uvfld">Entrées<select name="ent">' + ENT.map((x, i) => '<option value="' + i + '"' + ((ev.ent || 0) === i ? " selected" : "") + ">" + esc(x[0]) + (x[1] ? " (" + fmtK(x[1]) + ")" : "") + "</option>").join("") + "</select></label>" +
    (isBig(ev) ? '<label class="uvfld">Salle<select name="venue">' + VENUES.map((v, i) => '<option value="' + i + '"' + ((ev.venue != null ? ev.venue : f.venue) === i ? " selected" : "") + ">" + esc(v[0]) + " · " + v[1].toLocaleString("fr-FR") + " places · " + fmtK(v[2]) + "</option>").join("") + "</select></label>" +
      '<label class="uvfld">Ville<select name="city">' + CITIES.map((x, i) => '<option value="' + i + '"' + ((ev.city != null ? ev.city : f.home) === i ? " selected" : "") + ">" + esc(x[0]) + (x[1] >= 4 ? " (public brûlant)" : x[1] <= -1 ? " (public froid)" : "") + "</option>").join("") + "</select></label>" +
      '<label class="uvspot"><input type="checkbox" name="mania"' + (G.mania === ev.id ? " checked" : "") + '><span>Le grand show de l’année (« la route vers… »)</span></label>' +
      '<div class="uvrow2"><button type="button" class="uvbtn sm" data-act="uvpromo" data-ev="' + esc(ev.id) + '"' + ((ev.promo || 0) >= 3 ? " disabled" : "") + ">Vidéo de promo (20 k$) · " + (ev.promo || 0) + '/3</button><button type="button" class="uvbtn sm" data-act="uvposter" data-ev="' + esc(ev.id) + '">Voir l’affiche</button></div>' : "") + "</form></details>";
  const list = ev.items.map((it, i) => itemCard(G, ev, it, i)).join("");
  const pend = (G.tours || []).filter(t => t.fed === G.me && !t.win).reduce((s, t) => s.concat(pendingTour(G, t, ev).map(x => Object.assign({ t: t }, x))), []);
  const trads = isBig(ev) ? (G.trad || []).filter(x => x.fed === G.me && x.on && x.k === "match" && x.m === dateOf(ev.day).m && !(x.done || {})[dateOf(ev.day).y]) : [];
  const cases = (G.mitb || []).filter(x => x.fed === G.me && G.W[x.w]);
  const add = '<div class="uvadd"><button type="button" class="uvbtn" data-act="uvbadd2" data-ev="' + esc(ev.id) + '">+ Match</button><button type="button" class="uvbtn" data-act="uvsegadd" data-ev="' + esc(ev.id) + '">+ Segment</button>' +
    (pend.length ? '<button type="button" class="uvbtn" data-act="uvtouradd" data-ev="' + esc(ev.id) + '">+ Match du tournoi (' + pend.length + ")</button>" : "") +
    trads.map(x => '<button type="button" class="uvbtn" data-act="uvtradadd" data-ev="' + esc(ev.id) + '" data-tr="' + esc(x.id) + '">+ ' + esc(x.n) + "</button>").join("") +
    (cases.length && ev.items.some(it => it.it === "m" && it.title) ? '<button type="button" class="uvbtn" data-act="uvcash" data-ev="' + esc(ev.id) + '">Encaisser la mallette</button>' : "") +
    '<button type="button" class="uvbtn ghost" data-act="uvbauto2" data-ev="' + esc(ev.id) + '">Carte faite par l’IA</button>' + (ev.items.length ? '<button type="button" class="uvbtn ghost" data-act="uvbclr2" data-ev="' + esc(ev.id) + '">Tout effacer</button>' : "") + "</div>";
  const play = today ? '<div class="uvplay">' + (live ? '<a class="uvbtn pri big" href="#/univers/live/' + encodeURIComponent(ev.id) + '">Reprendre le direct</a>' : '<button type="button" class="uvbtn pri big" data-act="uvgolive" data-ev="' + esc(ev.id) + '">Vivre le show en direct (Gorilla)</button><button type="button" class="uvbtn big" data-act="uvbplay2" data-ev="' + esc(ev.id) + '">Passer le show</button>') + "</div>" : '<p class="uvsm">Ce show a lieu le ' + esc(dayLabel(ev.day)) + " : ta carte est gardée jusque-là.</p>";
  return shell("activite", "La carte du show", "", head + '<div class="uvitems">' + (list || '<p class="uvempty">Carte vide : ajoute un match ou un segment, ou laisse l’IA la faire.</p>') + "</div>" + add + play);
}
function itemCard(G, ev, it, i) {
  const n = ev.items.length, ed = U.f.bi === i && U.f.bev === ev.id, e = estimate(G, ev, it), last = i === n - 1;
  const mv = '<div class="uvitb">' + (i > 0 ? '<button type="button" class="uvic" data-act="uvbmv2" data-ev="' + esc(ev.id) + '" data-i="' + i + '" data-d="-1" aria-label="Monter">▲</button>' : "") + (i < n - 1 ? '<button type="button" class="uvic" data-act="uvbmv2" data-ev="' + esc(ev.id) + '" data-i="' + i + '" data-d="1" aria-label="Descendre">▼</button>' : "") +
    '<button type="button" class="uvic" data-act="uvbed" data-ev="' + esc(ev.id) + '" data-i="' + (ed ? -1 : i) + '" aria-label="' + (ed ? "Fermer" : "Modifier") + '">' + (ed ? "✓" : "✎") + '</button><button type="button" class="uvic del" data-act="uvbdel2" data-ev="' + esc(ev.id) + '" data-i="' + i + '" aria-label="Retirer">✕</button></div>';
  if (it.it === "s") {
    const S = SEG[it.k] || SEG.promo, W = (it.w || []).filter(Boolean);
    return '<div class="uvitem sg' + (ed ? " ed" : "") + '"><div class="uvrow"><span class="uvtag" style="background:' + (S.at === "bs" ? "#c9a7ff" : "#6fb3ff") + '">' + (S.at === "bs" ? "Coulisses" : "Ring") + '</span><b class="uvgrow">' + esc(S.n) + "</b>" + (e.r ? '<span class="uvstar">' + stars(e.r) + "</span>" : "") + "</div>" +
      '<p class="uvsm">' + (W.length ? W.map(x => wnH(G, x)).join(" et ") : "Personne") + " · " + S.min + " min</p>" + mv + (ed ? segEditor(G, ev, it, i) : "") + "</div>";
  }
  const T = mtOf(it), err = checkMatch(G, ev, it), t = it.title && G.T[it.title];
  return '<div class="uvitem' + (ed ? " ed" : "") + (last ? " main" : "") + '"><div class="uvrow"><span class="uvtag" style="background:' + (last ? "#f5b13d" : "#eef1f6") + '">' + (last && n > 1 ? "Main event" : "Match " + (i + 1)) + '</span><b class="uvgrow">' + esc(T.n) + (t ? " · " + esc(t.n) : "") + "</b>" + (e.r ? '<span class="uvstar">' + stars(e.r) + "</span>" : "") + "</div>" +
    '<div class="uvvsr">' + (it.sides || []).map(s => '<span class="uvside">' + (s.length ? s.map(x => face(G, G.W[x], 26)).join("") + "<i>" + esc(teamName(G, s)) + "</i>" : "<i>?</i>") + "</span>").join('<em>contre</em>') + "</div>" +
    '<p class="uvsm">' + [DUR[it.dur] ? DUR[it.dur][0] + " (" + itemMin(it) + " min)" : "", it.stip ? STIP[it.stip] : "", it.fin && it.fin !== "auto" ? FIN[it.fin][0] : "", it.cons ? CONS[it.cons][0] : "", it.tour ? "Tournoi" : "", it.trad ? "Tradition" : "", it.cashin ? "Encaissement de la mallette" : "", it.oc ? (it.oc.rand ? "Adversaire surprise" : it.oc.secret ? "Adversaire gardé secret" : "") : ""].filter(Boolean).map(esc).join(" · ") + "</p>" +
    (err ? '<p class="uvko">' + esc(err) + "</p>" : "") + (e.warn || []).slice(0, 2).map(x => '<p class="uvsm uvwarn">' + esc(x) + "</p>").join("") + mv + (ed ? matchEditor(G, ev, it, i) : "") + "</div>";
}
function matchEditor(G, ev, it, i) {
  const T = mtOf(it), used = usedIn(ev), f = meF(G), tag = T.p === 2 || (Array.isArray(T.p) && T.p[0] >= 2);
  const titles = Object.values(G.T).filter(t => t.fed === G.me || t.fed === ev.part);
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>";
  const sides = it.t === "open" ? '<div class="uvsidee"><b>Celui qui lance le défi</b>' + sideChips(G, it, 0) + (it.sides[0].length ? "" : wSel(G, ev, "add0", used)) + "</div>" +
      '<div class="uvsidee"><b>Celui qui répond</b><label class="uvspot"><input type="checkbox" name="ocrand"' + (it.oc && it.oc.rand ? " checked" : "") + "><span>Au hasard (le public ne sait pas qui va venir)</span></label>" +
      (it.oc && it.oc.rand ? "" : sideChips(G, it, 1) + (it.sides[1] && it.sides[1].length ? "" : ocSel(G, ev, used))) + '<label class="uvspot"><input type="checkbox" name="ocsec"' + (!it.oc || it.oc.secret !== false ? " checked" : "") + "><span>Garder le nom secret jusqu’au match</span></label></div>"
    : it.sides.map((s, j) => '<div class="uvsidee"><b>Camp ' + (j + 1) + "</b>" + sideChips(G, it, j) + wSel(G, ev, "add" + j, used) + (T.s === "n" && it.sides.length > 2 ? '<button type="button" class="uvbtn sm ghost" data-act="uvsdel" data-ev="' + esc(ev.id) + '" data-i="' + i + '" data-j="' + j + '">Retirer ce camp</button>' : "") + "</div>").join("") +
      (T.s === "n" || (typeof T.s === "number" && it.sides.length < T.s) ? '<button type="button" class="uvbtn sm" data-act="uvsnew" data-ev="' + esc(ev.id) + '" data-i="' + i + '">+ Un camp</button>' : "");
  return '<form class="uvform uvited" id="uvit" data-ev="' + esc(ev.id) + '" data-i="' + i + '" onsubmit="return false">' +
    '<label class="uvfld">Type de match<select name="t">' + MTG.map(g => '<optgroup label="' + esc(g[0]) + '">' + g[1].map(k => opt(k, MT[k].n, it.t)).join("") + "</optgroup>").join("") + "</select></label>" + sides +
    '<label class="uvfld">Titre en jeu<select name="title">' + opt("", "Aucun", it.title) + titles.map(t => opt(t.id, t.n + " — " + (champIds(t).length ? teamName(G, champIds(t)) : "vacant") + (t.cat === "x" ? " (intergender)" : t.cat === "f" ? " (féminin)" : ""), it.title)).join("") + "</select></label>" +
    '<div class="uvfgrid"><label class="uvmini">Enjeu<select name="stip">' + Object.keys(STIP).map(k => opt(k, STIP[k], it.stip)).join("") + "</select></label>" +
    '<label class="uvmini">Fin du match<select name="fin">' + Object.keys(FIN).map(k => opt(k, FIN[k][0], it.fin || "auto")).join("") + "</select></label>" +
    '<label class="uvmini">Consigne<select name="cons">' + Object.keys(CONS).map(k => opt(k, CONS[k][0], it.cons)).join("") + "</select></label>" +
    '<label class="uvmini">Durée<select name="dur">' + Object.keys(DUR).map(k => opt(k, DUR[k][0] + " (" + DUR[k][1] + " min)", it.dur)).join("") + "</select></label>" +
    '<label class="uvmini">Vainqueur<select name="win">' + opt("ia", "L’IA décide", it.win) + it.sides.map((s, j) => opt(j, "Camp " + (j + 1) + (s.length ? " : " + teamName(G, s) : ""), it.win)).join("") + opt("nul", "Draw", it.win) + "</select></label></div>" +
    '<div class="uvspots" role="group" aria-label="Moments forts">' + Object.keys(SPOTS).map(k => '<label class="uvspot"><input type="checkbox" name="spot" value="' + k + '"' + ((it.spots || []).indexOf(k) >= 0 ? " checked" : "") + "><span>" + SPOTS[k][0] + "</span></label>").join("") + "</div>" +
    '<button type="button" class="uvbtn sm pri" data-act="uvbed" data-ev="' + esc(ev.id) + '" data-i="-1">OK</button></form>';
}
function sideChips(G, it, j) { return '<div class="uvmem">' + (it.sides[j] || []).map(x => '<span class="uvpill">' + face(G, G.W[x], 22) + esc(wn(G, x)) + '<button type="button" data-act="uvsrm" data-j="' + j + '" data-w="' + esc(x) + '" aria-label="Retirer ' + esc(wn(G, x)) + '">×</button></span>').join("") + "</div>"; }
function ocSel(G, ev, used) { return '<button type="button" class="uvbtn sm uvaddw" data-act="uvpickw" data-k="oc">Qui répond au défi ?</button>'; }
function segEditor(G, ev, it, i) {
  const S = SEG[it.k] || SEG.promo, used = usedIn(ev).filter(x => (it.w || []).indexOf(x) < 0), cameo = (G.appear || []).filter(a => a.ev === ev.id).map(a => a.w);
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>";
  const sel = j => { const cur = (it.w || [])[j]; return '<div class="uvfld"><span>' + (j === 0 ? "Qui" : "Avec") + '</span><div class="uvrow2">' + (cur ? '<span class="uvpill">' + wnH(G, cur) + '<button type="button" data-act="uvsegw" data-j="' + j + '" aria-label="Retirer">×</button></span>' : "") + '<button type="button" class="uvbtn sm uvaddw" data-act="uvpickw" data-k="w' + j + '">' + (cur ? "Changer" : "Choisir") + "</button></div></div>"; };
  return '<form class="uvform uvited" id="uvit" data-ev="' + esc(ev.id) + '" data-i="' + i + '" onsubmit="return false"><label class="uvfld">Segment<select name="k">' + ["ring", "bs"].map(at => '<optgroup label="' + (at === "bs" ? "En coulisses" : "Sur le ring") + '">' + Object.keys(SEG).filter(k => SEG[k].at === at).map(k => opt(k, SEG[k].n, it.k)).join("") + "</optgroup>").join("") + "</select></label>" +
    Array.from({ length: Math.max(1, S.p) }, (x, j) => sel(j)).join("") + '<button type="button" class="uvbtn sm pri" data-act="uvbed" data-ev="' + esc(ev.id) + '" data-i="-1">OK</button></form>';
}
// le formulaire de l'élément ouvert : relu à chaque changement
function readItem(f, ev) {
  const i = +f.dataset.i, it = ev.items[i]; if (!it) return; const v = n => (f.elements.namedItem(n) || {}).value;
  if (it.it === "s") { it.k = v("k") || it.k; const S = SEG[it.k] || SEG.promo; it.w = (it.w || []).slice(0, Math.max(1, S.p)).filter(Boolean); return; }
  const t = v("t") || it.t; if (t !== it.t) { const T = MT[t] || MT.simple, ids = idsOf(it); it.t = t; const ns = T.s === "n" ? Math.max(T.min, Math.min(T.max, ids.length || T.min)) : T.s, pp = Array.isArray(T.p) ? T.p[0] : T.p;
    if (T.open) { it.sides = [ids.slice(0, 1), []]; it.oc = { rand: false, secret: true }; } else if (pp === 1) it.sides = Array.from({ length: Math.max(2, Math.min(ns, ids.length || ns)) }, (x, j) => ids[j] ? [ids[j]] : []); else { const n2 = typeof T.s === "number" ? T.s : 2; it.sides = Array.from({ length: n2 }, (x, j) => ids.slice(j * pp, j * pp + pp)); } if (T.dur) it.dur = "long"; it.win = "ia"; }
  ["title", "stip", "fin", "cons", "dur"].forEach(k => { const x = v(k); if (x != null) it[k] = x; });
  const w = v("win"); if (w != null) it.win = w === "ia" || w === "nul" ? w : +w;
  it.spots = Array.from(f.querySelectorAll('input[name="spot"]:checked')).map(x => x.value);
  if (it.t === "open") { it.oc = it.oc || {}; it.oc.rand = !!(f.elements.namedItem("ocrand") || {}).checked; const sec = f.elements.namedItem("ocsec"); if (sec) it.oc.secret = sec.checked; const ow = v("ocw"); if (ow) { it.sides[1] = [ow]; it.oc.w = ow; } if (it.oc.rand) it.sides[1] = []; }
  // un catcheur choisi dans un « + Ajouter… »
  it.sides.forEach((s, j) => { const a = v("add" + j); if (a && s.indexOf(a) < 0) s.push(a); });
  // titre choisi : le champion se met dans le camp 1
  if (it.title && it.title !== it._t) { const T2 = G0().T[it.title], c = T2 ? champIds(T2) : []; if (c.length && !idsOf(it).some(x => c.indexOf(x) >= 0)) { it.sides[0] = c.slice(0, mtOf(it).p === 2 ? 2 : 1).concat(it.sides[0].filter(x => c.indexOf(x) < 0)).slice(0, Math.max(1, Array.isArray(mtOf(it).p) ? mtOf(it).p[1] : mtOf(it).p)); } }
  it._t = it.title;
}
const G0 = () => U.G;
if (typeof document !== "undefined") document.addEventListener("change", e => {
  const f = e.target.closest && e.target.closest("#uvit, #uvshowset"); if (!f || !U.G) return;
  const ev = U.G.ev.find(x => x.id === f.dataset.ev); if (!ev || ev.done) return;
  if (f.id === "uvit") readItem(f, ev);
  else { const v = n => (f.elements.namedItem(n) || {}).value; ev.comm = Array.from(f.querySelectorAll('input[name="comm"]:checked')).map(x => x.value).slice(0, 3); ev.ent = +v("ent") || 0; if (v("venue") != null) ev.venue = +v("venue"); if (v("city") != null) ev.city = +v("city"); const m = f.elements.namedItem("mania"); if (m) { if (m.checked) U.G.mania = ev.id; else if (U.G.mania === ev.id) U.G.mania = ""; } }
  persist(); redraw();
});
// choisir un catcheur avec sa photo (carte du show)
ACT.uvpickw = el => {
  const G = U.G, f = el.closest("#uvit"); if (!f) return; const ev = G.ev.find(x => x.id === f.dataset.ev), it = ev && ev.items[+f.dataset.i]; if (!it) return;
  readItem(f, ev); const k = el.dataset.k, used = usedIn(ev), row = w => ({ w: w, ok: okFor(G, ev, w), info: wInfo(G, ev, w) });
  const done = id => { if (k.indexOf("add") === 0) { const s = it.sides[+k.slice(3)]; if (s && s.indexOf(id) < 0) s.push(id); }
    else if (k === "oc") { it.oc = it.oc || {}; it.sides[1] = [id]; it.oc.w = id; it.oc.rand = false; }
    else { const j = +k.slice(1); it.w = (it.w || []).slice(); it.w[j] = id; it.w = it.w.filter(Boolean); }
    persist(); redraw(); };
  if (k === "oc") { const mine = poolFor(G, ev).filter(w => used.indexOf(w.id) < 0 && okFor(G, ev, w)), legs = Object.values(G.W).filter(w => w.ret && w.leg && !w.staff).sort((a, b) => b.pop - a.pop).slice(0, 15), fa = Object.values(G.W).filter(w => !w.fed && !w.ret && !(w.nc > G.day)).sort((a, b) => b.pop - a.pop).slice(0, 15);
    return pickW(G, "Qui répond au défi ?", [["Ton effectif", mine.map(row)], ["Légendes (cachet)", legs.map(w => ({ w: w, info: "Pop " + Math.round(w.pop) + " · légende" }))], ["Agents libres", fa.map(w => ({ w: w, info: "Pop " + Math.round(w.pop) + " · agent libre" }))]], done); }
  if (k[0] === "w") { const cameo = (G.appear || []).filter(a => a.ev === ev.id).map(a => a.w), j = +k.slice(1), P = poolFor(G, ev).concat(cameo.map(x => G.W[x]).filter(w => w && poolFor(G, ev).indexOf(w) < 0)).filter(w => used.indexOf(w.id) < 0 || (it.w || [])[j] === w.id);
    return pickW(G, j === 0 ? "Qui fait ce segment ?" : "Avec qui ?", [["", P.map(w => ({ w: w, info: "Pop " + Math.round(w.pop) + (w.secret ? " · signature secrète" : w.ret ? " · légende" : "") }))]], done); }
  const P = poolFor(G, ev).filter(w => used.indexOf(w.id) < 0);
  pickW(G, "Ajouter au camp " + (+k.slice(3) + 1), [["Disponibles", P.filter(w => okFor(G, ev, w)).map(row)], ["Pas disponibles", P.filter(w => !okFor(G, ev, w)).map(row)]], done);
};
ACT.uvsegw = el => { const G = U.G, f = el.closest("#uvit"); if (!f) return; const ev = G.ev.find(x => x.id === f.dataset.ev), it = ev && ev.items[+f.dataset.i]; if (!it) return; it.w = (it.w || []).filter((x, j) => j !== +el.dataset.j); persist(); redraw(); };
ACT.uvbed = el => { U.f.bev = el.dataset.ev; U.f.bi = +el.dataset.i; redraw(); };
ACT.uvbadd2 = el => { const ev = evOf(el); if (!ev) return; if (ev.items.filter(x => x.it === "m").length >= 12) { toast("12 matchs au maximum"); return; } ev.items.push(NEWM()); U.f.bev = ev.id; U.f.bi = ev.items.length - 1; persist(); redraw(); };
ACT.uvsegadd = el => { const ev = evOf(el); if (!ev) return; ev.items.push({ it: "s", k: "promo", w: [] }); U.f.bev = ev.id; U.f.bi = ev.items.length - 1; persist(); redraw(); };
ACT.uvbdel2 = el => { const ev = evOf(el); if (!ev) return; ev.items.splice(+el.dataset.i, 1); U.f.bi = -1; persist(); redraw(); };
ACT.uvbmv2 = el => { const ev = evOf(el), i = +el.dataset.i, j = i + +el.dataset.d; if (!ev || j < 0 || j >= ev.items.length) return; const x = ev.items[i]; ev.items[i] = ev.items[j]; ev.items[j] = x; if (U.f.bi === i) U.f.bi = j; persist(); redraw(); };
ACT.uvsrm = el => { const ev = U.G.ev.find(e => e.id === U.f.bev), it = ev && ev.items[U.f.bi]; if (!it) return; const s = it.sides[+el.dataset.j]; if (s) s.splice(s.indexOf(el.dataset.w), 1); persist(); redraw(); };
ACT.uvsnew = el => { const ev = evOf(el), it = ev && ev.items[+el.dataset.i]; if (!it) return; const T = mtOf(it); if (T.s === "n" && it.sides.length >= T.max) { toast(T.max + " camps au maximum"); return; } it.sides.push([]); persist(); redraw(); };
ACT.uvsdel = el => { const ev = evOf(el), it = ev && ev.items[+el.dataset.i]; if (!it) return; it.sides.splice(+el.dataset.j, 1); persist(); redraw(); };
ACT.uvbauto2 = el => { const ev = evOf(el); if (!ev) return; autoCard(U.G, ev); U.f.bi = -1; persist(); toast("Carte faite par l’IA : tu peux encore tout changer"); redraw(); };
ACT.uvbclr2 = el => { const ev = evOf(el); if (!ev) return; ev.items = []; U.f.bi = -1; persist(); redraw(); };
ACT.uvtouradd = el => {
  const G = U.G, ev = evOf(el); if (!ev) return;
  const L = (G.tours || []).filter(t => t.fed === G.me && !t.win).reduce((s, t) => s.concat(pendingTour(G, t, ev).map(x => Object.assign({ t: t }, x))), []).filter(x => !ev.items.some(it => it.tour && it.tour.id === x.t.id && it.tour.k === x.k));
  modal((box, close) => {
    box.classList.add("uvmodal");
    box.innerHTML = "<h3>Ajouter un match du tournoi</h3>" + (L.length ? L.map((x, i) => '<button type="button" class="uvbtn" data-i="' + i + '">' + esc(x.t.n + " · " + x.lbl + " : " + (x.g ? x.m.length + " catcheurs" : wn(G, x.m[0]) + " contre " + wn(G, x.m[1]))) + "</button>").join("") : '<p class="uvmut">Rien à jouer (la finale se joue dans un grand show).</p>') + '<button type="button" class="uvbtn ghost" data-x="1">Fermer</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-x]")) close(); const b = e.target.closest("[data-i]"); if (!b) return; const x = L[+b.dataset.i]; ev.items.push(NEWM(x.g ? { t: "gauntlet", sides: x.m.map(i => [i]), tour: { id: x.t.id, k: x.k }, dur: "long" } : { sides: [[x.m[0]], [x.m[1]]], tour: { id: x.t.id, k: x.k }, dur: x.fin ? "long" : "moyen" })); persist(); close(); redraw(); });
  });
};
ACT.uvtradadd = el => {
  const G = U.G, ev = evOf(el), x = (G.trad || []).find(y => y.id === el.dataset.tr); if (!ev || !x) return;
  const used = usedIn(ev), T = MT[x.t] || MT.battle;
  (x.x === "hf" ? ["h", "f"] : [x.x]).forEach(sx => {
    const pool = poolFor(G, ev).filter(w => okFor(G, ev, w) && used.indexOf(w.id) < 0 && w.sx === sx), n = Math.min(x.z || 6, T.s === "n" ? T.max : T.s * (Array.isArray(T.p) ? T.p[0] : T.p)), L = pool.slice(0, n).map(w => w.id); L.forEach(i => used.push(i));
    if (L.length < 2) return;
    if (x.pr === "apuestas") ev.items.push(NEWM({ sides: [[L[0]], [L[1]]], trad: x.id, stip: "maskhair", dur: "long" }));
    else ev.items.push(NEWM({ t: x.t, sides: x.t === "wargames" ? [L.slice(0, L.length >> 1), L.slice(L.length >> 1)] : L.map(i => [i]), trad: x.id, dur: "long", stip: x.pr === "case" ? "case" : "", caseN: x.n }));
  });
  persist(); redraw(); toast(x.n + " ajouté : change les participants si tu veux");
};
ACT.uvcash = el => {
  const G = U.G, ev = evOf(el); if (!ev) return;
  const C = (G.mitb || []).filter(x => x.fed === G.me && G.W[x.w]), T = ev.items.filter(it => it.it === "m" && it.title).map(it => G.T[it.title]).filter(Boolean);
  modal((box, close) => {
    box.classList.add("uvmodal");
    box.innerHTML = "<h3>Encaisser la mallette</h3><p class=\"uvmut\">Juste après le match de titre, le porteur de la mallette attaque le champion épuisé.</p>" + C.map((c, i) => T.map((t, j) => '<button type="button" class="uvbtn" data-c="' + i + '" data-t="' + j + '">' + wnH(G, c.w) + " encaisse sur le " + t.n + "</button>").join("")).join("") + '<button type="button" class="uvbtn ghost" data-x="1">Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-x]")) close(); const b = e.target.closest("[data-c]"); if (!b) return; if (cashIn(G, ev, C[+b.dataset.c].w, T[+b.dataset.t].id)) toast("Encaissement prévu juste après le match de titre !"); persist(); close(); redraw(); });
  });
};
ACT.uvpromo = el => { const r = promoVideo(U.G, el.dataset.ev); if (r) toast(r); persist(); redraw(); };
ACT.uvposter = el => {
  const G = U.G, ev = evOf(el); if (!ev) return; const ms = (ev.items || []).filter(it => it.it === "m"), me = ms[ms.length - 1], f = meF(G), im = imgEv(G, ev), c = cityOf(G, ev);
  modal((box, close) => {
    box.classList.add("uvmodal", "uvwide");
    box.innerHTML = '<div class="uvposter" style="--pc:' + esc(f.c || "#f5b13d") + '"><div class="uvpt">' + (im ? '<img src="' + esc(im) + '" alt="">' : crest(G, G.me, 56)) + "<b>" + esc(f.n) + "</b></div><h2>" + esc(ev.n) + "</h2>" +
      (me ? '<div class="uvpvs">' + me.sides.slice(0, 2).map(s => '<div class="uvpw">' + (s[0] ? face(G, G.W[s[0]], 110) : "") + "<b>" + esc(teamName(G, s)) + "</b></div>").join('<i>VS</i>') + "</div>" : '<p class="uvmut">Ajoute un main event pour l’affiche.</p>') +
      '<ul class="uvpu">' + ms.slice(0, -1).slice(-4).map(m => "<li>" + sidesH(G, m.sides) + "</li>").join("") + '</ul><p class="uvpd">' + esc(dayLabel(ev.day, true)) + (c ? " · " + esc(c[0]) : "") + "</p></div>" + '<button type="button" class="uvbtn ghost" data-x="1">Fermer</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-x]")) close(); });
  });
};
// ---------- vérifier la carte avant de jouer ----------
function checkCard(G, ev) {
  if (!ev.items.length) return "Ajoute au moins un match (ou « Carte faite par l’IA »)";
  const seen = new Set();
  for (let i = 0; i < ev.items.length; i++) {
    const it = ev.items[i], nm = (it.it === "m" ? "Match " : "Segment ") + (i + 1) + " : ";
    if (it.it === "s") { const S = SEG[it.k] || SEG.promo; if (S.p && (it.w || []).length < S.p) return nm + "il manque quelqu’un"; for (const id of it.w) { if (seen.has(id) && !(G.W[id] || {}).ret) return wn(G, id) + " est deux fois sur la carte"; seen.add(id); } continue; }
    if (it.t === "open" && it.oc && it.oc.rand && !(it.sides[1] || []).length) { const L = Object.values(G.W).filter(w => (w.ret ? !w.staff && w.leg : (!w.fed && !(w.nc > G.day)) || (w.fed === G.me && avail(G, w))) && !seen.has(w.id) && usedIn(ev).indexOf(w.id) < 0 && w.id !== it.sides[0][0] && w.sx === (G.W[it.sides[0][0]] || {}).sx); const r = pick(L.sort((a, b) => b.pop - a.pop).slice(0, 25)); if (r) { it.sides[1] = [r.id]; it.oc.w = r.id; } }
    const err = checkMatch(G, ev, it); if (err) return nm + err;
    for (const id of idsOf(it)) { const w = G.W[id]; if (seen.has(id) && !it.cashin) return wn(G, id) + " est dans deux matchs"; seen.add(id); if (w && !w.ret && w.fed !== G.me && w.fed !== ev.part && !(w.guest && w.guest.to === G.me) && guestsFor(G, ev).indexOf(id) < 0 && !(it.t === "open" && !w.fed)) return nm + wn(G, id) + " n’est pas dans ta fédération"; if (w && !w.ret && w.fed && !avail(G, w, ev.day) && !it.cashin) return nm + wn(G, id) + " ne peut pas catcher (" + why(G, w) + ")"; }
    const t = it.title && G.T[it.title], c = t ? champIds(t).filter(x => G.W[x] && avail(G, G.W[x], ev.day)) : [];
    if (c.length && !c.every(x => idsOf(it).indexOf(x) >= 0)) return nm + "le champion (" + teamName(G, c) + ") doit être dans le match";
  }
  // un open challenge avec un agent libre ou une légende : cachet
  ev.items.forEach(it => { if (it.t === "open" && it.sides[1] && it.sides[1][0]) { const w = G.W[it.sides[1][0]]; if (w && (w.ret || !w.fed) && !it.fee) { it.fee = Math.round((20 + w.pop * 2) / 5) * 5; meF(G).money -= it.fee; G.fin.cur.prod += it.fee; } } });
  return "";
}
function afterShow(G, ev) {
  // open challenge : buzz selon la surprise ; un agent libre veut signer
  (ev.res.items || []).forEach((r, i) => { const it = ev.items[i]; if (!it || it.t !== "open" || !r.sides || !r.sides[1]) return; const w = G.W[r.sides[1][0]]; if (!w) return; const sur = (w.ret ? 1.6 : !w.fed ? 1.3 : w.fed !== G.me ? 1.2 : w.pop > 70 ? 0.9 : 0.6) * (it.oc && it.oc.secret !== false ? 1 : 0.5); r.notes.push(sur >= 1.2 ? "Énorme surprise : " + w.n + " répond au défi !" : sur >= 0.8 ? w.n + " relève le défi." : "Pas vraiment une surprise…"); w.pop = clamp(w.pop + sur * 2, 1, 99); meF(G).pop = clamp(meF(G).pop + sur * 0.4, 5, 99);
    if (w.ret && sur >= 1.2) ach(G, "oclegend");
    if (!w.fed && !w.ret) mail(G, { k: "fa", from: "Agent de " + w.n, role: "Agent", c: "#63d69c", ini: "AG", subj: w.n + " aimerait signer chez toi", body: "Après l’open challenge, " + w.n + " a adoré l’ambiance. Il est prêt à discuter d’un contrat.", w: w.id }); });
  (G.appear || []).forEach(a => { if (a.ev === ev.id) a.used = true; });
}
function play(G, ev, live) {
  U.f.bi = -1; const err = checkCard(G, ev); if (err) { toast(err); return false; }
  if (live) { U.live = { ev: ev.id, L: prepShow(G, ev), sp: 1 }; go("#/univers/live/" + encodeURIComponent(ev.id)); setTimeout(() => runTimer(), 400); return true; }
  runShow(G, ev); afterShow(G, ev); doneMail(G, ev); persist(true); window.scrollTo(0, 0); redraw(); return true;
}
const doneMail = (G, ev) => G.mail.forEach(m => { if (m.k === "show" && m.ev === ev.id && !m.done) { m.done = "Show joué."; m.read = true; } });
ACT.uvgolive = el => { const ev = evOf(el); if (ev) play(U.G, ev, true); };
ACT.uvbplay2 = el => { const ev = evOf(el); if (ev) play(U.G, ev, false); };
// « Vivre en direct » depuis l'accueil, le courrier ou la fenêtre du soir : carte de l'IA si elle est vide
U.goLive = ev => { const G = U.G; if (!ev || ev.done) return; if (ev.day !== G.day) { go("#/univers/ev/" + encodeURIComponent(ev.id)); return; } if (!(ev.items || []).length) autoCard(G, ev); if (!play(G, ev, true)) go("#/univers/ev/" + encodeURIComponent(ev.id)); };

// ---------- le show en direct : plein écran « comme à la télé » (tv.js) ----------
U.afterLive = (G, ev) => { afterShow(G, ev); doneMail(G, ev); };
U.resultsView = (G, ev) => resultsView(G, ev);

// ---------- les résultats : rapport détaillé ----------
export function resultsView(G, ev) {
  const r = ev.res || {}, im = imgEv(G, ev), mine = ev.fed === G.me;
  const items = r.items || (r.m || []).map(m => ({ it: "m", t: m.kind === "equipe" ? "tag" : "simple", sides: [m.a, m.b], win: m.win === "a" ? 0 : m.win === "b" ? 1 : "nul", r: m.r, title: m.title, change: m.change, notes: m.notes || [] })).concat((r.s || []).map(s => ({ it: "s", k: "promo", w: [s.w], r: s.r, notes: [] })));
  const line = (x, i) => {
    if (x.it === "s") return '<div class="uvres"><div class="uvrow"><span class="uvgrow">' + esc((SEG[x.k] || SEG.promo).n) + " : <b>" + teamH(G, x.w) + '</b></span><span class="uvstar">' + stars(x.r) + "</span></div>" + (x.notes || []).map(n => "<small>" + esc(n) + "</small>").join("") + "</div>";
    const W = typeof x.win === "number" ? x.sides[x.win] : null, t = x.title && G.T[x.title], P = x.parts;
    return '<details class="uvres"' + (i === items.length - 1 ? " open" : "") + '><summary><div class="uvrow"><span class="uvgrow"><small>' + esc((MT[x.t] || MT.simple).n) + (t ? " · " + esc(t.n) : "") + "</small>" + (W ? "<b>" + teamH(G, W) + "</b> bat " + esc(x.sides.filter((s, j) => j !== x.win).map(s => teamName(G, s)).join(", ")) : sidesH(G, x.sides) + " : pas de vainqueur") + '</span><span class="uvstar">' + stars(x.r) + "</span></div></summary>" +
      (x.fin ? '<p class="uvsm">Fin : ' + esc((FIN[x.fin] || ["?"])[0]) + (x.dur ? " · " + esc((DUR[x.dur] || ["?"])[0]) : "") + "</p>" : "") + (t ? '<p class="' + (x.change ? "uvhot" : "uvsm") + '">' + (x.change ? "NOUVEAU CHAMPION : " + esc(t.n) : "Le champion garde le " + esc(t.n)) + "</p>" : "") +
      (P ? '<div class="uvparts">' + [["Ring", P.ring, 70], ["Alchimie", P.chem, 10], ["Histoire", P.story, 15], ["Public", P.crowd, 12], ["Durée", P.dur, 8]].map(p => '<div class="uvst2"><span>' + p[0] + "</span>" + bar(Math.max(0, p[1]) / p[2] * 100, p[1] < 0 ? "#ff8a7e" : "#6fb3ff") + "<b>" + (p[1] > 0 ? "+" : "") + p[1] + "</b></div>").join("") + "</div>" : "") +
      (x.hero ? '<p class="uvok">Mis' + e_(G.W[x.hero]) + " en valeur : " + wnH(G, x.hero) + "</p>" : "") + ((x.cons || []).filter(c => c.up).map(c => '<p class="uvok">' + wnH(G, c.w) + " sort grandi" + e_(G.W[c.w]) + " de sa défaite</p>").join("")) + (x.buried ? '<p class="uvko">Enterré' + e_(G.W[x.buried]) + " : " + wnH(G, x.buried) + "</p>" : "") +
      (x.botch || []).map(b => '<p class="uvko">Botch ' + (b.sev === 2 ? "grave" : "") + " de " + wnH(G, b.w) + "</p>").join("") + (x.notes || []).map(n => '<p class="uvsm">' + esc(n) + "</p>").join("") +
      ((x.cons || []).length ? '<div class="uvconsq">' + x.cons.map(c => "<span>" + wnH(G, c.w) + ' <b class="' + (c.pop >= 0 ? "uvok" : "uvko") + '">' + (c.pop >= 0 ? "+" : "") + c.pop + "</b></span>").join("") + "</div>" : "") +
      (mine && ev.day >= G.day - 1 && !x.prime ? '<div class="uvrow2"><span class="uvsm">Prime :</span>' + [10, 25, 50].map(v => '<button type="button" class="uvbtn sm ghost" data-act="uvprime" data-ev="' + esc(ev.id) + '" data-i="' + i + '" data-v="' + v + '">' + v + " k$</button>").join("") + "</div>" : x.prime ? '<p class="uvok">Prime de ' + x.prime + " k$ donnée</p>" : "") + "</details>";
  };
  const body = '<a class="uvback" href="#/univers/' + (mine ? "activite/ev" : "g") + '">‹ Retour</a><div class="uvevhead">' + (im ? '<img class="uvevimg big" src="' + esc(im) + '" alt="">' : crest(G, ev.fed, 64)) + '<div class="uvgrow"><h2>' + esc(ev.n) + "</h2><small>" + esc(dayLabel(ev.day, true)) + " · " + (ev.kind === "tv" ? "Show TV" : ev.kind.toUpperCase()) + "</small>" + (mine ? imgBtn("e:" + ev.fed + "|" + ev.n) : "") + "</div></div>" +
    '<div class="uvkv3"><div><b>' + stars(r.r || 0) + "</b>note</div><div><b>" + fmtM(r.aud || 0) + "</b>téléspectateurs</div>" + (r.money != null ? "<div><b class=\"" + (r.money >= 0 ? "uvok" : "uvko") + '">' + fmtK(r.money) + "</b>recettes</div>" : "") + "</div>" +
    (r.att ? '<p class="uvsm">' + r.att.toLocaleString("fr-FR") + " spectateurs" + (r.full ? " · COMPLET" : " sur " + (r.cap || 0).toLocaleString("fr-FR")) + (r.crowd ? " · public " + (r.crowd >= 80 ? "brûlant" : r.crowd >= 62 ? "chaud" : r.crowd >= 45 ? "tiède" : "froid") : "") + (r.clock ? " · durée " + Math.floor(r.clock / 60) + " h " + String(r.clock % 60).padStart(2, "0") : "") + (r.war ? " · face à " + esc(r.war.n) + " le même soir" : "") + "</p>" : "") +
    '<h3 class="uvh3">Le rapport</h3>' + items.map(line).join("") + '<a class="uvbtn pri" href="#/univers/g">Menu général</a>';
  return shell(mine ? "activite" : "g", "Résultats", "", body);
}
ACT.uvprime = el => {
  const G = U.G, ev = evOf(el), x = ev && ev.res && ev.res.items && ev.res.items[+el.dataset.i], v = +el.dataset.v, f = meF(G); if (!x || x.prime) return;
  if (f.money < v) { toast("Pas assez d’argent"); return; } f.money -= v; G.fin.cur.prod += v; x.prime = v;
  idsOf(x).forEach(i => { const w = G.W[i]; if (w && w.fed === G.me) w.mor = clamp(w.mor + v / 5 + 2); }); persist(); toast("Prime donnée : le moral monte"); redraw();
};

// ---------- Créatif › Tournois ----------
export function toursBody(G) {
  const L = (G.tours || []).filter(t => t.fed === G.me).slice().reverse(), RN = n => n === 1 ? "Finale" : n === 2 ? "Demi-finales" : n === 4 ? "Quarts" : n === 8 ? "8es" : "16es";
  const names = (G.trad || []).filter(x => x.fed === G.me && x.k === "tour").map(x => x.n);
  const card = t => {
    const img = (G.img || {})["o:" + t.id];
    let inner = "";
    if (t.fmt === "league") inner = t.blocks.map((B, bi) => '<div class="uvlg"><small>' + (t.blocks.length > 1 ? "Bloc " + "ABCD"[bi] : "Classement") + "</small>" + B.m.slice().sort((a, b) => (B.pts[b] || 0) - (B.pts[a] || 0)).map(x => '<div class="uvline"><span class="uvgrow">' + wnH(G, x) + "</span><b>" + (B.pts[x] || 0) + " pts</b></div>").join("") + '<p class="uvsm">' + B.g.filter(g => g.w).length + " / " + B.g.length + " matchs joués</p></div>").join("") + (t.final ? '<p class="uvsm">Finale : ' + wnH(G, t.final.a) + " contre " + wnH(G, t.final.b) + (t.final.w ? " → " + wnH(G, t.final.w) : " (au prochain grand show)") + "</p>" : "");
    else if (t.fmt === "gauntlet") inner = '<p class="uvsm">' + t.m.map(x => wnH(G, x)).join(", ") + "</p>";
    else inner = '<div class="uvbr">' + t.r.map(r => '<div class="uvbrc"><small>' + RN(r.length) + "</small>" + r.map(m => '<div class="uvbrm"><span' + (m.w && m.w === m.a ? ' class="w"' : "") + ">" + esc(m.a ? wn(G, m.a) : "?") + "</span><span" + (m.w && m.w === m.b ? ' class="w"' : "") + ">" + esc(m.b ? wn(G, m.b) : "?") + "</span></div>").join("") + "</div>").join("") + "</div>";
    return '<div class="uvcard"><div class="uvrow">' + (img ? '<img class="uvbelt big" src="' + esc(img) + '" alt="">' : '<span class="uvcup" aria-hidden="true">🏆</span>') + '<div class="uvgrow"><b>' + esc(t.n) + (t.ed > 1 ? " (édition " + t.ed + ")" : "") + "</b><small>" + ({ bracket: "Tableau", league: "Ligue", gauntlet: "Gauntlet" }[t.fmt] || "") + " · " + t.size + " · " + ({ h: "hommes", f: "femmes", x: "intergender" }[t.cat] || "") + " · prestige " + Math.round(t.pres || 40) + "</small><small>Récompense : " + ({ shot: "match de titre", trophy: "trophée", case: "mallette" }[t.pr] || "") + "</small></div>" + (t.win ? '<span class="uvstat ok">' + wnH(G, t.win) + "</span>" : "") + "</div>" + inner +
      (t.win ? "" : '<p class="uvsm">Les matchs se jouent dans tes shows : « + Match du tournoi » dans la carte. La finale, dans un grand show.</p>') + '<div class="uvrow2">' + imgBtn("o:" + t.id, "🏆 Image du trophée") + '<button type="button" class="uvbtn sm del" data-act="uvtodel2" data-t="' + esc(t.id) + '">Supprimer</button></div></div>';
  };
  return L.map(card).join("") + '<form class="uvcard uvform" data-form="uvtonew2"><h3 class="uvh3">Nouveau tournoi</h3><label class="uvfld">Nom<input name="n" maxlength="50" required list="uvtnames" placeholder="Ex. : King of the Ring"><datalist id="uvtnames">' + names.map(n => '<option value="' + esc(n) + '">').join("") + "</datalist></label>" +
    '<div class="uvfgrid"><label class="uvmini">Format<select name="fmt"><option value="bracket">Tableau (élimination)</option><option value="league">Ligue (points)</option><option value="gauntlet">Gauntlet</option></select></label><label class="uvmini">Participants<select name="size"><option>4</option><option selected>8</option><option>10</option><option>12</option><option>16</option></select></label>' +
    '<label class="uvmini">Pour<select name="cat"><option value="h">Hommes</option><option value="f">Femmes</option><option value="x">Tout le monde (intergender)</option></select></label><label class="uvmini">Récompense<select name="pr"><option value="shot">Match de titre</option><option value="trophy">Trophée</option><option value="case">Mallette</option></select></label></div>' +
    '<p class="uvsm">Les plus populaires et en forme sont pris automatiquement. Le tournoi gagne en prestige à chaque édition.</p><button class="uvbtn pri">Créer le tournoi</button></form>';
}
FORM.uvtonew2 = f => { const G = U.G, o = { n: f.n.value.trim(), fmt: f.fmt.value, size: +f.size.value, cat: f.cat.value, pr: f.pr.value }; if (!o.n) return; if (o.fmt === "bracket" && [4, 8, 16].indexOf(o.size) < 0) o.size = o.size > 8 ? 16 : 8; const r = createTour(G, o); if (r.err) { toast(r.err); return; } persist(); toast("Tournoi créé : ajoute ses matchs dans tes prochains shows"); redraw(); };
ACT.uvtodel2 = el => { const G = U.G; G.tours = (G.tours || []).filter(t => t.id !== el.dataset.t); persist(); redraw(); };

// ---------- Créatif › Traditions ----------
export function tradBody(G) {
  const mine = (G.trad || []).filter(x => x.fed === G.me), others = (G.trad || []).filter(x => x.fed !== G.me && G.F[x.fed]), ed = U.f.tred;
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>";
  const form = x => '<form class="uvform" data-form="uvtrad" data-id="' + esc(x ? x.id : "") + '"><label class="uvfld">Nom<input name="n" maxlength="50" required value="' + esc(x ? x.n : "") + '"></label><div class="uvfgrid">' +
    '<label class="uvmini">Genre<select name="k">' + opt("match", "Un match", x ? x.k : "match") + opt("tour", "Un tournoi", x ? x.k : "") + "</select></label>" +
    '<label class="uvmini">Match<select name="t">' + ["rumble", "battle", "ladder", "chamber", "wargames", "gauntlet", "ultimatex", "cage", "simple"].map(k => opt(k, MT[k].n, x ? x.t : "battle")).join("") + "</select></label>" +
    '<label class="uvmini">Mois<select name="m">' + MONTHS.map((m, i) => opt(i, m, x ? x.m : 0)).join("") + "</select></label><label class=\"uvmini\">Taille<input type=\"number\" name=\"z\" min=\"2\" max=\"30\" value=\"" + (x ? x.z : 10) + '"></label>' +
    '<label class="uvmini">Récompense<select name="pr">' + [["shot", "Match de titre"], ["case", "Mallette (encaisser quand on veut)"], ["trophy", "Trophée"], ["apuestas", "Masque / cheveux"]].map(p => opt(p[0], p[1], x ? x.pr : "shot")).join("") + "</select></label>" +
    '<label class="uvmini">Pour<select name="x">' + [["h", "Hommes"], ["f", "Femmes"], ["hf", "Hommes et femmes (2 matchs)"]].map(p => opt(p[0], p[1], x ? x.x : "h")).join("") + "</select></label></div>" +
    '<label class="uvspot"><input type="checkbox" name="on"' + (!x || x.on ? " checked" : "") + '><span>Active</span></label><button class="uvbtn pri">' + (x ? "Enregistrer" : "Créer la tradition") + "</button></form>";
  return '<p class="uvsm">Les matchs et tournois qui reviennent chaque année. Renomme-les, change leurs règles, ou crée les tiens : ils apparaissent dans la carte du grand show du mois (« + … »).</p>' +
    (mine.length ? mine.map(x => '<div class="uvcard">' + (ed === x.id ? form(x) : '<div class="uvrow"><div class="uvgrow"><b>' + esc(x.n) + (x.on ? "" : " (désactivée)") + "</b><small>" + esc(x.k === "tour" ? "Tournoi" : (MT[x.t] || MT.battle).n) + " · " + MONTHS[x.m] + " · " + x.z + " · " + ({ shot: "match de titre", case: "mallette", trophy: "trophée", apuestas: "masque / cheveux" }[x.pr] || "") + " · prestige " + Math.round(x.pres || 50) + '</small></div><button type="button" class="uvbtn sm" data-act="uvtred" data-id="' + esc(x.id) + '">Modifier</button></div>') + "</div>").join("") : '<p class="uvempty">Ta fédération n’a pas encore de tradition.</p>') +
    '<details class="uvdet"><summary>Nouvelle tradition</summary>' + form(null) + "</details>" +
    (others.length ? '<details class="uvdet"><summary>Les traditions des autres fédérations</summary><div class="uvpad">' + others.map(x => '<div class="uvline"><span class="uvdate">' + esc(G.F[x.fed].sh) + '</span><span class="uvgrow">' + esc(x.n) + '</span><span class="uvmut">' + MONTHS[x.m] + "</span></div>").join("") + "</div></details>" : "");
}
ACT.uvtred = el => { U.f.tred = el.dataset.id; redraw(); };
FORM.uvtrad = f => { const v = n => (f.elements.namedItem(n) || {}).value; saveTrad(U.G, f.dataset.id, { n: v("n").trim(), k: v("k"), t: v("t"), m: +v("m"), z: Math.max(2, Math.min(30, +v("z") || 10)), pr: v("pr"), x: v("x"), on: !!f.elements.namedItem("on").checked }); U.f.tred = ""; persist(); toast("Tradition enregistrée"); redraw(); };

// ---------- Créatif › Draft ----------
export function draftBody(G) {
  const f = meF(G); if (f.shows.length < 2) return '<p class="uvempty">Il faut au moins 2 shows pour séparer l’effectif en marques (Activité › Business › Grandir : un 2e show).</p>';
  const R = roster(G).filter(w => w.fed === G.me).sort((a, b) => b.pop - a.pop);
  return '<label class="uvspot"><input type="checkbox" data-act="uvsplit"' + (f.split ? " checked" : "") + '><span>Séparer l’effectif par show (brand split)</span></label>' +
    (f.split ? '<button type="button" class="uvbtn" data-act="uvdraft">Faire le draft automatiquement</button>' + f.shows.map(s => { const L = R.filter(w => w.br === s.n); return '<h3 class="uvh3">' + esc(s.n) + " (" + L.length + ")</h3>"; }).join("") +
      R.map(w => '<div class="uvline">' + face(G, w, 28) + '<span class="uvgrow">' + esc(w.n) + '</span><select data-act="uvbrand" data-w="' + esc(w.id) + '" aria-label="Show de ' + esc(w.n) + '"><option value="">Les deux</option>' + f.shows.map(s => '<option value="' + esc(s.n) + '"' + (w.br === s.n ? " selected" : "") + ">" + esc(s.n) + "</option>").join("") + "</select></div>").join("") : '<p class="uvsm">Sans brand split, tout le monde peut être mis sur tous les shows.</p>');
}
ACT.uvsplit = el => { const f = meF(U.G); f.split = !f.split; persist(); redraw(); };
ACT.uvdraft = () => { autoDraft(U.G); persist(); toast("Draft fait !"); redraw(); };
if (typeof document !== "undefined") document.addEventListener("change", e => { const s = e.target.closest && e.target.closest('select[data-act="uvbrand"]'); if (!s || !U.G) return; setBrand(U.G, s.dataset.w, s.value); persist(); });
export { runTimer };
