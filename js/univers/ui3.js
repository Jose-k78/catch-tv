// Mode Univers v2 : écrans des personnes — recherche poussée et comparaison, négociation en direct, rompre un contrat,
// staff (et légendes : staff, apparition, caméo), gimmicks, relations.
import { ACT, FORM } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { ST, STYLES, ROLES, dayLabel, shortDate, fmtK, recTxt, clamp } from "./world.js";
import { DEM, SROLE, GT } from "./data.js";
import { meF, wn, roster, avail, why, mail, relsOf, myStaff, e_, isBig } from "./base.js";
import { demandOf, attract, negStart, negOffer, negScore, announce, release, releaseCost, canContact, contact, hireStaff, fireStaff, hireLegend, appear, appearFee } from "./deal.js";
import { fitOf, gimOf } from "./v2.js";
import { gimIdeas, gimChance, proposeGim } from "./crea.js";
import { U, go, redraw, persist, shell, tabs, chips, face, crest, imgBtn } from "./core.js";

const bar = (v, c) => '<span class="uvbar"><i style="width:' + clamp(v) + "%" + (c ? ";background:" + c : "") + '"></i></span>';
const fedN = (G, k) => k ? ((G.F[k] || {}).n || k) : "Libre";
const IL = w => w && w.sx === "f" ? "Elle" : "Il", LE = w => w && w.sx === "f" ? "la" : "le";
const moodTxt = (w, sc) => sc >= 1 ? [IL(w) + " signerait tout de suite", "ok"] : sc >= -1.5 ? [IL(w) + " hésite : encore un effort", "mid"] : ["Pas d’accord du tout", "ko"];
// sans recruteur, on ne connaît que des stats approximatives des catcheurs des autres
export const statTxt = (G, w, i) => w.fed === G.me || myStaff(G, "scout").some(s => s.q >= 55) ? String(w.st[i]) : "≈" + Math.round(w.st[i] / 10) * 10;
export function signal(G, w) {
  if (w.ret) return ["Légende", "leg"]; if (w.staff) return ["Dans un staff", "off"];
  if (w.nc > G.day) return ["Libre le " + shortDate(w.nc), "off"];
  if (w.fed === G.me) return ["Chez toi", "me"];
  if (w.fed && w.ct && w.ct.end - G.day > 120) return ["Sous contrat", "off"];
  const a = attract(G, w) - Math.max(0, demandOf(G, w) - meF(G).money * 0.3) / 60;
  return a >= 2 ? ["Signerait sûrement", "ok"] : a >= -5 ? ["À convaincre", "mid"] : ["Pas intéressé" + e_(w), "ko"];
}

// ---------- Monde › Catcheurs : recherche poussée ----------
const F0 = () => ({ q: "", sx: "", fed: "", sty: "", al: "", amin: "", amax: "", pmin: "", pmax: "", st: ["", "", "", "", "", "", ""], bud: false, end: "", stat: "tous", sort: "pop", n: 40 });
export function searchBody(G) {
  const F = U.f.s = U.f.s || F0(), f = meF(G), q = F.q.toLowerCase();
  let L = Object.values(G.W).filter(w => !w.staff);
  if (F.stat === "libres") L = L.filter(w => !w.fed && !w.ret); if (F.stat === "contrat") L = L.filter(w => w.fed && w.fed !== G.me); if (F.stat === "fin") L = L.filter(w => w.fed && w.fed !== G.me && w.ct && w.ct.end - G.day <= 120);
  if (F.stat === "leg") L = L.filter(w => w.ret); else if (F.stat !== "tous") L = L.filter(w => !w.ret); if (F.stat === "tous") L = L.filter(w => !w.ret);
  if (F.stat === "blesse") L = L.filter(w => w.inj && w.inj.until > G.day);
  if (F.sx) L = L.filter(w => w.sx === F.sx); if (F.fed) L = L.filter(w => F.fed === "-" ? !w.fed : w.fed === F.fed); if (F.sty) L = L.filter(w => w.sty === F.sty); if (F.al) L = L.filter(w => w.al === F.al);
  if (F.amin) L = L.filter(w => w.age >= +F.amin); if (F.amax) L = L.filter(w => w.age <= +F.amax); if (F.pmin) L = L.filter(w => w.pop >= +F.pmin); if (F.pmax) L = L.filter(w => w.pop <= +F.pmax);
  F.st.forEach((v, i) => { if (v) L = L.filter(w => w.st[i] >= +v); });
  if (F.bud) L = L.filter(w => demandOf(G, w) <= Math.max(100, f.money * 0.3));
  if (q) L = L.filter(w => (w.n + " " + (gimOf(w).n || "")).toLowerCase().indexOf(q) >= 0);
  const S = { pop: w => -w.pop, sal: w => demandOf(G, w), age: w => w.age, end: w => w.ct ? w.ct.end : 99999, avg: w => -(w.nm ? w.sr / w.nm : 0) }; const k = F.sort;
  L.sort((a, b) => (k[0] === "s" && k.length === 2 ? b.st[+k[1]] - a.st[+k[1]] : (S[k] || S.pop)(a) - (S[k] || S.pop)(b)));
  const cmp = U.f.cmp || [];
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>";
  return '<form class="uvsearch" data-form="uvsrch"><input type="search" name="q" value="' + esc(F.q) + '" placeholder="Nom ou surnom" aria-label="Chercher un catcheur">' +
    '<select name="stat" aria-label="Situation">' + [["tous", "Tous les actifs"], ["libres", "Agents libres"], ["contrat", "Sous contrat ailleurs"], ["fin", "Fin de contrat dans 120 j"], ["blesse", "Blessés"], ["leg", "Légendes retraitées"]].map(x => opt(x[0], x[1], F.stat)).join("") + "</select>" +
    '<select name="sx" aria-label="Division">' + [["", "Hommes et femmes"], ["h", "Hommes"], ["f", "Femmes"]].map(x => opt(x[0], x[1], F.sx)).join("") + "</select>" +
    '<select name="fed" aria-label="Fédération">' + opt("", "Toutes les fédérations", F.fed) + opt("-", "Sans fédération", F.fed) + Object.values(G.F).map(o => opt(o.id, o.n, F.fed)).join("") + "</select>" +
    '<select name="sort" aria-label="Trier par">' + [["pop", "Tri : popularité"], ["sal", "Tri : salaire demandé"], ["age", "Tri : âge"], ["end", "Tri : fin de contrat"], ["avg", "Tri : note moyenne des matchs"]].concat(ST.map((n, i) => ["s" + i, "Tri : " + n])).map(x => opt(x[0], x[1], F.sort)).join("") + "</select>" +
    '<details class="uvdet uvmore"' + (F.sty || F.al || F.amin || F.amax || F.pmin || F.pmax || F.bud || F.st.some(Boolean) ? " open" : "") + '><summary>Plus de filtres</summary><div class="uvfgrid">' +
    '<label class="uvmini">Style<select name="sty">' + opt("", "Tous", F.sty) + Object.keys(STYLES).map(s => opt(s, STYLES[s][0], F.sty)).join("") + "</select></label>" +
    '<label class="uvmini">Camp<select name="al">' + [["", "Face et heel"], ["face", "Face"], ["heel", "Heel"]].map(x => opt(x[0], x[1], F.al)).join("") + "</select></label>" +
    '<label class="uvmini">Âge min.<input type="number" name="amin" min="16" max="70" value="' + esc(F.amin) + '"></label><label class="uvmini">Âge max.<input type="number" name="amax" min="16" max="70" value="' + esc(F.amax) + '"></label>' +
    '<label class="uvmini">Popularité min.<input type="number" name="pmin" min="0" max="100" step="5" value="' + esc(F.pmin) + '"></label><label class="uvmini">Popularité max.<input type="number" name="pmax" min="0" max="100" step="5" value="' + esc(F.pmax) + '"></label>' +
    ST.map((n, i) => '<label class="uvmini">' + n + " min.<input type=\"number\" name=\"st" + i + '" min="0" max="100" step="5" value="' + esc(F.st[i]) + '"></label>').join("") +
    '<label class="uvspot"><input type="checkbox" name="bud"' + (F.bud ? " checked" : "") + "><span>Dans mon budget</span></label></div></details>" +
    '<div class="uvrow2"><button class="uvbtn pri">Chercher</button><button type="button" class="uvbtn ghost" data-act="uvsreset">Effacer les filtres</button></div></form>' +
    (cmp.length ? '<div class="uvcmpbar" role="status"><span>' + cmp.map(i => esc(wn(G, i))).join(" · ") + '</span><button type="button" class="uvbtn sm pri" data-act="uvcmp"' + (cmp.length < 2 ? " disabled" : "") + '>Comparer</button><button type="button" class="uvbtn sm ghost" data-act="uvcmpclr">Vider</button></div>' : "") +
    '<p class="uvmut">' + L.length + " résultat" + (L.length > 1 ? "s" : "") + " · touche un nom pour sa fiche, ☐ pour comparer</p>" +
    L.slice(0, F.n).map(w => { const sg = signal(G, w), g = gimOf(w); return '<div class="uvw"><a class="uvwl" href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 40) + '<span class="uvgrow"><b>' + esc(w.n) + "</b>" + (g.n ? "<small class=\"uvgimn\">« " + esc(g.n) + " »</small>" : "") + "<small>" + esc(fedN(G, w.fed)) + " · " + w.age + " ans · " + STYLES[w.sty][0] + " · " + (w.al === "heel" ? "Heel" : "Face") + " · " + recTxt(w.rec) + "</small><small><span class=\"uvsig " + sg[1] + '">' + esc(sg[0]) + "</span>" + (w.fed === G.me || w.ret ? "" : " · demande " + fmtK(demandOf(G, w)) + "/an") + "</small></span>" +
      '<span class="uvnote">' + Math.round(w.pop) + '<small>POP</small></span></a><label class="uvck" aria-label="Comparer ' + esc(w.n) + '"><input type="checkbox" data-act="uvcmpt" data-w="' + esc(w.id) + '"' + (cmp.indexOf(w.id) >= 0 ? " checked" : "") + "></label></div>"; }).join("") +
    (L.length > F.n ? '<button type="button" class="uvbtn ghost" data-act="uvsmore">Voir plus</button>' : "");
}
FORM.uvsrch = f => {
  const F = U.f.s = U.f.s || F0(), v = n => (f.elements.namedItem(n) || {}).value || "";
  ["q", "stat", "sx", "fed", "sort", "sty", "al", "amin", "amax", "pmin", "pmax"].forEach(k => { F[k] = v(k).trim(); });
  F.st = ST.map((x, i) => v("st" + i)); F.bud = !!(f.elements.namedItem("bud") || {}).checked; F.n = 40; redraw();
};
ACT.uvsreset = () => { U.f.s = F0(); redraw(); };
ACT.uvsmore = () => { U.f.s.n += 60; redraw(); };
ACT.uvcmpt = el => { const c = U.f.cmp = U.f.cmp || [], i = c.indexOf(el.dataset.w); if (i >= 0) c.splice(i, 1); else { c.push(el.dataset.w); if (c.length > 2) c.shift(); } redraw(); };
ACT.uvcmpclr = () => { U.f.cmp = []; redraw(); };
ACT.uvcmp = () => {
  const G = U.G, W = (U.f.cmp || []).map(i => G.W[i]).filter(Boolean); if (W.length < 2) return;
  modal((box, close) => {
    box.classList.add("uvmodal", "uvwide");
    const row = (l, a, b, hi) => '<tr><th scope="row">' + l + "</th><td" + (hi === 0 ? ' class="hi"' : "") + ">" + a + "</td><td" + (hi === 1 ? ' class="hi"' : "") + ">" + b + "</td></tr>";
    const best = (x, y) => x > y ? 0 : y > x ? 1 : -1;
    box.innerHTML = "<h3>Comparer</h3><table class=\"uvcmp\"><thead><tr><th></th>" + W.map(w => "<th>" + face(G, w, 44) + "<b>" + esc(w.n) + "</b></th>").join("") + "</tr></thead><tbody>" +
      row("Fédération", esc(fedN(G, W[0].fed)), esc(fedN(G, W[1].fed))) + row("Âge", W[0].age, W[1].age) + row("Popularité", Math.round(W[0].pop), Math.round(W[1].pop), best(W[0].pop, W[1].pop)) +
      ST.map((n, i) => row(n, statTxt(G, W[0], i), statTxt(G, W[1], i), best(W[0].st[i], W[1].st[i]))).join("") +
      row("Style", STYLES[W[0].sty][0], STYLES[W[1].sty][0]) + row("Bilan", recTxt(W[0].rec), recTxt(W[1].rec)) + row("Salaire demandé", fmtK(demandOf(G, W[0])), fmtK(demandOf(G, W[1])), best(-demandOf(G, W[0]), -demandOf(G, W[1]))) +
      "</tbody></table><button type=\"button\" class=\"uvbtn ghost\" data-x=\"1\">Fermer</button>";
    box.addEventListener("click", e => { if (e.target.closest("[data-x]")) close(); });
  });
};

// ---------- négociation en direct ----------
const NO = () => ({});
export function negoView(id) {
  const G = U.G, w = G.W[id]; if (!w) return shell("monde", "Négociation", "", '<p class="uvempty">Introuvable.</p>');
  const back = '<a class="uvback" href="#/univers/c/' + esc(id) + '">‹ Fiche de ' + esc(w.n) + "</a>";
  if (w.ret) return shell("monde", "Négociation", "", back + '<p class="uvempty">' + esc(w.n) + " est retraité" + e_(w) + " : engage-l" + (w.sx === "f" ? "a" : "e") + " comme staff, pour une apparition ou un caméo (sa fiche).</p>");
  if (w.fed && w.fed !== G.me && !(w.ct && w.ct.end <= G.day)) { const c = canContact(G, w); return shell("monde", "Négociation", "", back + '<div class="uvtile"><p>' + esc(w.n) + " est sous contrat avec <b>" + esc(fedN(G, w.fed)) + "</b> jusqu’au " + esc(dayLabel(w.ct.end, true)) + '.</p><p class="uvsm">Impossible de l' + (w.sx === "f" ? "a" : "e") + ' voler. Tu peux seulement prendre contact (2 fois par mois, si son contrat finit dans moins de 120 jours) pour qu’' + IL(w).toLowerCase() + ' ne prolonge pas.</p>' + (G.cont && G.cont[w.id] ? '<p class="uvok">Contact pris : intérêt ' + G.cont[w.id].int + " %</p>" : '<button type="button" class="uvbtn' + (c ? "" : " pri") + '" data-act="uvcontact" data-w="' + esc(w.id) + '"' + (c ? " disabled" : "") + ">Prendre contact</button>" + (c ? '<p class="uvmut">' + esc(c) + "</p>" : "")) + "</div>"); }
  if (w.nc > G.day) return shell("monde", "Négociation", "", back + '<p class="uvempty">' + esc(w.n) + " ne peut pas signer avant le " + esc(dayLabel(w.nc)) + " (clause de non-concurrence de 90 jours).</p>");
  const N = negStart(G, id); persist();
  if (N.left > G.day) return shell("monde", "Négociation", "", back + '<p class="uvempty">L’agent ne veut plus discuter avant le ' + esc(dayLabel(N.left)) + ".</p>");
  const O = U.f.nego[id] = U.f.nego[id] || { sal: w.fed === G.me && w.ct ? Math.max(w.ct.sal, N.base) : N.base, dur: 2, role: (w.ct && w.ct.role) || (w.pop > 75 ? "me" : w.pop > 55 ? "up" : "mid"), exc: true, acc: {}, bonus: 0 };
  const sc = negScore(G, id, O), md = moodTxt(w, sc);
  const body = back + '<div class="uvfhead">' + face(G, w, 64) + '<div class="uvgrow"><h2>' + esc(w.n) + "</h2><small>" + esc(fedN(G, w.fed)) + " · popularité " + Math.round(w.pop) + " · " + (w.pers || []).join(", ") + "</small><small>Il demande environ <b>" + fmtK(N.base) + "</b> par an</small></div></div>" +
    '<div class="uvst2 wide"><span>Patience de l’agent</span>' + bar(N.pat, N.pat > 50 ? "#63d69c" : N.pat > 25 ? "#ffd27a" : "#ff8a7e") + "<b>" + N.pat + "</b></div>" +
    (N.riv.length ? '<div class="uvtile"><div class="uvth">Les autres offres <i>jusqu’au ' + esc(shortDate(N.until)) + "</i></div>" + N.riv.map(r => '<div class="uvline">' + crest(G, r.fed, 26) + '<span class="uvgrow">' + esc((G.F[r.fed] || {}).n || "") + "</span><b>" + fmtK(r.sal) + "/an</b></div>").join("") + "</div>" : "") +
    '<div class="uvchat" aria-live="polite">' + N.log.slice(-10).map(m => '<div class="uvbub ' + (m[0] === "me" ? "me" : m[0] === "riv" ? "riv" : "him") + '">' + esc(m[1]) + "</div>").join("") + "</div>" +
    (N.done ? '<p class="uvdone" role="status">' + (w.fed === G.me && w.ct && w.ct.end > G.day + 300 ? "Contrat signé." : "Négociation terminée.") + "</p>" :
    '<form class="uvform uvcard" id="uvneg2" data-w="' + esc(id) + '" onsubmit="return false">' +
    (N.dem.length ? '<h3 class="uvh3">Ses revendications</h3>' + N.dem.map(d => '<label class="uvchoice"><input type="checkbox" name="d_' + d.k + '"' + (O.acc[d.k] ? " checked" : "") + '><span><b>' + esc(DEM[d.k]) + (d.w ? " : " + esc(wn(G, d.w)) : "") + "</b><small>Accepter = c’est écrit dans son contrat (et suivi dans Promesses).</small></span></label>").join("") : "") +
    '<label class="uvfld">Salaire par an : <output>' + fmtK(O.sal) + '</output><input type="range" name="sal" min="' + Math.max(20, Math.round(N.base * 0.4 / 10) * 10) + '" max="' + Math.round(N.base * 2.4 / 10) * 10 + '" step="10" value="' + O.sal + '"></label>' +
    '<label class="uvfld">Durée : <output>' + O.dur + " an" + (O.dur > 1 ? "s" : "") + '</output><input type="range" name="dur" min="1" max="5" step="1" value="' + O.dur + '"></label>' +
    '<label class="uvfld">Rôle promis<select name="role">' + Object.keys(ROLES).map(r => '<option value="' + r + '"' + (r === O.role ? " selected" : "") + ">" + ROLES[r] + "</option>").join("") + "</select></label>" +
    '<label class="uvfld">Contrat<select name="exc"><option value="1"' + (O.exc ? " selected" : "") + '>Exclusif (il ne catche que chez toi)</option><option value="0"' + (!O.exc ? " selected" : "") + ">Non exclusif (moins cher, parfois sur le circuit indé)</option></select></label>" +
    '<label class="uvfld">Prime de signature : <output>' + fmtK(O.bonus) + '</output><input type="range" name="bonus" min="0" max="' + Math.round(N.base * 1.5 / 10) * 10 + '" step="10" value="' + O.bonus + '"></label>' +
    '<div class="uvmood ' + md[1] + '" role="status">' + esc(md[0]) + '</div><button type="button" class="uvbtn pri" data-act="uvnegoff" data-w="' + esc(id) + '">Faire l’offre</button></form>');
  return shell(w.fed === G.me ? "fede" : "monde", "Négociation", "", body);
}
const readNeg = f => { const O = U.f.nego[f.dataset.w] || {}, v = n => (f.elements.namedItem(n) || {}).value; O.sal = +v("sal"); O.dur = +v("dur"); O.role = v("role"); O.exc = v("exc") !== "0"; O.bonus = +v("bonus") || 0; O.acc = {}; Array.from(f.querySelectorAll('input[type=checkbox][name^="d_"]')).forEach(c => { O.acc[c.name.slice(2)] = c.checked; }); U.f.nego[f.dataset.w] = O; return O; };
// en bougeant les curseurs : l'humeur change en direct (sans redessiner l'écran, pour ne pas lâcher le curseur)
if (typeof document !== "undefined") document.addEventListener("input", e => {
  const f = e.target.closest && e.target.closest("#uvneg2"); if (!f || !U.G || e.target.type !== "range") return;
  const O = readNeg(f), sc = negScore(U.G, f.dataset.w, O), md = moodTxt(U.G.W[f.dataset.w], sc);
  const out = e.target.parentNode.querySelector("output"); if (out) out.textContent = e.target.name === "dur" ? O.dur + " an" + (O.dur > 1 ? "s" : "") : fmtK(+e.target.value);
  const m = f.querySelector(".uvmood"); if (m) { m.textContent = md[0]; m.className = "uvmood " + md[1]; }
});
if (typeof document !== "undefined") document.addEventListener("change", e => { const f = e.target.closest && e.target.closest("#uvneg2"); if (!f || !U.G || e.target.type === "range") return; readNeg(f); redraw(); });
ACT.uvnegoff = el => {
  const G = U.G, id = el.dataset.w, f = document.getElementById("uvneg2"); if (f) readNeg(f);
  const r = negOffer(G, id, U.f.nego[id]); persist(); toast(r.txt);
  if (r.ok) { delete U.f.nego[id]; const w = G.W[id]; if (w.newSign === G.day) announceModal(id); }
  redraw();
};
function announceModal(id) {
  const G = U.G, w = G.W[id], evs = G.ev.filter(e => e.fed === G.me && !e.done && e.day >= G.day).sort((a, b) => a.day - b.day).slice(0, 12), nb = evs.find(isBig);
  modal((box, close) => {
    box.classList.add("uvmodal");
    box.innerHTML = "<h3>" + esc(w.n) + " a signé !</h3><p class=\"uvmut\">On l’annonce tout de suite, ou on garde la surprise pour ses débuts ? Une vraie surprise fait exploser le public (mais attention aux fuites).</p>" +
      '<label class="uvfld">Ses débuts<select id="uvdeb">' + evs.map(e => '<option value="' + esc(e.id) + '"' + (nb && e.id === nb.id ? " selected" : "") + ">" + esc(e.n + " · " + dayLabel(e.day)) + "</option>").join("") + "</select></label>" +
      '<button type="button" class="uvbtn pri" data-s="1">Garder la surprise</button><button type="button" class="uvbtn" data-s="0">L’annoncer maintenant</button>';
    box.addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (!b) return; announce(G, id, b.dataset.s === "1", box.querySelector("#uvdeb").value); persist(); close(); toast(b.dataset.s === "1" ? "Secret gardé : mets-le dans un segment « Débuts / retour surprise » de ce show." : "C’est annoncé !"); redraw(); });
  });
}
ACT.uvcontact = el => { const r = contact(U.G, el.dataset.w); persist(); toast(r); redraw(); };

// ---------- rompre un contrat ----------
ACT.uvrel = el => {
  const G = U.G, w = G.W[el.dataset.w]; if (!w || w.fed !== G.me) return;
  const cost = releaseCost(G, w), amiable = w.mor < 50 || w.ask;
  modal((box, close) => {
    box.classList.add("uvmodal");
    box.innerHTML = "<h3>Le contrat de " + esc(w.n) + "</h3>" +
      '<button type="button" class="uvbtn del" data-k="lib">' + (w.sx === "f" ? "La" : "Le") + ' libérer (payer le reste : ' + fmtK(cost) + ')</button><p class="uvsm">' + IL(w) + ' ne pourra pas signer ailleurs pendant 90 jours. Virer quelqu’un de populaire fâche le vestiaire.</p>' +
      '<button type="button" class="uvbtn" data-k="amiable"' + (amiable ? "" : " disabled") + ">Rupture à l’amiable (" + fmtK(Math.round(cost * 0.3)) + ")</button><p class=\"uvsm\">" + (amiable ? IL(w) + " est d’accord pour partir." : "Seulement si " + IL(w).toLowerCase() + " veut partir (moral bas ou demande de départ).") + "</p>" +
      '<div class="uvrow2"><button type="button" class="uvbtn" data-k="susp" data-n="1">Suspendre 1 semaine</button><button type="button" class="uvbtn" data-k="susp" data-n="4">Suspendre 4 semaines</button></div><p class="uvsm">Sans salaire, moral en baisse.</p>' +
      '<button type="button" class="uvbtn" data-k="bench">' + (w.bench ? (w.sx === "f" ? "La" : "Le") + " sortir du placard" : (w.sx === "f" ? "La" : "Le") + " mettre au placard") + '</button><p class="uvsm">' + IL(w) + ' est payé' + e_(w) + ' mais n’est plus mis' + e_(w) + ' sur les cartes.</p><button type="button" class="uvbtn ghost" data-x="1">Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-x]")) close(); const b = e.target.closest("[data-k]"); if (!b || b.disabled) return; const r = release(G, w.id, b.dataset.k, +b.dataset.n || 0); persist(); close(); if (r) toast(r); if (b.dataset.k === "lib" || b.dataset.k === "amiable") go("#/univers/fede/e"); redraw(); });
  });
};

// ---------- Ma fédé › Staff ----------
export function staffBody(G) {
  const f = meF(G), mine = myStaff(G), R = roster(G).filter(w => w.fed === G.me), role = U.f.srole || "comm";
  const S = s => '<div class="uvcard"><div class="uvrow">' + (s.pic ? '<img class="uvav" src="' + esc(s.pic) + '" alt="" style="width:40px;height:40px">' : '<span class="uvav ini" style="width:40px;height:40px;background:#6fb3ff">' + esc(s.n.split(" ").map(x => x[0]).join("").slice(0, 2)) + "</span>") + '<div class="uvgrow"><b>' + esc(s.n) + (s.real ? ' <span class="uvtag" style="background:#ffd27a">Vrai</span>' : "") + "</b><small>" + esc(SROLE[s.role][0]) + " · " + fmtK(s.sal) + " par an</small></div><span class=\"uvnote\">" + s.q + "<small>QUALITÉ</small></span></div>" + bar(s.q, "#6fb3ff") +
    (s.fed === G.me ? (s.role === "mgr" ? '<label class="uvmini">Manager de<select data-act="uvmgr" data-s="' + esc(s.id) + '"><option value="">Personne</option>' + R.map(w => '<option value="' + esc(w.id) + '"' + (s.w === w.id ? " selected" : "") + ">" + esc(w.n) + "</option>").join("") + "</select></label>" : "") + '<button type="button" class="uvbtn sm ghost" data-act="uvsfire" data-s="' + esc(s.id) + '">Se séparer</button>' : '<button type="button" class="uvbtn sm pri" data-act="uvshire" data-s="' + esc(s.id) + '">Engager</button>') + "</div>";
  const market = Object.values(G.staff).filter(s => !s.fed && s.role === role).sort((a, b) => b.q - a.q);
  const legs = Object.values(G.W).filter(w => w.ret && w.leg && !w.staff).sort((a, b) => b.pop - a.pop).slice(0, 12);
  return '<h3 class="uvh3">Mon staff (' + mine.length + ")</h3>" + Object.keys(SROLE).map(r => { const L = mine.filter(s => s.role === r); return L.length ? '<div class="uvsrole"><b>' + esc(SROLE[r][0]) + "</b><small>" + esc(SROLE[r][1]) + "</small></div>" + L.map(S).join("") : ""; }).join("") +
    '<h3 class="uvh3">Recruter</h3>' + chips("srole", Object.keys(SROLE).map(r => [r, SROLE[r][0]]), role) + '<p class="uvsm">' + esc(SROLE[role][1]) + "</p>" + (market.length ? market.map(S).join("") : '<p class="uvempty">Personne de libre pour ce rôle.</p>') +
    '<h3 class="uvh3">Des légendes retraitées</h3><p class="uvsm">Une légende peut rejoindre ton staff, ou venir pour une apparition (un match) ou un caméo (un segment) : ouvre sa fiche.</p>' +
    legs.map(w => '<a class="uvw" href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 36) + '<span class="uvgrow"><b>' + esc(w.n) + "</b><small>Légende · popularité " + Math.round(w.pop) + "</small></span></a>").join("");
}
ACT.uvshire = el => { toast(hireStaff(U.G, el.dataset.s)); persist(); redraw(); };
ACT.uvsfire = el => { toast(fireStaff(U.G, el.dataset.s)); persist(); redraw(); };
if (typeof document !== "undefined") document.addEventListener("change", e => { const s = e.target.closest && e.target.closest('select[data-act="uvmgr"]'); if (!s || !U.G) return; const st = U.G.staff[s.dataset.s]; if (st) { st.w = s.value; persist(); toast(s.value ? st.n + " devient le manager de " + wn(U.G, s.value) : "Plus de catcheur pour " + st.n); } });
// légendes : staff, apparition, caméo
export function legendBox(G, w) {
  const evs = G.ev.filter(e => e.fed === G.me && !e.done && e.day >= G.day).sort((a, b) => a.day - b.day).slice(0, 10);
  if (w.staff) return '<div class="uvtile"><p>' + esc(w.n) + " fait partie d’un staff (" + esc(((G.staff[w.staff] || {}).fed === G.me ? "le tien" : "une autre fédération")) + ").</p></div>";
  return '<div class="uvtile uvleg"><div class="uvth">Légende retraitée</div><p class="uvsm">Engage-l' + (w.sx === "f" ? "a" : "e") + " dans ton staff, ou fais-l" + (w.sx === "f" ? "a" : "e") + " venir à un show.</p>" +
    '<form class="uvinl" data-form="uvlegstaff" data-w="' + esc(w.id) + '"><select name="r" aria-label="Rôle">' + ["coach", "comm", "mgr", "prod", "gm", "writer", "scout"].map(r => '<option value="' + r + '">' + esc(SROLE[r][0]) + "</option>").join("") + '</select><button class="uvbtn">Engager dans le staff</button></form>' +
    (evs.length ? '<form class="uvinl" data-form="uvlegapp" data-w="' + esc(w.id) + '"><select name="ev" aria-label="Show">' + evs.map(e => '<option value="' + esc(e.id) + '">' + esc(e.n + " · " + shortDate(e.day)) + "</option>").join("") + '</select><select name="k" aria-label="Type"><option value="match">Apparition dans un match (' + fmtK(appearFee(G, w, "match")) + ')</option><option value="cameo">Caméo dans un segment (' + fmtK(appearFee(G, w, "cameo")) + ')</option></select><button class="uvbtn pri">Le faire venir</button></form>' : "") + "</div>";
}
FORM.uvlegstaff = f => { toast(hireLegend(U.G, f.dataset.w, f.r.value)); persist(); redraw(); };
FORM.uvlegapp = f => { toast(appear(U.G, f.dataset.w, f.ev.value, f.k.value)); persist(); redraw(); };

// ---------- Créatif › Gimmicks ----------
export function gimBody(G) {
  const R = roster(G).filter(w => w.fed === G.me).sort((a, b) => b.pop - a.pop);
  return '<p class="uvsm">Chaque catcheur a un personnage. Il marche mieux s’il colle à ses stats, et il s’use avec le temps. Tu peux lui en proposer un autre : il peut refuser.</p>' +
    R.map(w => { const g = gimOf(w), fit = fitOf(w, g.t); return '<div class="uvcard"><div class="uvrow">' + face(G, w, 40) + '<div class="uvgrow"><b>' + esc(w.n) + "</b><small>" + esc(GT[g.t][0]) + (g.n ? " · « " + esc(g.n) + " »" : " · sans surnom") + '</small></div><button type="button" class="uvbtn sm" data-act="uvgim" data-w="' + esc(w.id) + '">Changer</button></div>' +
      '<div class="uvst2"><span>Colle</span>' + bar(fit, fit >= 65 ? "#63d69c" : fit >= 45 ? "#ffd27a" : "#ff8a7e") + "<b>" + fit + '</b></div><div class="uvst2"><span>Fraîcheur</span>' + bar(g.fresh || 100, "#6fb3ff") + "<b>" + Math.round(g.fresh || 100) + "</b></div></div>"; }).join("");
}
ACT.uvgim = el => {
  const G = U.G, w = G.W[el.dataset.w]; if (!w) return;
  const g = gimOf(w); let t = g.t, ideas = gimIdeas("", t);
  modal((box, close) => {
    box.classList.add("uvmodal");
    const draw = () => {
      box.innerHTML = "<h3>Nouveau personnage pour " + esc(w.n) + "</h3>" +
        '<label class="uvfld">Une idée en quelques mots<input id="uvgt" maxlength="40" placeholder="Ex. : viking, docteur, ninja…"></label><button type="button" class="uvbtn sm" data-a="ideas">Des idées de noms</button>' +
        '<div class="uvchips">' + ideas.map((x, i) => '<button type="button" class="uvchip" data-i="' + i + '">' + esc(x[0]) + "</button>").join("") + "</div>" +
        '<label class="uvfld">Type<select id="uvgty">' + Object.keys(GT).map(k => '<option value="' + k + '"' + (k === t ? " selected" : "") + ">" + esc(GT[k][0]) + " (colle à " + fitOf(w, k) + " %)</option>").join("") + "</select></label>" +
        '<label class="uvfld">Surnom<input id="uvgn" maxlength="40" value="' + esc(g.n || "") + '"></label>' +
        '<label class="uvfld">Nouveau nom de ring (repackaging, facultatif)<input id="uvgr" maxlength="40" placeholder="' + esc(w.n) + '"></label>' +
        '<p class="uvsm">Chances qu’il accepte : ' + Math.round(gimChance(G, w, t) * 100) + " %. Un personnage qui ne lui va pas peut faire un flop.</p>" +
        '<button type="button" class="uvbtn pri" data-a="go">Lui proposer</button><button type="button" class="uvbtn ghost" data-a="x">Annuler</button>';
    };
    draw();
    box.addEventListener("change", e => { if (e.target.id === "uvgty") { t = e.target.value; const n = box.querySelector("#uvgn").value; draw(); box.querySelector("#uvgn").value = n; box.querySelector("#uvgty").value = t; } });
    box.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.i != null) { const x = ideas[+b.dataset.i]; box.querySelector("#uvgn").value = x[0]; t = x[1]; box.querySelector("#uvgty").value = t; }
      if (b.dataset.a === "ideas") { ideas = gimIdeas(box.querySelector("#uvgt").value, t); const n = box.querySelector("#uvgn").value; draw(); box.querySelector("#uvgn").value = n; }
      if (b.dataset.a === "x") close();
      if (b.dataset.a === "go") { const r = proposeGim(G, w.id, { t: box.querySelector("#uvgty").value, n: box.querySelector("#uvgn").value, rn: box.querySelector("#uvgr").value }); persist(); close(); toast(r.txt); redraw(); }
    });
  });
};

// ---------- relations (fiche) ----------
export function relBody(G, w) {
  const L = relsOf(G, w.id).filter(r => G.W[r.id]), fr = L.filter(r => r.v > 0).slice(0, 8), en = L.filter(r => r.v < 0).reverse().slice(0, 8);
  const row = r => '<a class="uvw" href="#/univers/c/' + esc(r.id) + '/r">' + face(G, G.W[r.id], 32) + '<span class="uvgrow"><b>' + esc(wn(G, r.id)) + '</b><span class="uvrelb ' + (r.v > 0 ? "f" : "e") + '"><i style="width:' + Math.abs(r.v) + '%"></i></span></span><b class="' + (r.v > 0 ? "uvok" : "uvko") + '">' + (r.v > 0 ? "+" : "") + Math.round(r.v) + "</b></a>";
  return '<p class="uvsm">Faire équipe, être dans le même clan ou avoir un mentor rapproche. Les feuds, les botchs et les bagarres éloignent. À +90, une tag team se crée toute seule.</p><h3 class="uvh3">Amis</h3>' + (fr.length ? fr.map(row).join("") : '<p class="uvempty">Pas encore d’ami proche.</p>') + '<h3 class="uvh3">Rivaux</h3>' + (en.length ? en.map(row).join("") : '<p class="uvempty">Pas de rival.</p>');
}
export { why };
