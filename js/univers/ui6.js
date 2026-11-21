// Mode Univers v3 (21 nov., « plus immersif ») : les décisions en cartes (le patron ou un catcheur te parle, on glisse à gauche ou à droite,
// jauges patron / vestiaire / public / argent), les missions du propriétaire, la fédération rivale et la fenêtre des trophées.
import { ACT } from "../state.js";
import { esc, modal } from "../util.js";
import { U, go, redraw, persist, shell, face, crest, imgW, imgFed, wnH } from "./core.js";
import { meF, roster } from "./base.js";
import { fmtK, fmtM, dayLabel, shortDate, clamp } from "./world.js";
import { ACH } from "./data.js";
import { MACTS } from "./ui.js";
import { rival, misProg, misTxt } from "./goals.js";

// ---------- quelles lettres deviennent des cartes ----------
const NODEC = { show: 1, team: 1, agent: 1, fa: 1, scout: 1, tvoffers: 1, hof: 1, job: 1, fired: 1, bankrupt: 1, mag: 1, tourwin: 1, retrole: 1, aud: 1, war: 1, info: 1 };
export function decOf(G, m) {
  if (!m || m.done || NODEC[m.k] || !MACTS[m.k]) return null;
  const A = MACTS[m.k](m); return A.filter(a => a[1] !== "go").length >= 2 ? A : null;
}
export const decisions = G => (G.mail || []).filter(m => m.d >= G.day - 30 && decOf(G, m));

// ---------- les 4 jauges ----------
export function gauges(G) {
  const f = meF(G), R = roster(G).filter(w => w.fed === G.me);
  return { pat: G.obj && G.mode !== "sandbox" ? G.obj.sec : null, ves: R.length ? R.reduce((s, w) => s + w.mor, 0) / R.length : 50, pub: f.pop, arg: f.money };
}
const IC = {
  pat: "M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M4 21c0-4 3.6-7 8-7s8 3 8 7M10 14l2 3 2-3",
  ves: "M7 8a3 3 0 1 0 6 0a3 3 0 1 0-6 0M15 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6M14 15c3.5-.5 7 1 7 5",
  pub: "M3 10v4h3l7 4V6l-7 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12",
  arg: "M12 3v18M17 7c-1-1.5-3-2-5-2-2.8 0-4.5 1.4-4.5 3.4C7.5 13 17 11 17 15.6 17 17.7 15 19 12 19c-2.3 0-4.3-.7-5.5-2.4"
};
const svgI = d => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"></path></svg>';
const argBar = v => clamp(50 + 12 * Math.log2(Math.max(1, v) / 1000));
export function gaugesHTML(G, d) {
  const g = gauges(G);
  const one = (k, l, v, pct, txt) => { const dv = d ? d[k] : 0, sh = k === "arg" ? Math.round(dv) : Math.round(dv * 10) / 10;
    return '<div class="uvgg ' + k + (pct < 25 ? " low" : "") + '">' + svgI(IC[k]) + '<span class="uvggb"><i style="height:' + clamp(pct) + '%"></i></span><b>' + txt + "</b><small>" + l + "</small>" +
      (d && Math.abs(dv) >= (k === "arg" ? 1 : 0.5) ? '<em class="' + (dv > 0 ? "up" : "dn") + '">' + (dv > 0 ? "+" : "−") + (k === "arg" ? fmtK(Math.abs(sh)) : Math.abs(Math.round(dv))) + "</em>" : "") + "</div>"; };
  return '<div class="uvgauges" role="group" aria-label="Tes jauges">' +
    (g.pat != null ? one("pat", "Patron", g.pat, g.pat, Math.round(g.pat)) : one("pat", "Patron", 100, 100, "—")) +
    one("ves", "Vestiaire", g.ves, g.ves, Math.round(g.ves)) + one("pub", "Public", g.pub, g.pub, Math.round(g.pub)) + one("arg", "Argent", g.arg, argBar(g.arg), fmtK(g.arg)) + "</div>";
}

// ---------- une carte ----------
function picOf(G, m) {
  const w = m.w && G.W[m.w], o = m.fed && G.F[m.fed];
  if (w && imgW(G, w)) return '<img src="' + esc(imgW(G, w)) + '" alt="">';
  if (o && imgFed(G, o.id)) return '<img class="logo" src="' + esc(imgFed(G, o.id)) + '" alt="">';
  return '<span class="uvdini" style="background:' + esc(m.c || "#a3abbd") + '">' + esc(m.ini || "?") + "</span>";
}
function cardHTML(G, m, ghost) {
  const A = decOf(G, m) || [], ch = A.filter(a => a[1] !== "go"), w = m.w && G.W[m.w];
  const R = ch[0], L = ch[ch.length - 1];
  const who = w && (m.from === w.n || m.k === "demand" || m.k === "req") ? w.n : m.from;
  return '<article class="uvdcard' + (ghost ? " gh" : "") + '"' + (ghost ? ' aria-hidden="true"' : ' data-swipe="1" data-id="' + esc(m.id) + '" data-r="' + R[1] + '" data-l="' + L[1] + '"') + ">" +
    '<div class="uvdpic">' + picOf(G, m) + '<span class="uvdst r">' + esc(R[0]) + '</span><span class="uvdst l">' + esc(L[0]) + "</span></div>" +
    '<div class="uvdwho"><b>' + esc(who || "") + "</b><small>" + esc((m.role || "") + (w && who !== m.from ? " · " + m.from : "")) + " · " + esc(dayLabel(m.d)) + "</small></div>" +
    '<div class="uvdbub"><b>' + esc(m.subj) + "</b><p>" + esc(m.body || "") + "</p></div></article>";
}
export function deckHTML(G, m, inMail) {
  const A = decOf(G, m) || [], ch = A.filter(a => a[1] !== "go"), links = A.filter(a => a[1] === "go"), w = m.w && G.W[m.w];
  const rest = decisions(G).filter(x => x !== m).length;
  return '<div class="uvdeck">' + gaugesHTML(G) +
    '<div class="uvdstack">' + (rest ? '<div class="uvdcard gh g2" aria-hidden="true"></div>' : "") + (rest > 1 ? '<div class="uvdcard gh g3" aria-hidden="true"></div>' : "") + cardHTML(G, m) + "</div>" +
    '<div class="uvdch" role="group" aria-label="Ta décision">' + ch.map((a, i) => '<button type="button" class="uvbtn' + (i === 0 ? " pri" : "") + '" data-act="uvdec" data-id="' + esc(m.id) + '" data-a="' + a[1] + '">' + (ch.length > 1 && i === 0 ? "→ " : ch.length > 1 && i === ch.length - 1 ? "← " : "") + esc(a[0]) + "</button>").join("") + "</div>" +
    (links.length || w ? '<div class="uvdlk">' + (w ? '<a href="#/univers/c/' + esc(w.id) + '">' + wnH(G, w.id) + " · sa fiche</a>" : "") + links.map(a => '<a href="' + esc(a[2]) + '">' + esc(a[0]) + "</a>").join("") + "</div>" : "") +
    '<p class="uvdhint">Glisse la carte à droite (→) ou à gauche (←), ou touche ta réponse.' + (rest ? " Encore " + rest + " décision" + (rest > 1 ? "s" : "") + " après celle-ci." : "") + "</p>" +
    (inMail ? "" : '<a class="uvbtn ghost" href="#/univers/courrier">Voir tout le courrier</a>') + "</div>";
}
function resultHTML(G) {
  const r = U.dres, m = G.mail.find(x => x.id === r.id), rest = decisions(G).length;
  return '<div class="uvdeck">' + gaugesHTML(G, r.d) + '<div class="uvdstack"><article class="uvdcard res" role="status">' + (m ? '<div class="uvdpic sm">' + picOf(G, m) + "</div>" : "") +
    '<div class="uvdbub"><b>' + esc(r.lab || "Décision prise") + "</b><p>" + esc(r.out || "") + "</p></div></article></div>" +
    '<div class="uvdch">' + (rest ? '<button type="button" class="uvbtn pri" data-act="uvdnext">Carte suivante (' + rest + ")</button>" : '<button type="button" class="uvbtn pri" data-act="uvdnext" data-to="g">Retour au menu</button>') + "</div></div>";
}
export function decideView() {
  const G = U.G;
  if (U.dres) return shell("courrier", "Décisions", "", resultHTML(G));
  const L = decisions(G);
  if (!L.length) return shell("courrier", "Décisions", "", '<div class="uvdeck">' + gaugesHTML(G) + '<p class="uvempty">Aucune décision en attente. Le patron et les catcheurs reviendront vers toi bientôt.</p><a class="uvbtn pri" href="#/univers/g">Menu général</a></div>');
  const m = L[0]; if (!m.read) { m.read = true; persist(); }
  return shell("courrier", "Décisions", "", deckHTML(G, m, false));
}
// dans le courrier : une lettre à décision s'affiche en carte
U.deckCard = (G, m) => U.dres && U.dres.id === m.id ? resultHTML(G) : decOf(G, m) ? deckHTML(G, m, true) : "";

function choose(id, a) {
  const G = U.G, m = G.mail.find(x => x.id === id); if (!m || m.done) return;
  const A = decOf(G, m) || [], lab = (A.find(x => x[1] === a) || [""])[0], g0 = gauges(G);
  ACT.uvmail({ dataset: { id: id, a: a } });
  if (!m.done) return; // action impossible (pas assez d'argent…) : la carte reste
  const g1 = gauges(G);
  U.dres = { id: id, out: m.done === "Vu." ? lab + "." : m.done, lab: lab, d: { pat: (g1.pat || 0) - (g0.pat || 0), ves: g1.ves - g0.ves, pub: g1.pub - g0.pub, arg: g1.arg - g0.arg } };
  redraw();
}
ACT.uvdec = el => choose(el.dataset.id, el.dataset.a);
ACT.uvdnext = el => { U.dres = null; if (el.dataset.to === "g") go("#/univers/g"); else if (location.hash !== "#/univers/decide") go("#/univers/decide"); else redraw(); };
if (typeof window !== "undefined") window.addEventListener("hashchange", () => { if (U.dres && !/^#\/univers\/(decide|courrier\/)/.test(location.hash)) U.dres = null; });

// glisser la carte (doigt ou souris)
let drag = null;
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", e => {
    const c = e.target.closest && e.target.closest(".uvdcard[data-swipe]"); if (!c || e.button > 0) return;
    drag = { c: c, x: e.clientX, y: e.clientY, dx: 0, on: false };
  });
  document.addEventListener("pointermove", e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) { if (Math.abs(dx) < 8) return; if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; } drag.on = true; drag.c.classList.add("drag"); }
    drag.dx = dx; drag.c.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 16) + "deg)";
    drag.c.style.setProperty("--sw", String(Math.max(-1, Math.min(1, dx / 110))));
  });
  const end = () => {
    if (!drag) return; const d = drag; drag = null; if (!d.on) return;
    d.c.classList.remove("drag");
    if (Math.abs(d.dx) > 95) { const a = d.dx > 0 ? d.c.dataset.r : d.c.dataset.l, id = d.c.dataset.id; d.c.classList.add(d.dx > 0 ? "outr" : "outl"); setTimeout(() => choose(id, a), 230); }
    else { d.c.style.transform = ""; d.c.style.setProperty("--sw", "0"); }
  };
  document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
}

// ---------- accueil : décisions, missions, rivale ----------
export function homeV3(G) {
  const D = decisions(G), o = rival(G), R = G.riv, mis = (G.mis || []).filter(m => m.st === "cours");
  let h = "";
  if (D.length) { const m = D[0];
    h += '<a class="uvdtile" href="#/univers/decide"><span class="uvdmini">' + (D[2] ? '<i class="b"></i>' : "") + (D[1] ? '<i class="a"></i>' : "") + '<span class="uvdmc">' + picOf(G, m) + "</span></span>" +
      '<span class="uvgrow"><small>' + (D.length > 1 ? D.length + " décisions t’attendent" : "Une décision t’attend") + "</small><b>" + esc(m.subj) + "</b><span>" + esc(m.from) + "</span></span><em>Décider</em></a>"; }
  if (o) {
    const last = R.hist[R.hist.length - 1], f = meF(G);
    h += '<a class="uvwar" href="#/univers/bureau/riv"><div class="uvwarh">Guerre des audiences</div><div class="uvwarr"><span class="uvwars me">' + crest(G, G.me, 46) + "<b>" + esc(f.sh || f.n) + '</b></span><span class="uvwarsc"><b>' + R.w + "</b><i>–</i><b>" + R.l + '</b><small>victoires</small></span><span class="uvwars">' + crest(G, o.id, 46) + "<b>" + esc(o.sh || o.n) + "</b></span></div>" +
      '<p class="uvwarl">' + (last ? "Semaine dernière : " + (last.won ? '<span class="uvok">tu gagnes</span>' : '<span class="uvko">' + esc(o.n) + " gagne</span>") + " · " + fmtM(last.me) + " contre " + fmtM(last.them) + (R.st >= 2 ? " · " + R.st + " victoires de suite" : R.st <= -2 ? " · " + -R.st + " défaites de suite" : "") : "Le premier face-à-face tombe lundi : fais une grosse audience !") + "</p></a>";
  }
  if (mis.length || G.mode !== "sandbox") h += '<a class="uvtile uvmis" href="#/univers/bureau/obj"><div class="uvth">Missions du patron <i>' + mis.length + " / 3</i></div>" + (mis.length ? mis.map(m => misRow(G, m)).join("") : '<p class="uvmut">De nouvelles missions arrivent dans les prochains jours.</p>') + "</a>";
  return h;
}
function misRow(G, m) {
  const p = misProg(G, m), left = m.until - G.day;
  return '<div class="uvmisr">' + (m.w && G.W[m.w] ? face(G, G.W[m.w], 30) : '<span class="uvmisi" aria-hidden="true">' + ({ r4: "★", show: "★", full: "🎟", war: "⚔", main: "★", sign: "✍", champ: "🏆", money: "$", hype: "🔥", win: "✓", pop: "▲" }[m.k] || "•") + "</span>") +
    '<span class="uvgrow"><b>' + esc(m.t || misTxt(G, m)) + "</b><small>" + (left >= 0 ? (left === 0 ? "Dernier jour" : "Encore " + left + " j") : "") + " · +" + fmtK(m.rw.m) + (G.mode !== "sandbox" ? " · confiance +" + m.rw.s : "") + "</small>" +
    (p[1] ? '<span class="uvmisp"><i style="width:' + Math.round(p[0] * 100) + '%"></i></span><small>' + esc(p[1]) + "</small>" : "") + "</span></div>";
}
U.homeV3 = homeV3;
// Bureau › Objectifs : les missions
U.misBody = G => { const mis = (G.mis || []).filter(m => m.st === "cours"), log = (G.misLog || []).slice(-10).reverse();
  return '<h3 class="uvh3">Missions du propriétaire</h3><p class="uvsm">Toujours 3 missions au plus. Réussies : argent + confiance. Ratées : la confiance baisse.</p>' +
    (mis.length ? '<div class="uvtile uvmis">' + mis.map(m => misRow(G, m)).join("") + "</div>" : '<p class="uvempty">Pas de mission pour l’instant.</p>') +
    (log.length ? '<h3 class="uvh3">Dernières missions</h3>' + log.map(x => '<div class="uvline"><span class="uvstat ' + (x.ok ? "ok" : "ko") + '">' + (x.ok ? "✓" : "✗") + '</span><span class="uvgrow">' + esc(x.t) + "<small> · " + esc(shortDate(x.d)) + "</small></span>" + (x.ok ? "<b>+" + fmtK(x.rw.m) + "</b>" : "") + "</div>").join("") : ""); };
// Bureau › Rivale
U.rivBody = G => {
  const o = rival(G), R = G.riv, f = meF(G); if (!o) return '<p class="uvempty">Pas de rivale pour l’instant.</p>';
  const top = F => roster(G, F).filter(w => w.fed === F).sort((a, b) => b.pop - a.pop).slice(0, 3);
  const col = (F, x) => '<div class="uvrivc">' + crest(G, F, 64) + "<b>" + esc(x.n) + "</b><small>Popularité " + Math.round(x.pop) + "</small>" + '<div class="uvrivt">' + top(F).map(w => '<a href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 40) + "<span>" + esc(w.n) + "</span></a>").join("") + "</div></div>";
  return '<div class="uvriv">' + col(G.me, f) + '<div class="uvrivvs"><b>' + R.w + "</b><i>VS</i><b>" + R.l + "</b><small>" + (R.best >= 2 ? "record : " + R.best + " semaines de suite" : "semaines gagnées") + "</small></div>" + col(o.id, o) + "</div>" +
    '<p class="uvsm">Chaque lundi, l’audience moyenne de tes shows TV de la semaine est comparée à celle de ' + esc(o.n) + ". Gagner fait monter ta popularité et la confiance du patron. Attention : la rivale peut signer des agents libres avant toi, approcher tes stars en fin de contrat ou se moquer de toi dans la presse.</p>" +
    (R.taunts.length ? '<h3 class="uvh3">Ce qu’ils disent</h3>' + R.taunts.slice(-3).reverse().map(t => '<div class="uvquote">« ' + esc(t.t) + " »<small>" + esc(shortDate(t.d)) + "</small></div>").join("") : "") +
    '<h3 class="uvh3">Face-à-face</h3>' + (R.hist.length ? R.hist.slice().reverse().slice(0, 12).map(h => { const mx = Math.max(h.me, h.them, 0.01); return '<div class="uvh2h"><small>Semaine du ' + esc(shortDate(h.d - 6)) + '</small><div class="uvh2hb"><span class="me" style="width:' + Math.round(h.me / mx * 100) + '%">' + fmtM(h.me) + '</span></div><div class="uvh2hb"><span style="width:' + Math.round(h.them / mx * 100) + '%">' + fmtM(h.them) + '</span></div><b class="' + (h.won ? "uvok" : "uvko") + '">' + (h.won ? "Gagné" : "Perdu") + "</b></div>"; }).join("") : '<p class="uvempty">Le premier face-à-face tombe lundi.</p>');
};

// ---------- la fenêtre des trophées et des missions réussies ----------
U.pops = () => {
  const G = U.G; if (!G || U.popOpen || (U.live && U.live.L && !U.live.L.done) || document.querySelector(".uvload, .uvtuto, .modal")) return;
  const A = (G._ach || []).filter(k => ACH[k]), P = G._pop || []; if (!A.length && !P.length) return;
  G._ach = []; G._pop = []; persist(); U.popOpen = true;
  modal((box, close) => {
    box.classList.add("uvmodal", "uvpop");
    box.innerHTML = '<div class="uvpopr" aria-hidden="true"></div>' +
      P.map(p => '<div class="uvpopi mis"><span class="uvpopb">✓</span><div><small>Mission réussie</small><b>' + esc(p.t) + "</b><p>+" + fmtK(p.m) + (p.s ? " · confiance du patron +" + p.s : "") + "</p></div></div>").join("") +
      A.map(k => '<div class="uvpopi"><span class="uvpopb">🏆</span><div><small>Trophée débloqué</small><b>' + esc(ACH[k][0]) + "</b><p>" + esc(ACH[k][1]) + "</p></div></div>").join("") +
      '<button type="button" class="uvbtn pri" data-x="1">Super !</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-x]")) close(); });
    const obs = new MutationObserver(() => { if (!document.body.contains(box)) { U.popOpen = false; obs.disconnect(); } }); obs.observe(document.body, { childList: true, subtree: true });
  });
};
