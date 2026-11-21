// Mode Univers v3 (21 nov.) : le show « comme à la télé » — plein écran pendant le direct : entrées des catcheurs avec leurs photos,
// barre d'élan, compte « 1… 2… » au tombé, public qui gronde ou explose, moments clés où tu choisis (laisser faire, encore un dégagement,
// finir maintenant, changer le vainqueur, envoyer quelqu'un), puis le générique de fin. Pas de son (choix de Jose).
import { ACT } from "../state.js";
import { esc, toast } from "../util.js";
import { U, go, redraw, persist, face, imgW, imgEv, imgT, crest, pickW, wnH } from "./core.js";
import { meF, roster, avail, wn, teamName } from "./base.js";
import { MT, SEG, FIN } from "./data.js";
import { mtOf, idsOf, stepLive, orderLive } from "./match.js";
import { stars, fmtM, fmtK, clamp } from "./world.js";

const SPD = { 1: 1700, 2: 800, 4: 330 };
let timer = 0;
export function runTimer() {
  clearInterval(timer); const LV = U.live; if (!LV || LV.sp === 0) return;
  timer = setInterval(() => {
    const G = U.G, LV2 = U.live; if (!G || !LV2) { clearInterval(timer); return; }
    if (location.hash.indexOf("#/univers/live/") !== 0) { clearInterval(timer); LV2.sp = 0; return; }
    tick(G, LV2);
  }, SPD[LV.sp] || 1700);
}
function endShow(G, ev) {
  clearInterval(timer); if (U.afterLive) U.afterLive(G, ev); persist(true);
  U.live = null; U.liveEnd = ev.id; redraw();
}
function tick(G, LV) {
  const ev = G.ev.find(e => e.id === LV.ev); if (!ev) return;
  if (LV.hold > 0) { LV.hold--; return; }
  const r = stepLive(G, ev, LV.L);
  if (r.show) { endShow(G, ev); return; }
  const last = LV.L.log[LV.L.log.length - 1] || {};
  // on laisse le temps de voir l'entrée des catcheurs et le résultat
  if (last.res || last.big) LV.hold = LV.sp === 1 ? 1 : LV.sp === 2 ? 1 : 0;
  // moment clé (seulement à ton show, une fois par match) : on met en pause et on te demande
  const C = LV.L.cur;
  if (LV.L.mine && C && !LV.noKey && !C.asked && ((last.ty === "near" && C.it.it === "m") || last.alert === "inj")) {
    C.asked = true; LV.key = { k: last.alert === "inj" ? "inj" : "near", who: last.who }; LV.sp0 = LV.sp; LV.sp = 0; clearInterval(timer);
  }
  redraw();
}
ACT.uvlsp = el => {
  const LV = U.live; if (!LV) return; const v = el.dataset.v;
  if (v === "end") { const G = U.G, ev = G.ev.find(e => e.id === LV.ev); let g = 0; LV.key = null; while (U.live && g++ < 3000) { const r = stepLive(G, ev, LV.L); if (r.show) { endShow(G, ev); return; } } return; }
  LV.sp = +v; LV.key = null; runTimer(); redraw();
};
ACT.uvtvq = () => { const LV = U.live; if (LV) { LV.sp = 0; clearInterval(timer); } go("#/univers/ev/" + encodeURIComponent(LV ? LV.ev : "")); };
ACT.uvtvord = el => { const LV = U.live; if (!LV) return; LV.ord = !LV.ord; redraw(); };
function order(o, v) {
  const G = U.G, LV = U.live; if (!LV) return; const ev = G.ev.find(e => e.id === LV.ev);
  if (orderLive(G, ev, LV.L, o, v)) toast({ faster: "On accélère !", longer: "Encore un dégagement…", finish: "Va au finish !", win: "Consigne transmise à l’arbitre", runin: "Intervention lancée !", medic: "Le médecin y va", pub: "Coupure pub" }[o] || "OK");
}
// réponses aux moments clés et ordres du tiroir
ACT.uvkey = el => {
  const G = U.G, LV = U.live; if (!LV) return; const a = el.dataset.k, C = LV.L.cur;
  const resume = () => { LV.key = null; LV.ord = false; LV.sp = LV.sp0 || 1; runTimer(); redraw(); };
  if (a === "runin") { const ids = C ? idsOf(C.it) : [], R = roster(G).filter(w => ids.indexOf(w.id) < 0 && avail(G, w));
    return pickW(G, "Qui débarque dans le ring ?", [["", R.map(w => ({ w: w, info: "Pop " + Math.round(w.pop) + (w.al === "heel" ? " · heel" : " · face") }))]], id => { order("runin", id); resume(); }); }
  if (a === "nokey") { LV.noKey = true; return resume(); }
  if (a === "win") order("win", el.dataset.v);
  else if (a !== "go") order(a);
  resume();
};
ACT.uvtvo = el => { order(el.dataset.o, el.dataset.v); if (el.dataset.o === "runin") return; redraw(); };

// ---------- l'écran ----------
const hh = m => Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
const crowdOf = c => c >= 80 ? ["Brûlant", "hot4"] : c >= 62 ? ["Chaud", "hot3"] : c >= 45 ? ["Tiède", "hot2"] : ["Froid", "hot1"];
function sideBox(G, s, cls, who, big) {
  return '<div class="uvtvs ' + (cls || "") + '">' + '<div class="uvtvph">' + s.map(i => { const w = G.W[i]; return '<span class="uvtvp' + (i === who ? " on" : "") + '">' + (w && imgW(G, w) ? '<img src="' + esc(imgW(G, w)) + '" alt="">' : face(G, w, big ? 120 : 64)) + "</span>"; }).join("") + "</div>" +
    "<b>" + esc(teamName(G, s)) + "</b></div>";
}
function finTxt(r) {
  if (r.fin === "subm") return ["IL ABANDONNE !", "Soumission"]; if (r.fin === "dq") return ["DISQUALIFICATION", ""]; if (r.fin === "co" || r.fin === "dco") return ["… 8… 9… 10 !", (FIN[r.fin] || [""])[0]];
  if (r.fin === "nc") return ["NO CONTEST", ""]; return ["1… 2… 3 !", (FIN[r.fin] || [""])[0]];
}
function stage(G, ev, L) {
  const C = L.cur, last = L.log[L.log.length - 1];
  // avant le début : l'affiche du show
  if (!last) { const im = imgEv(G, ev), first = ev.items[0];
    return '<div class="uvtvopen">' + (im ? '<img src="' + esc(im) + '" alt="">' : crest(G, ev.fed, 96)) + "<h2>" + esc(ev.n) + "</h2><p>" + ev.items.length + " segments au programme · le public entre dans la salle…</p>" + (first ? "<small>Pour commencer : " + esc(first.it === "m" ? (mtOf(first).n + " — " + sideNameS(G, first.sides)) : (SEG[first.k] || SEG.promo).n) + "</small>" : "") + "</div>"; }
  const it = ev.items[last.i != null ? last.i : L.i];
  // le résultat d'un match ou d'un segment
  if (last.res) { const r = L.out[L.out.length - 1] || {};
    if (r.it === "s") return '<div class="uvtvres seg"><small>Fin du segment</small>' + (r.w || []).slice(0, 2).map(i => '<span class="uvtvp big on">' + face(G, G.W[i], 120) + "</span>").join("") + '<div class="uvtvstars">' + stars(r.r) + "</div>" + (r.notes || []).slice(0, 2).map(n => "<p>" + esc(n) + "</p>").join("") + "</div>";
    const W = typeof r.win === "number" ? r.sides[r.win] : null, ft = finTxt(r), t = r.title && G.T[r.title];
    return '<div class="uvtvres"><div class="uvtvcnt done"><span>' + esc(ft[0]) + "</span></div>" + (W ? '<div class="uvtvwin">' + W.map(i => '<span class="uvtvp big on">' + face(G, G.W[i], 130) + "</span>").join("") + "</div><small>" + (W.length > 1 ? "Vainqueurs" : "Vainqueur" + (G.W[W[0]] && G.W[W[0]].sx === "f" ? "e" : "")) + "</small><b>" + esc(teamName(G, W)) + "</b>" : "<b>Pas de vainqueur</b>") +
      (ft[1] ? '<p class="uvtvfin">' + esc(ft[1]) + "</p>" : "") + '<div class="uvtvstars">' + stars(r.r) + "</div>" + (r.change && t ? '<div class="uvtvchamp">' + (imgT(G, t) ? '<img src="' + esc(imgT(G, t)) + '" alt="">' : "") + "<span>ET NOUVEAU" + (W && W.length > 1 ? "X CHAMPIONS" : " CHAMPION") + " !</span><small>" + esc(t.n) + "</small></div>" : t ? '<p class="uvtvfin">' + esc(t.n) + " conservé</p>" : "") + "</div>"; }
  if (!it) return "";
  // segment au micro / en coulisses
  if (it.it === "s") { const W = it.w || [];
    return '<div class="uvtvseg"><small>' + esc((SEG[it.k] || SEG.promo).n) + '</small><div class="uvtvsegp">' + W.slice(0, 2).map(i => '<span class="uvtvp big' + (i === last.who || W.length === 1 ? " on" : "") + '">' + face(G, G.W[i], 120) + "</span>").join("") + "</div>" + '<blockquote aria-live="polite">' + esc(last.txt) + "</blockquote></div>"; }
  const S = (it.sides || []).filter(s => s.length), t = it.title && G.T[it.title];
  // l'entrée des catcheurs
  if (last.big || last.ty === "intro") return '<div class="uvtvent"><small>' + esc(mtOf(it).n) + (L.i === ev.items.length - 1 ? " · MAIN EVENT" : "") + "</small>" +
    (t ? '<div class="uvtvbelt">' + (imgT(G, t) ? '<img src="' + esc(imgT(G, t)) + '" alt="">' : "") + "<span>" + esc(t.n) + " en jeu</span></div>" : "") +
    '<div class="uvtvvs">' + S.slice(0, 4).map((s, j) => sideBox(G, s, "e" + (j % 2), "", true)).join('<i class="uvtvx">VS</i>') + "</div>" + (S.length > 4 ? "<p>+ " + (S.length - 4) + " autres camps</p>" : "") + "</div>";
  // le match
  const two = S.length === 2, mom = C ? C.mom || 0 : 0, near = last.ty === "near";
  return '<div class="uvtvact' + (near ? " near" : "") + '"><div class="uvtvrow">' + (two ? sideBox(G, S[0], "a", last.who) + '<div class="uvtvmom" role="img" aria-label="Élan du match"><span style="left:' + (50 - mom / 2) + '%"></span></div>' + sideBox(G, S[1], "b", last.who) : S.map(s => sideBox(G, s, "m", last.who)).join("")) + "</div>" +
    (near ? '<div class="uvtvcnt"><span class="c1">1</span><span class="c2">2</span><span class="c3">DÉGAGEMENT !</span></div>' : "") +
    '<p class="uvtvpbp ' + esc(last.ty || "") + '" aria-live="polite">' + esc(last.txt) + "</p>" + (last.alert === "botch" ? '<p class="uvtvalert">Botch !</p>' : "") + "</div>";
}
const sideNameS = (G, sides) => (sides || []).map(s => teamName(G, s)).join(" contre ");
function keyPanel(G, L, LV) {
  const C = L.cur; if (!LV.key || !C) return "";
  const it = C.it, S = (it.sides || []).filter(s => s.length), w = LV.key.who && G.W[LV.key.who];
  if (LV.key.k === "inj") return '<div class="uvtvkey" role="dialog" aria-label="Moment clé"><b>' + (w ? esc(w.n) + " a l’air blessé" + (w.sx === "f" ? "e" : "") + " !" : "Blessure possible !") + "</b><p>Tu arrêtes tout ou le match continue ?</p>" +
    '<button type="button" class="uvbtn del" data-act="uvkey" data-k="medic">Envoyer le médecin (match arrêté)</button><button type="button" class="uvbtn" data-act="uvkey" data-k="go">On continue (risqué)</button></div>';
  return '<div class="uvtvkey" role="dialog" aria-label="Moment clé"><small>Moment clé</small><b>' + (w ? esc(w.n) + " a failli gagner !" : "Le tombé a failli passer !") + "</b><p>Tu parles à l’arbitre dans l’oreillette :</p>" +
    '<button type="button" class="uvbtn pri" data-act="uvkey" data-k="go">Laisser le match se finir</button>' +
    '<button type="button" class="uvbtn" data-act="uvkey" data-k="longer">Encore un dégagement ! (plus long, le public adore)</button>' +
    '<button type="button" class="uvbtn" data-act="uvkey" data-k="finish">On termine maintenant</button>' +
    (S.length <= 4 ? '<div class="uvtvkw">' + S.map((s, j) => '<button type="button" class="uvbtn sm" data-act="uvkey" data-k="win" data-v="' + j + '">Faire gagner ' + esc(teamName(G, s)) + "</button>").join("") + "</div>" : "") +
    '<button type="button" class="uvbtn" data-act="uvkey" data-k="runin">Envoyer quelqu’un dans le ring…</button>' +
    '<button type="button" class="uvbtn ghost sm" data-act="uvkey" data-k="nokey">Ne plus me demander ce soir</button></div>';
}
function drawer(G, L) {
  const C = L.cur; if (!C) return '<div class="uvtvdr"><p>Les ordres arrivent au prochain segment.</p></div>';
  const S = C.it.it === "m" ? (C.it.sides || []).filter(s => s.length) : [];
  return '<div class="uvtvdr" role="group" aria-label="Tes ordres"><div class="uvrow2"><button type="button" class="uvbtn sm" data-act="uvtvo" data-o="faster">Accélérer</button><button type="button" class="uvbtn sm" data-act="uvtvo" data-o="longer">Rallonger</button>' +
    (S.length ? '<button type="button" class="uvbtn sm" data-act="uvtvo" data-o="finish">Aller au finish</button>' : "") + '<button type="button" class="uvbtn sm" data-act="uvtvo" data-o="pub">Couper à la pub</button>' + (C.alert === "inj" && !C.mod.medic ? '<button type="button" class="uvbtn sm del" data-act="uvtvo" data-o="medic">Envoyer le médecin</button>' : "") + "</div>" +
    (S.length ? '<div class="uvrow2">' + S.map((s, j) => '<button type="button" class="uvbtn sm ghost" data-act="uvtvo" data-o="win" data-v="' + j + '">Vainqueur : ' + esc(teamName(G, s)) + "</button>").join("") + '<button type="button" class="uvbtn sm ghost" data-act="uvtvo" data-o="win" data-v="nul">Draw</button><button type="button" class="uvbtn sm ghost" data-act="uvkey" data-k="runin">Intervention…</button></div>' : "") + "</div>";
}
function endScreen(G, ev) {
  const r = ev.res || {}, items = r.items || [], ms = items.filter(x => x.it === "m"), best = ms.slice().sort((a, b) => b.r - a.r)[0], f = meF(G), war = r.war;
  return '<div class="uvtv end"><div class="uvtvtop"><span class="uvtvon off">FIN</span><b>' + esc(ev.n) + '</b></div><div class="uvtvstage"><div class="uvtvfinal"><small>C’est la fin du show</small><div class="uvtvstars big">' + stars(r.r || 0) + "</div>" +
    '<div class="uvkv3"><div><b>' + fmtM(r.aud || 0) + "</b>téléspectateurs</div>" + (r.money != null ? '<div><b class="' + (r.money >= 0 ? "uvok" : "uvko") + '">' + fmtK(r.money) + "</b>recettes</div>" : "") + (r.att ? "<div><b>" + r.att.toLocaleString("fr-FR") + "</b>" + (r.full ? "spectateurs · COMPLET" : "spectateurs") + "</div>" : "") + "</div>" +
    (best ? '<p class="uvtvbest"><small>Le match du soir</small>' + best.sides.map(s => s.map(i => face(G, G.W[i], 44)).join("")).join('<i>VS</i>') + "<span>" + esc(sideNameS(G, best.sides)) + " · " + stars(best.r) + "</span></p>" : "") +
    (war ? '<p class="uvsm">Ce soir-là, ' + esc(war.n) + " passait aussi à la télé.</p>" : "") +
    '<div class="uvrow2"><button type="button" class="uvbtn pri" data-act="uvtvend" data-to="ev">Le rapport du show</button><button type="button" class="uvbtn" data-act="uvtvend" data-to="g">Menu général</button></div></div></div></div>';
}
ACT.uvtvend = el => { const id = U.liveEnd; U.liveEnd = null; go(el.dataset.to === "g" ? "#/univers/g" : "#/univers/ev/" + encodeURIComponent(id || "")); redraw(); };
export function liveView(id) {
  const G = U.G, ev = G.ev.find(e => e.id === id);
  if (!ev) return '<div class="uvtv"><div class="uvtvstage"><p class="uvempty">Show introuvable.</p><a class="uvbtn" href="#/univers/g">Menu général</a></div></div>';
  if (ev.done) return U.liveEnd === id ? endScreen(G, ev) : (U.resultsView ? U.resultsView(G, ev) : "");
  const LV = U.live && U.live.ev === id ? U.live : null;
  if (!LV) return '<div class="uvtv"><div class="uvtvstage"><div class="uvtvopen"><h2>' + esc(ev.n) + '</h2><p>Le direct n’est pas lancé.</p><a class="uvbtn pri" href="#/univers/ev/' + encodeURIComponent(id) + '">Retour à la carte</a></div></div></div>';
  const L = LV.L, cr = crowdOf(L.crowd), im = imgEv(G, ev);
  const dots = ev.items.map((x, i) => { const r = L.out[i]; return '<span class="uvtvd' + (i === L.i ? " on" : i < L.i ? " dn" : "") + '" title="' + esc(x.it === "m" ? sideNameS(G, x.sides) : (SEG[x.k] || SEG.promo).n) + '">' + (r ? stars(r.r) : i === ev.items.length - 1 ? "ME" : i + 1) + "</span>"; }).join("");
  return '<div class="uvtv ' + cr[1] + (LV.key ? " paused" : "") + '" style="--cz:' + (2.2 - clamp(L.crowd) / 60).toFixed(2) + 's">' +
    '<div class="uvtvtop"><span class="uvtvon">EN DIRECT</span>' + (im ? '<img class="uvtvlogo" src="' + esc(im) + '" alt="">' : "") + "<b>" + esc(ev.n) + '</b><span class="uvtvclk">' + hh(L.clock) + " / " + hh(L.len) + '</span><button type="button" class="uvtvx2" data-act="uvtvq" aria-label="Quitter le direct (pause)">✕</button></div>' +
    '<div class="uvtvstage">' + stage(G, ev, L) + "</div>" +
    '<div class="uvtvcrowd" role="img" aria-label="Public : ' + cr[0] + '"><div class="uvtvfans" aria-hidden="true"></div><span>Public <b>' + cr[0] + '</b></span><span class="uvtvcb"><i style="width:' + clamp(L.crowd) + '%"></i></span><b>' + Math.round(L.crowd) + "</b></div>" +
    keyPanel(G, L, LV) + (LV.ord && !LV.key ? drawer(G, L) : "") +
    '<div class="uvtvbar" role="group" aria-label="Vitesse"><button type="button" class="uvbtn sm' + (LV.sp === 0 && !LV.key ? " pri" : "") + '" data-act="uvlsp" data-v="0" aria-pressed="' + (LV.sp === 0) + '">⏸</button>' + [1, 2, 4].map(v => '<button type="button" class="uvbtn sm' + (LV.sp === v ? " pri" : "") + '" data-act="uvlsp" data-v="' + v + '" aria-pressed="' + (LV.sp === v) + '">×' + v + "</button>").join("") +
    '<button type="button" class="uvbtn sm' + (LV.ord ? " on" : "") + '" data-act="uvtvord" aria-expanded="' + !!LV.ord + '">Ordres</button><button type="button" class="uvbtn sm ghost" data-act="uvlsp" data-v="end" aria-label="Aller à la fin du show">⏭</button></div>' +
    '<div class="uvtvdots">' + dots + "</div>" +
    '<details class="uvtvlog"><summary>Le déroulé</summary><ol>' + L.log.slice(-16).reverse().map(l => "<li" + (l.res ? ' class="rs"' : "") + "><span>" + hh(l.c) + "</span>" + (l.who && G.W[l.who] ? face(G, G.W[l.who], 22, "in") : "") + esc(l.txt) + "</li>").join("") + "</ol></details></div>";
}
