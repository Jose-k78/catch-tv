// Mode Univers v2 : business, partenaires, audiences, diffuseurs, pages des fédérations, Hall of Fame, magazine TCC 100,
// encyclopédie, bureau du GM (objectifs, réputation, trophées, résumés, agenda, réglages), écran de défilement des jours, tuto.
const lsMus = () => { try { return localStorage.getItem("ctv.univ.mus") !== "0"; } catch (e) { return true; } };
import { ACT, FORM } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { MONTHS, WDL, dayLabel, shortDate, dateOf, fmtM, fmtK, stars, clamp, recTxt } from "./world.js";
import { VENUES, TOURS, REGIONS, LIC, ACH, MAGN, STRAT, MT } from "./data.js";
import { meF, wn, roster, myStaff, champIds, teamName, sideName, isBig } from "./base.js";
import { nextDay, stepDay, myEventToday, nextMyEvents } from "./sim.js";
import { setVenue, setTix, planTour, tvOffers, takeTv, licOk, takeLic, borrow, investor, EXP, expand, buyPrice, buyFed, switchFed, mania, advise } from "./biz.js";
import { part, propose, lend, rent, invasion, jointShow } from "./deal.js";
import { hofInduct } from "./life.js";
import { gimOf } from "./v2.js";
import { DNA, dnaMain, dnaNext } from "./dna.js";
import { repWord } from "./vn.js";
import { gmFace, gmName } from "./setup.js";
import { U, go, redraw, persist, shell, tabs, chips, face, crest, wnH, teamH, sidesH, whoIn, imgT, imgBtn, showPrompt } from "./core.js";

const bar = (v, c) => '<span class="uvbar"><i style="width:' + clamp(v) + "%" + (c ? ";background:" + c : "") + '"></i></span>';
const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>";

// ---------- Activité › Business ----------
export function bizBody(G) {
  const f = meF(G), V = VENUES[f.venue] || VENUES[1], E = f.exp || {}, small = Object.values(G.F).filter(o => o.id !== G.me && o.pop <= f.pop - 10);
  return '<div class="uvtile"><div class="uvth">Salles et billets</div><p class="uvsm">La salle de tes shows TV (chaque grand show a sa salle dans sa carte). Plus c’est grand, plus ça coûte : il faut la remplir.</p>' +
    '<form class="uvform" data-form="uvven"><label class="uvfld">Salle<select name="v">' + VENUES.map((v, i) => opt(i, v[0] + " · " + v[1].toLocaleString("fr-FR") + " places · " + fmtK(v[2]) + " par show", f.venue)).join("") + '</select></label><label class="uvfld">Prix du billet ($)<input type="number" name="p" min="5" max="250" value="' + (f.tix || 25) + '"></label><button class="uvbtn">Enregistrer</button></form></div>' +
    '<div class="uvtile"><div class="uvth">Tournée à l’étranger</div>' + (G.tourA ? '<p class="uvok">En tournée : ' + esc(G.tourA.n) + " jusqu’au " + esc(shortDate(G.tourA.until)) + ".</p>" : '<p class="uvsm">Des shows là-bas : ta popularité y monte (et ça fatigue l’effectif).</p><form class="uvinl" data-form="uvtourA"><select name="r" aria-label="Pays">' + Object.keys(TOURS).map(r => opt(r, TOURS[r][0][0] + " (" + fmtK(TOURS[r][0][1]) + "/semaine) · ta popularité " + Math.round((f.reg || {})[r] || 0), "")).join("") + '</select><select name="w" aria-label="Durée"><option value="1">1 semaine</option><option value="2" selected>2 semaines</option><option value="3">3 semaines</option></select><button class="uvbtn">Réserver</button></form>') + "</div>" +
    '<div class="uvtile"><div class="uvth">Licences</div>' + Object.keys(LIC).map(k => { const L = LIC[k], cur = (G.lic || []).find(x => x.k === k && x.until > G.day); return '<div class="uvline"><span class="uvgrow">' + esc(L[0]) + "<small> · popularité " + L[1] + " min.</small></span>" + (cur ? '<span class="uvok">' + fmtK(cur.pay) + "/mois jusqu’au " + esc(shortDate(cur.until)) + "</span>" : '<button type="button" class="uvbtn sm' + (licOk(G, k) ? " pri" : "") + '" data-act="uvlic" data-k="' + k + '"' + (licOk(G, k) ? "" : " disabled") + ">Signer</button>") + "</div>"; }).join("") + "</div>" +
    '<div class="uvtile"><div class="uvth">Banque</div>' + (G.loan ? '<p>Prêt en cours : reste ' + fmtK(G.loan.left) + " (" + fmtK(G.loan.mo) + "/mois).</p>" : '<div class="uvrow2">' + [1000, 3000, 10000].map(a => '<button type="button" class="uvbtn sm" data-act="uvloan" data-a="' + a + '">Emprunter ' + fmtK(a) + "</button>").join("") + "</div>") +
    (f.inv ? '<p class="uvsm">Un investisseur prend 5 % de tes recettes.</p>' : '<button type="button" class="uvbtn sm ghost" data-act="uvinv">Faire entrer un investisseur (+2 M$, 5 % des recettes)</button>') + "</div>" +
    '<div class="uvtile"><div class="uvth">Grandir</div>' + Object.keys(EXP).map(k => '<div class="uvline"><span class="uvgrow">' + esc(EXP[k][0]) + "<small> · " + fmtK(EXP[k][1]) + " · popularité " + EXP[k][2] + "</small></span>" + (E[k] ? '<span class="uvok">Fait</span>' : '<button type="button" class="uvbtn sm" data-act="uvexp" data-k="' + k + '">Lancer</button>') + "</div>").join("") +
    (E.stream ? '<p class="uvsm">Abonnés à ta plateforme : ' + Math.round(E.subs || 0).toLocaleString("fr-FR") + ".</p>" : "") +
    '<h3 class="uvh3">Racheter une fédération</h3>' + (small.length ? small.map(o => '<div class="uvline">' + crest(G, o.id, 26) + '<span class="uvgrow">' + esc(o.n) + "<small> · " + fmtK(buyPrice(G, o.id)) + '</small></span><button type="button" class="uvbtn sm" data-act="uvbuy" data-f="' + esc(o.id) + '">Racheter</button></div>').join("") : '<p class="uvmut">Aucune fédération assez petite pour l’instant (10 points de popularité de moins que toi).</p>') + "</div>";
}
FORM.uvven = f => { setVenue(U.G, f.v.value); setTix(U.G, f.p.value); persist(); toast("Salle et billets enregistrés"); redraw(); };
FORM.uvtourA = f => { toast(planTour(U.G, f.r.value, +f.w.value)); persist(); redraw(); };
ACT.uvlic = el => { toast(takeLic(U.G, el.dataset.k)); persist(); redraw(); };
ACT.uvloan = el => { toast(borrow(U.G, +el.dataset.a)); persist(); redraw(); };
ACT.uvinv = () => { toast(investor(U.G)); persist(); redraw(); };
ACT.uvexp = el => { toast(expand(U.G, el.dataset.k)); persist(); redraw(); };
ACT.uvbuy = el => { const G = U.G, o = G.F[el.dataset.f]; if (!o) return; modal((box, close) => { box.classList.add("uvmodal"); box.innerHTML = "<h3>Racheter " + esc(o.n) + " ?</h3><p>Prix : " + fmtK(buyPrice(G, o.id)) + ". Ses catcheurs, titres et traditions te rejoignent.</p><button type=\"button\" class=\"uvbtn pri\" data-y=\"1\">Racheter</button><button type=\"button\" class=\"uvbtn ghost\" data-n=\"1\">Annuler</button>"; box.addEventListener("click", e => { if (e.target.closest("[data-n]")) close(); if (e.target.closest("[data-y]")) { toast(buyFed(G, o.id)); persist(); close(); redraw(); } }); }); };

// ---------- Activité › Partenaires ----------
export function partBody(G) {
  const R = roster(G).filter(w => w.fed === G.me && !w.guest), sats = []; for (let d = G.day + 7; d < G.day + 70; d++) if (dateOf(d).wd === 6 && !G.ev.some(e => e.fed === G.me && e.day === d && isBig(e))) sats.push(d);
  const guests = Object.values(G.W).filter(w => w.guest && w.guest.until >= G.day && (w.guest.to === G.me || w.fed === G.me));
  return '<p class="uvsm">Une jauge par fédération, de rivale à alliée. Avec un partenariat : prête tes catcheurs (ils restent sous contrat chez toi et tu peux toujours les utiliser), loue les leurs, fais un show commun ou une invasion.</p>' +
    (guests.length ? '<h3 class="uvh3">Prêts en cours</h3>' + guests.map(w => '<div class="uvline">' + face(G, w, 26) + '<span class="uvgrow">' + esc(w.n) + "<small> · " + (w.fed === G.me ? "prêté à " + esc((G.F[w.guest.to] || {}).n || "") : "chez toi (vient de " + esc((G.F[w.fed] || {}).n || "") + ")") + " jusqu’au " + esc(shortDate(w.guest.until)) + "</small></span></div>").join("") : "") +
    Object.values(G.F).filter(o => o.id !== G.me).map(o => { const p = part(G, o.id), them = roster(G, o.id).filter(w => w.fed === o.id && !w.guest).sort((a, b) => b.pop - a.pop).slice(0, 25);
      return '<div class="uvcard"><div class="uvrow">' + crest(G, o.id, 36) + '<div class="uvgrow"><b>' + esc(o.n) + "</b><small>" + esc(STRAT[o.strat] || "") + (p.deal ? (p.deal.sis ? " · fédération sœur (liée à la WWE : catcheurs partagés, Worlds Collide)" : " · partenaire jusqu’au " + esc(shortDate(p.deal.until))) : "") + '</small></div><a class="uvbtn sm ghost" href="#/univers/fed/' + esc(o.id) + '">Voir</a></div>' +
        '<div class="uvst2 wide"><span>Relation</span><span class="uvrelb ' + (p.rel >= 0 ? "f" : "e") + '"><i style="width:' + Math.abs(p.rel) + '%"></i></span><b>' + (p.rel > 0 ? "+" : "") + Math.round(p.rel) + "</b></div>" +
        (p.deal ? '<form class="uvinl" data-form="uvlend" data-f="' + esc(o.id) + '"><select name="w" aria-label="Catcheur à prêter"><option value="">Prêter un de mes catcheurs…</option>' + R.map(w => opt(w.id, w.n, "")).join("") + '</select><select name="k" aria-label="Durée"><option value="2">2 sem.</option><option value="4" selected>4 sem.</option><option value="8">8 sem.</option></select><button class="uvbtn sm">Prêter</button></form>' +
          '<form class="uvinl" data-form="uvrent"><select name="w" aria-label="Catcheur à louer"><option value="">Louer un des leurs…</option>' + them.map(w => opt(w.id, w.n + " (" + Math.round(w.pop) + ")", "")).join("") + '</select><select name="k" aria-label="Durée"><option value="1">1 sem.</option><option value="2" selected>2 sem.</option><option value="4">4 sem.</option></select><button class="uvbtn sm">Louer</button></form>' +
          '<form class="uvinl" data-form="uvjoint" data-f="' + esc(o.id) + '"><select name="d" aria-label="Date">' + sats.map(d => opt(d, dayLabel(d), "")).join("") + '</select><button class="uvbtn sm">Show commun</button></form><button type="button" class="uvbtn sm ghost" data-act="uvinvade" data-f="' + esc(o.id) + '">Lancer une invasion</button>'
          : '<button type="button" class="uvbtn sm' + (p.rel >= 15 ? " pri" : "") + '" data-act="uvpropose" data-f="' + esc(o.id) + '">Proposer un partenariat</button>') + "</div>"; }).join("");
}
ACT.uvpropose = el => { toast(propose(U.G, el.dataset.f)); persist(); redraw(); };
FORM.uvlend = f => { if (!f.w.value) return; toast(lend(U.G, f.w.value, f.dataset.f, +f.k.value)); persist(); redraw(); };
FORM.uvrent = f => { if (!f.w.value) return; toast(rent(U.G, f.w.value, +f.k.value)); persist(); redraw(); };
FORM.uvjoint = f => { toast(jointShow(U.G, f.dataset.f, +f.d.value)); persist(); redraw(); };
ACT.uvinvade = el => { toast(invasion(U.G, el.dataset.f)); persist(); redraw(); };

// ---------- Activité › Audiences (par semaine) ----------
export function audBody(G) {
  const W = Object.keys(G.wk || {}).map(Number).sort((a, b) => a - b).slice(-16), feds = Object.keys(G.F), last = W[W.length - 1];
  if (W.length < 2) return '<p class="uvempty">La courbe arrive après deux semaines de shows.</p>';
  const max = Math.max(0.1, ...W.map(w => Math.max(...feds.map(k => (G.wk[w] || {})[k] || 0)))), top = feds.slice().sort((a, b) => ((G.wk[last] || {})[b] || 0) - ((G.wk[last] || {})[a] || 0)).slice(0, 5);
  if (top.indexOf(G.me) < 0) top.push(G.me);
  const X = i => 8 + i * (284 / (W.length - 1)), Y = v => 150 - v / max * 136, col = k => k === G.me ? "#f5b13d" : (G.F[k] || {}).c || "#6fb3ff";
  const lines = top.map(k => '<polyline fill="none" stroke="' + esc(col(k)) + '" stroke-width="' + (k === G.me ? 3 : 1.6) + '" points="' + W.map((w, i) => X(i) + "," + Y((G.wk[w] || {})[k] || 0)).join(" ") + '"></polyline>').join("");
  return '<div class="uvtile"><div class="uvth">Audience moyenne par semaine</div><svg class="uvchart2" viewBox="0 0 300 160" role="img" aria-label="Audience par semaine des principales fédérations">' + lines + "</svg>" +
    '<div class="uvleg2">' + top.map(k => '<span><i style="background:' + esc(col(k)) + '"></i>' + esc((G.F[k] || {}).n || k) + "</span>").join("") + "</div></div>" +
    '<h3 class="uvh3">Cette semaine</h3><ol class="uvrank">' + feds.filter(k => (G.wk[last] || {})[k]).sort((a, b) => G.wk[last][b] - G.wk[last][a]).map(k => "<li><span class=\"uvgrow\">" + esc(G.F[k].n) + "</span><b" + (k === G.me ? ' class="uvok"' : "") + ">" + fmtM(G.wk[last][k]) + "</b></li>").join("") + "</ol>";
}
// ---------- Contrats TV : offres des diffuseurs ----------
export function tvBody(G) {
  const f = meF(G), can = !G.tvOffD || G.day - G.tvOffD >= 30 || f.tv.end - G.day <= 31;
  return '<div class="uvtile"><div class="uvth">Ton diffuseur <i>' + esc(f.tv.n) + '</i></div><div class="uvkv"><span>Par show</span>' + fmtK(f.tv.pay) + '</div><div class="uvkv"><span>Objectif</span>' + fmtM(f.tv.min) + '</div><div class="uvkv"><span>Créneau</span>' + esc(WDL[f.shows[0].wd]) + " " + ((f.slot || {}).h || 20) + " h · " + (((f.slot || {}).len || 120) / 60) + ' h</div><div class="uvkv"><span>Fin</span>' + esc(dayLabel(f.tv.end, true)) + "</div></div>" +
    (G.tvOff && G.tvOff.length ? '<h3 class="uvh3">Les offres</h3>' + G.tvOff.map((o, i) => '<div class="uvcard"><div class="uvrow"><b class="uvgrow">' + esc(o.net) + "</b><b>" + fmtK(o.pay) + '/show</b></div><p class="uvsm">' + esc(WDL[o.wd]) + " à " + o.h + " h · " + o.len / 60 + " h · objectif " + fmtM(o.min) + " · " + o.y + " an" + (o.y > 1 ? "s" : "") + (o.wd !== f.shows[0].wd ? " · ton show changera de jour" : "") + '</p><button type="button" class="uvbtn sm pri" data-act="uvtvtake" data-i="' + i + '">Signer</button></div>').join("") : "") +
    '<button type="button" class="uvbtn" data-act="uvtvask"' + (can ? "" : " disabled") + ">Demander des offres aux diffuseurs" + (can ? "" : " (une fois par mois)") + "</button>";
}
ACT.uvtvask = () => { const G = U.G; G.tvOff = tvOffers(G); G.tvOffD = G.day; persist(); redraw(); };
ACT.uvtvtake = el => { const G = U.G, o = (G.tvOff || [])[+el.dataset.i]; if (!o) return; takeTv(G, o); G.tvOff = []; persist(); toast("Contrat TV signé avec " + o.net); redraw(); };

// ---------- page d'une fédération ----------
export function fedView(id) {
  const G = U.G, o = G.F[id]; if (!o) return shell("monde", "Fédération", "", '<p class="uvempty">Cette fédération n’existe plus.</p>');
  const R = roster(G, id).sort((a, b) => b.pop - a.pop), A = (G.aiShows || {})[id] || [], T = Object.values(G.T).filter(t => t.fed === id), p = id === G.me ? null : part(G, id);
  const body = '<a class="uvback" href="#/univers/monde/f">‹ Fédérations</a><div class="uvfhead">' + crest(G, id, 64) + '<div class="uvgrow"><h2>' + esc(o.n) + "</h2><small>" + (id === G.me ? "Ta fédération" : "Gérée par l’IA · " + esc(STRAT[o.strat] || "")) + "</small><small>Prestige <b>" + Math.round(o.pop) + "</b> · audience " + fmtM(o.aud.length ? o.aud[o.aud.length - 1] : o.aud0) + " · " + R.length + " catcheurs</small>" + imgBtn("f:" + id) + "</div></div>" +
    (p ? '<div class="uvst2 wide"><span>Relation</span><span class="uvrelb ' + (p.rel >= 0 ? "f" : "e") + '"><i style="width:' + Math.abs(p.rel) + '%"></i></span><b>' + Math.round(p.rel) + "</b></div>" : "") +
    '<h3 class="uvh3">Titres</h3>' + T.map(t => '<div class="uvline">' + (imgT(G, t) ? '<img class="uvbelt" src="' + esc(imgT(G, t)) + '" alt="">' : "") + '<span class="uvgrow">' + esc(t.n) + "</span><b>" + (champIds(t).length ? teamH(G, champIds(t)) : "vacant") + "</b></div>").join("") +
    '<h3 class="uvh3">Derniers shows</h3>' + (A.length ? A.slice().reverse().map(s => '<details class="uvres"><summary><div class="uvrow"><span class="uvgrow"><b>' + esc(s.n) + "</b><small> · " + esc(shortDate(s.d)) + " · " + fmtM(s.aud) + '</small></span><span class="uvstar">' + stars(s.r) + "</span></div></summary>" + s.m.map(m => '<p class="uvsm">' + (typeof m.w === "number" ? "<b>" + teamH(G, m.s[m.w]) + "</b> bat " + esc(m.s.filter((x, j) => j !== m.w).map(x => teamName(G, x)).join(", ")) : sidesH(G, m.s) + " : pas de vainqueur") + " · " + stars(m.r) + (m.c ? " · nouveau champion" : "") + "</p>").join("") + "</details>").join("") : '<p class="uvempty">Pas encore de show.</p>') +
    '<h3 class="uvh3">Les plus populaires</h3>' + R.slice(0, 12).map(w => '<a class="uvw" href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 32) + '<span class="uvgrow"><b>' + esc(w.n) + "</b><small>" + recTxt(w.rec) + '</small></span><span class="uvnote">' + Math.round(w.pop) + "<small>POP</small></span></a>").join("");
  return shell("monde", o.n, "", body);
}
// ---------- Hall of Fame, magazine, encyclopédie ----------
export function hofBody(G) {
  const y = dateOf(G.day).y, pending = G.mail.some(m => m.k === "hof" && dateOf(m.d).y === y) && !(G.hofDone || {})[y];
  const mem = (G.hof || []).filter(h => h.k === "mem").sort((a, b) => (+a.y || 0) - (+b.y || 0)), ind = (G.hof || []).filter(h => h.k === "hof").reverse();
  const legs = pending ? Object.values(G.W).filter(w => w.ret && w.leg && !(G.hof || []).some(h => h.n === w.n)).sort((a, b) => b.pop - a.pop).slice(0, 12) : [];
  return (pending ? '<div class="uvtile uvleg"><div class="uvth">Cérémonie de l’Année ' + y + "</div><p class=\"uvsm\">Qui entre au Hall of Fame cette année ?</p>" + legs.map(w => '<div class="uvline">' + face(G, w, 30) + '<span class="uvgrow">' + esc(w.n) + '</span><button type="button" class="uvbtn sm pri" data-act="uvhof" data-w="' + esc(w.id) + '">Introniser</button></div>').join("") + "</div>" : "") +
    '<h3 class="uvh3">Intronisés</h3>' + (ind.length ? ind.map(h => '<div class="uvline">' + (h.pic ? '<img class="uvav" src="' + esc(h.pic) + '" alt="" style="width:32px;height:32px">' : "") + '<span class="uvgrow"><b>' + esc(h.n) + "</b><small> · " + esc(h.y) + (h.by ? " · par " + esc((G.F[h.by] || {}).n || "") : "") + "</small></span></div>").join("") : '<p class="uvempty">La première cérémonie a lieu la veille de ton plus grand show.</p>') +
    '<h3 class="uvh3">In memoriam</h3><div class="uvmem2">' + mem.map(h => '<figure>' + (h.pic ? '<img src="' + esc(h.pic) + '" alt="" loading="lazy">' : '<span class="uvav ini" style="width:64px;height:64px;background:#a3abbd"></span>') + "<figcaption>" + esc(h.n) + "<small>" + esc(h.y) + "</small></figcaption></figure>").join("") + "</div>";
}
ACT.uvhof = el => { toast(hofInduct(U.G, el.dataset.w)); persist(); redraw(); };
export function magBody(G) {
  const Y = Object.keys(G.mag || {}).sort((a, b) => b - a), y = U.f.magY && G.mag[U.f.magY] ? U.f.magY : Y[0];
  if (!y) return '<p class="uvempty">Le ' + MAGN + " sort le 1er janvier : le classement des 100 meilleurs catcheurs de l’année.</p>";
  const L = G.mag[y], W = i => G.W[(L[i] || {}).w] || { n: (L[i] || {}).n, pic: "" };
  return (Y.length > 1 ? chips("magY", Y.map(x => [x, "Année " + x]), y) : "") +
    '<div class="uvmag"><div class="uvmagt"><b>' + MAGN + "</b><small>Les 100 meilleurs · Année " + esc(y) + '</small></div><div class="uvmag1">' + (W(0).pic ? '<img src="' + esc(W(0).pic) + '" alt="">' : "") + '<span class="uvmagn">1</span><b>' + esc(W(0).n || "") + "</b><small>" + esc((G.F[(L[0] || {}).fed] || {}).n || "") + '</small></div><div class="uvmag4">' + [1, 2, 3, 4].map(i => L[i] ? '<div>' + (W(i).pic ? '<img src="' + esc(W(i).pic) + '" alt="">' : "") + '<span class="uvmagn">' + (i + 1) + "</span><b>" + esc(W(i).n) + "</b></div>" : "").join("") + "</div></div>" +
    '<ol class="uvrank" start="6" style="counter-reset:uvr 5">' + L.slice(5).map(x => '<li><span class="uvgrow">' + esc(x.n) + "<small>" + esc((G.F[x.fed] || {}).n || "") + "</small></span></li>").join("") + "</ol>";
}
export function encBody(G) {
  const tab = U.f.enc || "rec", T = Object.values(G.T).filter(t => (t.hist || []).length);
  const reigns = []; T.forEach(t => (t.hist || []).forEach(h => reigns.push({ t: t, w: h.w, d: (h.to != null ? h.to : G.day) - h.from, defs: h.defs || 0, from: h.from })));
  const longest = reigns.filter(r => r.from >= 0).sort((a, b) => b.d - a.d).slice(0, 8), defs = reigns.slice().sort((a, b) => b.defs - a.defs).slice(0, 5);
  const W = Object.values(G.W).filter(w => w.fed && !w.ret), wins = W.slice().sort((a, b) => (b.car[0] + b.rec[0]) - (a.car[0] + a.rec[0])).slice(0, 5);
  let body = chips("enc", [["rec", "Records"], ["tit", "Titres"], ["big", "Grands shows"]], tab);
  if (tab === "rec") body += '<h3 class="uvh3">Plus longs règnes (dans ta partie)</h3>' + longest.map(r => '<div class="uvline"><span class="uvgrow">' + teamH(G, r.w) + "<small> · " + esc(r.t.n) + "</small></span><b>" + r.d + " j</b></div>").join("") +
    '<h3 class="uvh3">Plus de défenses</h3>' + defs.map(r => '<div class="uvline"><span class="uvgrow">' + teamH(G, r.w) + "<small> · " + esc(r.t.n) + "</small></span><b>" + r.defs + "</b></div>").join("") +
    '<h3 class="uvh3">Plus de victoires en carrière</h3>' + wins.map(w => '<div class="uvline"><span class="uvgrow">' + esc(w.n) + "</span><b>" + (w.car[0] + w.rec[0]) + "</b></div>").join("") +
    '<h3 class="uvh3">Meilleurs matchs</h3>' + (G.topM || []).slice(0, 10).map(m => '<div class="uvline"><span class="uvgrow">' + esc(m.txt) + "<small> · " + esc(m.ev || "") + " · " + esc(shortDate(m.d)) + '</small></span><span class="uvstar">' + stars(m.r) + "</span></div>").join("");
  else if (tab === "tit") body += T.map(t => '<details class="uvres"><summary><div class="uvrow"><span class="uvgrow"><b>' + esc(t.n) + "</b><small> · " + esc((G.F[t.fed] || {}).n || "") + "</small></span><b>" + t.hist.length + "</b></div></summary>" + t.hist.slice().reverse().map(h => '<p class="uvsm">' + teamH(G, h.w) + " · depuis le " + esc(h.from < 0 ? "début" : shortDate(h.from)) + (h.to != null ? " jusqu’au " + esc(shortDate(h.to)) : " (en cours)") + " · " + (h.defs || 0) + " défense(s)</p>").join("") + "</details>").join("");
  else body += (G.topS || []).map(s => '<div class="uvline"><span class="uvgrow">' + esc(s.n) + "<small> · " + esc((G.F[s.fed] || {}).n || "") + " · " + esc(shortDate(s.d)) + '</small></span><span class="uvstar">' + stars(s.r) + "</span></div>").join("") || '<p class="uvempty">Pas encore de grand show.</p>';
  return body;
}

// ---------- le bureau du GM ----------
export function bureauView(tab) {
  const G = U.G, f = meF(G); tab = tab || "obj";
  const T = tabs("#/univers/bureau", [["obj", "Objectifs"], ["toi", "Toi"], ["riv", "Rivale"], ["rep", "Réputation"], ["ach", "Trophées"], ["sem", "Semaines"], ["agenda", "Agenda"], ["cfg", "Réglages"]], tab);
  let body = "";
  if (tab === "obj") {
    const o = G.obj || { goals: [], sec: 70 }, shows = G.ev.filter(e => e.fed === G.me && e.done && e.res && e.day >= G.day - 91), tv = shows.filter(e => e.kind === "tv");
    const cur = { aud: tv.length ? tv.reduce((s, e) => s + e.res.aud, 0) / tv.length : 0, money: f.money, rating: shows.length ? shows.reduce((s, e) => s + e.res.r, 0) / shows.length : 0 };
    const d = dateOf(G.day), nextQ = [2, 5, 8, 11].find(m => m >= d.m);
    body = '<div class="uvtile"><div class="uvth">Mode <i>' + (G.mode === "sandbox" ? "Bac à sable" : "Carrière") + " · " + ({ facile: "Facile", normal: "Normal", difficile: "Difficile" }[G.diff] || "Normal") + "</i></div>" + (G.mode === "sandbox" ? '<p class="uvsm">Pas d’objectifs, pas de faillite : amuse-toi.</p>' :
      '<p class="uvsm">Confiance du propriétaire</p><div class="uvbig" style="color:' + (o.sec >= 50 ? "#63d69c" : o.sec >= 25 ? "#ffd27a" : "#ff8a7e") + '">' + Math.round(o.sec) + " / 100</div>" + bar(o.sec, o.sec >= 50 ? "#63d69c" : o.sec >= 25 ? "#ffd27a" : "#ff8a7e") + '<p class="uvsm">À 0, tu es viré. Bilan à la fin de ' + MONTHS[nextQ != null ? nextQ : 11] + ".</p>") + "</div>" +
      (G.mode === "sandbox" ? "" : '<h3 class="uvh3">Ce trimestre</h3>' + o.goals.map(g => { const v = cur[g.k], ok = v >= g.v; return '<div class="uvcard"><div class="uvrow"><span class="uvgrow"><b>' + (g.k === "aud" ? "Audience moyenne des shows TV" : g.k === "money" ? "Argent en banque" : "Note moyenne des shows") + "</b><small>Objectif : " + (g.k === "aud" ? fmtM(g.v) : g.k === "money" ? fmtK(g.v) : g.v + "/100") + '</small></span><span class="uvstat ' + (ok ? "ok" : "ko") + '">' + (g.k === "aud" ? fmtM(v) : g.k === "money" ? fmtK(v) : Math.round(v)) + "</span></div></div>"; }).join(""));
    body += U.misBody ? U.misBody(G) : "";
  } else if (tab === "riv") {
    body = U.rivBody ? U.rivBody(G) : "";
  } else if (tab === "toi" && U.gmBody) { body = U.gmBody(G);
  } else if (tab === "rep") {
    const jobs = G.mail.filter(m => m.k === "job" && !m.done && G.F[m.fed]);
    const dk = dnaMain(G), dn = dnaNext(G);
    body = (G.dna ? '<div class="uvtile uvdna" style="--dc:' + DNA[dk].c + '"><div class="uvth">L’ADN de ta fédération</div><div class="uvbig">' + esc(DNA[dk].n) + "</div><p class=\"uvsm\">" + esc(DNA[dk].ex) + " · " + esc(DNA[dk].d) + "</p>" +
      (dn ? '<p class="uvsm">Les journalistes commencent à te comparer ' + (DNA[dn].g === "m" ? "au" : "à la") + ' <b>' + esc(DNA[dn].n.toLowerCase()) + "</b> (" + esc(DNA[dn].ex) + ").</p>" : '<p class="uvsm">Ton public sait ce qu’il vient voir.</p>') +
      '<p class="uvmut">L’ADN change avec ce que tu programmes. Les catcheurs qui aiment ton style écoutent mieux tes offres.</p></div>' : "") +
      '<div class="uvtile"><div class="uvth">Ta réputation de GM</div><div class="uvbig">' + esc(repWord(G.rep || 50)) + "</div>" + '<p class="uvsm">Bons shows, objectifs tenus, awards et stars dans le ' + MAGN + " la font monter. Les promesses non tenues et les renvois de stars la font baisser. Plus elle est haute, plus les stars veulent signer chez toi, et d’autres fédérations peuvent te proposer leur poste de GM.</p></div>" +
      '<h3 class="uvh3">Offres d’emploi</h3>' + (jobs.length ? jobs.map(m => '<div class="uvcard uvrow">' + crest(G, m.fed, 36) + '<div class="uvgrow"><b>' + esc(G.F[m.fed].n) + "</b><small>" + esc(shortDate(m.d)) + '</small></div><button type="button" class="uvbtn sm pri" data-act="uvjob" data-f="' + esc(m.fed) + '" data-m="' + esc(m.id) + '">Accepter</button></div>').join("") : '<p class="uvempty">Aucune offre pour l’instant.</p>');
  } else if (tab === "ach") {
    body = '<div class="uvachg">' + Object.keys(ACH).map(k => '<div class="uvach' + ((G.ach || {})[k] != null ? " on" : "") + '"><b>' + ((G.ach || {})[k] != null ? "🏆" : "🔒") + "</b><span>" + esc(ACH[k][0]) + "</span><small>" + esc(ACH[k][1]) + "</small></div>").join("") + "</div>";
  } else if (tab === "sem") {
    const L = (G.weeks || []).slice().reverse();
    body = L.length ? L.slice(0, 20).map(w => '<div class="uvcard"><div class="uvrow"><b class="uvgrow">Semaine du ' + esc(shortDate(w.d - 6)) + '</b><span class="uvstat ' + (w.rank === 1 ? "ok" : "mid") + '">' + (w.rank ? w.rank + "e / " + w.of : "—") + "</span></div><p class=\"uvsm\">Audience " + fmtM(w.aud) + " · " + (w.money >= 0 ? "+" : "") + fmtK(w.money) + (w.best ? " · meilleur match : " + esc(w.best.txt) + " (" + stars(w.best.r) + ")" : "") + "</p>" + (w.news || []).map(n => '<p class="uvsm">· ' + esc(n) + "</p>").join("") + "</div>").join("") : '<p class="uvempty">Le premier résumé arrive lundi.</p>';
  } else if (tab === "agenda") {
    const days = []; for (let d = G.day; d < G.day + 21; d++) days.push(d);
    const it = d => { const L = []; G.ev.filter(e => e.fed === G.me && e.day === d && !e.done).forEach(e => L.push(["show", e.n + (isBig(e) ? " (" + e.kind.toUpperCase() + ")" : ""), "#/univers/ev/" + encodeURIComponent(e.id)])); roster(G).filter(w => w.fed === G.me && w.ct && w.ct.end === d).forEach(w => L.push(["ct", "Fin du contrat de " + w.n, "#/univers/nego/" + w.id])); if (G.tourA && d === G.tourA.from) L.push(["tour", "Départ en tournée : " + G.tourA.n, ""]); roster(G).filter(w => w.inj && w.inj.until === d && w.fed === G.me).forEach(w => L.push(["inj", "Retour de " + w.n, ""])); return L; };
    body = '<button type="button" class="uvbtn" data-act="uvgoto">Aller jusqu’au…</button>' + days.map(d => { const L = it(d); return L.length || d === G.day ? '<div class="uvagd' + (d === G.day ? " on" : "") + '"><b>' + esc(dayLabel(d)) + "</b>" + (L.length ? L.map(x => x[2] ? '<a href="' + esc(x[2]) + '" class="uvag ' + x[0] + '">' + esc(x[1]) + "</a>" : '<span class="uvag ' + x[0] + '">' + esc(x[1]) + "</span>").join("") : '<span class="uvmut">Rien de prévu</span>') + "</div>" : ""; }).join("");
  } else {
    const c = G.cfg || {};
    body = '<form class="uvform uvcard" data-form="uvcfg"><label class="uvfld">Vitesse du défilement des jours<select name="speed">' + opt(1, "Normal (1 jour par seconde)", c.speed) + opt(2, "Rapide", c.speed) + opt(3, "Instantané", c.speed) + "</select></label>" +
      '<b>S’arrêter quand…</b><label class="uvspot"><input type="checkbox" name="stopWk"' + (c.stopWk ? " checked" : "") + '><span>Le résumé de la semaine arrive</span></label><label class="uvspot"><input type="checkbox" name="stopInj"' + (c.stopInj ? " checked" : "") + "><span>Un blessé revient</span></label>" +
      '<label class="uvspot"><input type="checkbox" name="mixed"' + (f.mixed ? " checked" : "") + '><span>Autoriser les matchs hommes contre femmes dans ma fédération</span></label>' +
      '<label class="uvspot"><input type="checkbox" name="motn"' + (c.motn ? " checked" : "") + '><span>Prime automatique de 10 k$ au match de la soirée</span></label>' +
      '<label class="uvspot"><input type="checkbox" name="tips"' + (c.tips !== false ? " checked" : "") + '><span>Les conseils du bras droit</span></label>' +
      '<label class="uvspot"><input type="checkbox" name="mus"' + (lsMus() ? " checked" : "") + '><span>Musiques d’entrée pendant le direct (liens YouTube mis sur les fiches)</span></label>' +
      '<b>Toi, le GM</b><div class="uvrow">' + gmFace(G, 44) + '<label class="uvfld uvgrow">Ton nom<input name="gmn" maxlength="30" value="' + esc(gmName(G)) + '"></label></div><button type="button" class="uvbtn sm" data-act="uvgmpic">Changer ta photo</button>' +
      '<b>Ton univers</b><label class="uvchoice"><input type="radio" name="um" value="smart"' + (G.mark ? "" : " checked") + '><span><b>Smart</b><small>Tu choisis les vainqueurs et tu écris les histoires.</small></span></label>' +
      '<label class="uvchoice"><input type="radio" name="um" value="mark"' + (G.mark ? " checked" : "") + '><span><b>Mark</b><small>Le catch est vrai : le résultat se joue sur le ring, tout est raconté comme à la télé.</small></span></label>' +
      '<button class="uvbtn pri">Enregistrer</button></form>' +
      '<button type="button" class="uvbtn ghost" data-act="uvtuto" data-s="0">Revoir le tuto</button>';
  }
  return shell("bureau", "Bureau du GM", T, body);
}
FORM.uvcfg = f => { const G = U.G; G.cfg = Object.assign(G.cfg || {}, { speed: +f.speed.value, stopWk: f.stopWk.checked, stopInj: f.stopInj.checked, motn: f.motn.checked, tips: f.tips.checked }); meF(G).mixed = f.mixed.checked;
  G.gm = G.gm || {}; G.gm.n = (f.gmn.value || "").trim().slice(0, 30) || G.gm.n || "Le GM"; G.mark = f.um.value === "mark"; try { localStorage.setItem("ctv.univ.mus", f.mus.checked ? "1" : "0"); } catch (e) {} try { localStorage.setItem("ctv.univ.um", G.mark ? "mark" : "smart"); } catch (e) {} persist(); toast("Réglages enregistrés"); redraw(); };
ACT.uvjob = el => { const G = U.G, m = G.mail.find(x => x.id === el.dataset.m); modal((box, close) => { box.classList.add("uvmodal"); box.innerHTML = "<h3>Devenir GM de " + esc((G.F[el.dataset.f] || {}).n || "") + " ?</h3><p class=\"uvmut\">Ta fédération actuelle sera gérée par l’IA. Ton staff reste là-bas.</p><button type=\"button\" class=\"uvbtn pri\" data-y=\"1\">Oui, j’y vais</button><button type=\"button\" class=\"uvbtn ghost\" data-n=\"1\">Non</button>"; box.addEventListener("click", e => { if (e.target.closest("[data-n]")) close(); if (e.target.closest("[data-y]")) { toast(switchFed(G, el.dataset.f)); if (m) m.done = "Accepté"; persist(true); close(); go("#/univers/g"); redraw(); } }); }); };

// ---------- l'écran de défilement des jours ----------
let ov = null, run = 0;
function overlay() { if (ov && document.body.contains(ov)) return ov; ov = document.createElement("div"); ov.className = "uvload"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Les jours passent"); document.body.appendChild(ov); return ov; }
function closeOv() { if (ov) { ov.remove(); ov = null; } run = 0; }
function paint(G, info) {
  const t = dateOf(G.day), o = overlay(), N = G.news.filter(n => n.d === G.day).slice(-3), B = G.buzz.filter(b => b.d === G.day).slice(-1);
  const ai = Object.keys(G.aiShows || {}).reduce((s, k) => s.concat((G.aiShows[k] || []).filter(x => x.d === G.day).map(x => [k, x])), []).slice(0, 2);
  o.innerHTML = '<div class="uvlbox"><div class="uvcal"><small>' + esc(WDL[t.wd]) + "</small><b>" + t.dm + "</b><span>" + esc(MONTHS[t.m]) + " · Année " + t.y + '</span></div><div class="uvwk" aria-hidden="true">' + [1, 2, 3, 4, 5, 6, 0].map(d => '<i class="' + (d === t.wd ? "on" : "") + '"></i>').join("") + "</div>" +
    '<div class="uvlnews">' + (N.length ? N.map(n => "<p><b>" + esc(n.t) + "</b>" + (n.txt ? " — " + esc(n.txt) : "") + "</p>").join("") : '<p class="uvmut">' + esc(["Le monde du catch tourne…", "Les fédérations préparent leurs shows…", "Les agents passent des coups de fil…", "Les catcheurs s’entraînent…"][G.day % 4]) + "</p>") +
    ai.map(x => '<p class="uvsm">Pendant ce temps · ' + esc((G.F[x[0]] || {}).n || "") + " : " + esc(x[1].n) + " " + stars(x[1].r) + " · " + fmtM(x[1].aud) + "</p>").join("") + B.map(b => '<p class="uvsm">' + esc(b.who + " : " + b.txt) + "</p>").join("") + "</div>" +
    (info || "") + '<div class="uvrow2 uvlctl"><button type="button" class="uvbtn" data-ov="stop">Arrêter</button>' + [1, 2, 3].map(v => '<button type="button" class="uvbtn sm' + ((G.cfg || {}).speed === v ? " pri" : "") + '" data-ov="sp" data-v="' + v + '">' + ["", "Normal", "Rapide", "Instantané"][v] + "</button>").join("") + "</div></div>";
}
function weekCard(G) {
  const w = (G.weeks || [])[G.weeks.length - 1]; if (!w) return "";
  return '<div class="uvwkc"><b>Résumé de la semaine</b><p>Audience ' + fmtM(w.aud) + (w.rank ? " · " + w.rank + "e sur " + w.of : "") + " · " + (w.money >= 0 ? "+" : "") + fmtK(w.money) + "</p>" + (w.best ? "<p>Meilleur match : " + esc(w.best.txt) + " (" + stars(w.best.r) + ")</p>" : "") + (w.war ? '<p class="uvwarl">Guerre des audiences : ' + (w.war.won ? '<span class="uvok">tu bats ' + esc(w.war.n) + "</span>" : '<span class="uvko">' + esc(w.war.n) + " gagne</span>") + " (" + fmtM(w.war.me) + " contre " + fmtM(w.war.them) + ")</p>" : "") + '<div class="uvrow2"><button type="button" class="uvbtn pri" data-ov="go">Continuer</button><button type="button" class="uvbtn ghost" data-ov="stop">Fermer</button></div></div>';
}
export function startDays(target) {
  const G = U.G; if (!G) return;
  if (G.over) { toast("La partie est finie : regarde le menu général"); return; }
  const today = myEventToday(G); if (today) { showPrompt(today); return; }
  const id = ++run; G._new = 0; G._week = false; let n = 0;
  const done = why => { if (id !== run) return; closeOv(); persist(true); const ev = myEventToday(G); toast(n > 1 ? n + " jours passés" + (ev ? " · ce soir : " + ev.n : G._new ? " · nouveau message" : "") : ev ? "Ce soir : " + ev.n : "Jour suivant"); redraw(); if (ev) setTimeout(() => showPrompt(ev), 250);
    // une nouvelle décision importante : on l'ouvre en carte
    else if (G._new && U.deckCard) { const last = G.mail.slice().reverse().find(m => !m.read && m.imp !== false); if (last && U.deckCard(G, last)) go("#/univers/decide"); } };
  const step = () => {
    if (id !== run) return;
    stepDay(G); n++;
    const stopEv = myEventToday(G), stop = stopEv || G.over || (target != null ? G.day >= target : G._new) || n >= 60;
    if (G._week && !stop && !target) { paint(G, weekCard(G)); G._week = false; overlay().dataset.wait = "1"; return; }
    if (stop) { paint(G); return setTimeout(done, 350); }
    const sp = (G.cfg || {}).speed || 1;
    if (sp === 3) { if (n % 7 === 0) { paint(G); setTimeout(step, 0); } else step(); return; }
    paint(G); setTimeout(step, sp === 2 ? 320 : 900);
  };
  paint(G); overlay().onclick = e => { const b = e.target.closest("[data-ov]"); if (!b) return; const a = b.dataset.ov;
    if (a === "stop") { run++; closeOv(); persist(true); redraw(); }
    if (a === "sp") { G.cfg = Object.assign(G.cfg || {}, { speed: +b.dataset.v }); paint(G); if (overlay().dataset.wait) return; }
    if (a === "go") { delete overlay().dataset.wait; G._week = false; setTimeout(step, 100); } };
  setTimeout(step, 250);
}
ACT.uvnext = () => startDays(null);
// changer d'écran arrête le défilement (la partie est sauvegardée)
if (typeof window !== "undefined") window.addEventListener("hashchange", () => { if (ov) { run++; closeOv(); persist(true); } });
ACT.uvgoto = () => {
  const G = U.G; if (!G) return; const L = []; for (let d = G.day + 1; d <= G.day + 45; d++) L.push(d);
  modal((box, close) => { box.classList.add("uvmodal"); box.innerHTML = "<h3>Aller jusqu’au…</h3><p class=\"uvmut\">Les jours défilent jusqu’à cette date. Ça s’arrête quand même pour jouer un de tes shows.</p><select id=\"uvgd\">" + L.map(d => { const e = G.ev.find(x => x.fed === G.me && x.day === d && !x.done); return '<option value="' + d + '">' + esc(dayLabel(d) + (e ? " · " + e.n : "")) + "</option>"; }).join("") + '</select><button type="button" class="uvbtn pri" data-y="1">C’est parti</button><button type="button" class="uvbtn ghost" data-n="1">Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-n]")) close(); if (e.target.closest("[data-y]")) { const d = +box.querySelector("#uvgd").value; close(); startDays(d); } }); });
};

// ---------- tuto ----------
const TUTO = [["Bienvenue, GM !", "Tu diriges une fédération. Ton but : la meilleure audience de l’année, et un propriétaire content."], ["La barre de gauche", "Accueil, Courrier, Actu, Buzz, Monde, Ma fédé, Créatif, Activité et ton Bureau. ☰ « Cacher » la replie."],
  ["Jour suivant", "Le calendrier défile jusqu’au prochain message important ou au prochain show. Tu peux l’arrêter quand tu veux."], ["La carte du show", "Matchs, segments, titres, tournois, traditions, open challenge… Ou laisse l’IA la faire."],
  ["La Gorilla position", "Vis le show en direct : accélère, rallonge, change le vainqueur, envoie une intervention…"], ["Ton Bureau", "Objectifs du trimestre, réputation, trophées, résumés de la semaine, agenda et réglages."]];
export function tutoCheck() {
  const G = U.G; if (!G || G.tuto >= TUTO.length || document.querySelector(".uvtuto")) return;
  const s = G.tuto || 0, o = document.createElement("div"); o.className = "uvtuto"; o.setAttribute("role", "dialog");
  o.innerHTML = '<div class="uvtbox"><small>' + (s + 1) + " / " + TUTO.length + "</small><h3>" + esc(TUTO[s][0]) + "</h3><p>" + esc(TUTO[s][1]) + '</p><div class="uvrow2"><button type="button" class="uvbtn pri" data-t="n">' + (s === TUTO.length - 1 ? "C’est parti !" : "Suivant") + '</button><button type="button" class="uvbtn ghost" data-t="x">Passer</button></div></div>';
  o.onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; o.remove(); G.tuto = b.dataset.t === "x" ? TUTO.length : s + 1; persist(); if (G.tuto < TUTO.length) setTimeout(tutoCheck, 50); };
  document.body.appendChild(o);
}
ACT.uvtuto = () => { U.G.tuto = 0; persist(); go("#/univers/g"); setTimeout(tutoCheck, 300); };

// ---------- accueil : bras droit, objectifs, la route vers…, fin de partie ----------
export function homeExtra(G) {
  const f = meF(G), m = mania(G), tips = (G.cfg || {}).tips === false ? [] : advise(G).slice(0, 3);
  let h = "";
  if (G.over) h += '<div class="uvover"><b>' + (G.over.k === "bankrupt" ? "Faillite" : "Tu es viré !") + '</b><p>' + (G.over.k === "bankrupt" ? f.n + " a fermé ses portes." : "Le propriétaire a perdu confiance.") + '</p><div class="uvrow2"><a class="uvbtn pri" href="#/univers/bureau/rep">Voir les offres d’emploi</a><button type="button" class="uvbtn" data-act="uvsandbox">Continuer en bac à sable</button><a class="uvbtn ghost" href="#/univers">Nouvelle partie</a></div></div>';
  if (m) h += '<a class="uvroad" href="#/univers/ev/' + encodeURIComponent(m.id) + '"><small>La route vers</small><b>' + esc(m.n) + "</b><span>J-" + (m.day - G.day) + " · hype " + Math.round(G.hype[m.id] || 3) + "/10</span></a>";
  if (tips.length) h += '<div class="uvtile"><div class="uvth">Ton bras droit</div>' + tips.map(t => t[2] ? '<a class="uvline uvtip" href="' + esc(t[2]) + '">' + esc(t[1]) + "</a>" : '<div class="uvline uvtip">' + esc(t[1]) + "</div>").join("") + "</div>";
  if (G.obj && G.mode !== "sandbox") h += '<a class="uvtile" href="#/univers/bureau/obj"><div class="uvth">Confiance du propriétaire <i>' + Math.round(G.obj.sec) + " / 100</i></div>" + bar(G.obj.sec, G.obj.sec >= 50 ? "#63d69c" : G.obj.sec >= 25 ? "#ffd27a" : "#ff8a7e") + "</a>";
  return h;
}
ACT.uvsandbox = () => { const G = U.G; G.mode = "sandbox"; G.over = null; meF(G).money = Math.max(meF(G).money, 2000); persist(); redraw(); };
export { gimOf };
