// Mode Univers (21 nov., heure du codage) : les écrans des idées gardées par Jose — entrées spectaculaires et musique d'entrée YouTube
// (chaque joueur dans sa partie), fiche (renommer, rêve, emprunter, base du modo), accueil (réunion créative, circuit indé, house show),
// carte de la tournée, Bureau › Toi (niveau et talents du GM), centre de formation, prêts, équipes d'un clan, lettres du passé.
import { S, ACT, FORM } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { ghPutJson, ghGetJson } from "../github.js";
import { U, go, redraw, persist, shell, face, crest } from "./core.js";
import { meF, roster, isMine, wn, e_ } from "./base.js";
import { CITIES, REGIONS } from "./data.js";
import { shortDate, dayLabel, fmtK } from "./world.js";
import { MACTS } from "./ui.js";
import { part, rent } from "./deal.js";
import { decor } from "./ui8.js";
import { ENTX, entOf, heroOf, TAL, gmx, xpNeed, takeTal, dreamOf, dreamTxt, houseShow, meetingPick, indieSee, STY, slMake, modoBase } from "./extra.js";

// ---------- l'entrée : lumières, pyro, musique en live, héros local ----------
U.entLv = (ev, it) => Math.max(entOf(ev, it), Math.min(3, ev.ent || 0));
U.entFx = (G, ev, it) => {
  const lv = U.entLv(ev, it), ids = (it.sides || []).reduce((a, s) => a.concat(s), []), hero = ev.fed === G.me ? ids.map(i => G.W[i]).filter(w => w && heroOf(G, w, ev) === 2)[0] : null;
  return (lv ? '<span class="uventfx" aria-hidden="true">' + (lv >= 1 ? '<i class="bm b1"></i><i class="bm b2"></i><i class="bm b3"></i>' : "") + (lv >= 2 ? '<i class="py p1"></i><i class="py p2"></i><i class="py p3"></i><i class="py p4"></i>' : "") + (lv >= 3 ? '<i class="cf c1"></i><i class="cf c2"></i><i class="cf c3"></i><i class="cf c4"></i><i class="cf c5"></i><i class="cf c6"></i>' : "") + "</span>" : "") +
    (lv >= 3 ? '<p class="uvtvband">Le groupe joue son thème en live !</p>' : "") + (hero ? '<p class="uvtvhero">' + esc(hero.n) + " est chez " + (hero.sx === "f" ? "elle" : "lui") + " à " + esc((CITIES[ev.city != null ? ev.city : meF(G).home || 0] || [""])[0]) + " : la salle explose !</p>" : "");
};
// ---------- musique d'entrée (YouTube) : réglée par chaque joueur dans sa partie ----------
export const ytId = s => { s = String(s || "").trim(); const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) || s.match(/^([\w-]{11})$/); return m ? m[1] : ""; };
const ytT = s => { const m = String(s || "").match(/[?&]t=(\d+)/); return m ? +m[1] : 0; };
const muted = () => { try { return localStorage.getItem("ctv.univ.mus") === "0"; } catch (e) { return false; } };
let curV = "";
function play(v, t, who) {
  if (!v || muted()) return; let box = document.getElementById("uvyt");
  if (!box) { box = document.createElement("div"); box.id = "uvyt"; box.setAttribute("role", "region"); box.setAttribute("aria-label", "Musique d’entrée"); document.body.appendChild(box);
    box.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.x) { try { localStorage.setItem("ctv.univ.mus", "0"); } catch (er) {} stopMusic(); toast("Musiques coupées (Bureau › Réglages pour les remettre)"); } if (b.dataset.p) { const f = box.querySelector("iframe"); if (f) f.src = f.src; } }); }
  if (curV === v && box.querySelector("iframe")) return; curV = v;
  box.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(v) + "?autoplay=1&playsinline=1&rel=0&modestbranding=1&start=" + (t || 0) + '" title="Musique d’entrée" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="uvytb"><small>' + esc(who || "") + '</small><button type="button" data-p="1" aria-label="Relancer la musique">▶</button><button type="button" data-x="1" aria-label="Couper les musiques">✕</button></div>';
}
export function stopMusic() { const b = document.getElementById("uvyt"); if (b) b.remove(); curV = ""; }
if (typeof window !== "undefined") window.addEventListener("hashchange", () => { if (!/^#\/univers\/(live|c)\//.test(location.hash)) stopMusic(); });
const musOf = (G, id) => (G.mus || {})[id];
let lastK = "";
U.liveMusic = (G, ev, L, last) => {
  if (!last || !G.mus) return; const k = ev.id + ":" + L.log.length; if (k === lastK) return; lastK = k;
  const it = ev.items[last.i != null ? last.i : L.i]; let ids = [];
  if (last.res) { const r = L.out[L.out.length - 1] || {}; if (typeof r.win === "number") ids = r.sides[r.win] || []; }
  else if (last.ty === "runin" && last.who) ids = [last.who];
  else if ((last.big || last.ty === "intro") && it && it.it === "m") ids = (it.sides || []).reduce((a, s) => a.concat(s), []);
  const w = ids.map(i => G.W[i]).find(x => x && musOf(G, x.id)); if (w) { const m = musOf(G, w.id); play(m.v, m.t, w.n); }
};
FORM.uvmus = f => { const G = U.G, id = f.dataset.w, v = ytId(f.u.value); G.mus = G.mus || {}; if (!v) { toast("Lien YouTube non reconnu"); return; } G.mus[id] = { v: v, t: ytT(f.u.value) }; persist(); toast("Musique enregistrée dans ta partie"); redraw(); };
ACT.uvmustest = el => { const G = U.G, m = musOf(G, el.dataset.w); if (!m) return; try { localStorage.removeItem("ctv.univ.mus"); } catch (e) {} curV = ""; play(m.v, m.t, (G.W[el.dataset.w] || {}).n); };
ACT.uvmusdel = el => { const G = U.G; if (G.mus) delete G.mus[el.dataset.w]; stopMusic(); persist(); redraw(); };

// ---------- la fiche : musique, renommer, rêve, emprunter, base du modo ----------
const prevX = U.ficheX;
U.ficheX = (G, w) => {
  let h = prevX ? prevX(G, w) : ""; if (!w) return h; const m = musOf(G, w.id);
  if (isMine(G, w) && !w.ret) { const d = dreamOf(G, w), kn = (G.dreamK || {})[w.id] || (d && d.done);
    h += '<div class="uvrow2 uvfx"><button type="button" class="uvbtn sm" data-act="uvren" data-w="' + esc(w.id) + '">Renommer</button></div>' +
      '<p class="uvdream">' + (d && d.done ? "Son rêve, réalisé : " + esc(dreamTxt(G, w)) + " ✓" : kn ? "Son rêve : " + esc(dreamTxt(G, w)) : "Son rêve ? Parle-lui de son avenir (Dialogue) pour le découvrir.") + "</p>"; }
  if (w.fed && w.fed !== G.me && G.F[w.fed] && part(G, w.fed).deal && !w.guest) h += '<div class="uvrow2 uvfx"><button type="button" class="uvbtn sm" data-act="uvrent" data-w="' + esc(w.id) + '">L’emprunter 4 semaines (partenaire)</button></div>';
  h += '<details class="uvmus"><summary>Musique d’entrée' + (m ? " ✓" : "") + '</summary><form class="uvform" data-form="uvmus" data-w="' + esc(w.id) + '"><label class="uvfld">Lien YouTube<input name="u" inputmode="url" placeholder="https://youtu.be/…" value="' + (m ? "https://youtu.be/" + esc(m.v) + (m.t ? "?t=" + m.t : "") : "") + '"></label><p class="uvsm">Elle se joue à son entrée, quand ' + (w.sx === "f" ? "elle" : "il") + " gagne et quand " + (w.sx === "f" ? "elle" : "il") + " débarque dans un match. Gardée dans ta partie seulement.</p>" +
    '<div class="uvrow2"><button class="uvbtn sm pri">Enregistrer</button>' + (m ? '<button type="button" class="uvbtn sm" data-act="uvmustest" data-w="' + esc(w.id) + '">Écouter</button><button type="button" class="uvbtn sm ghost" data-act="uvmusdel" data-w="' + esc(w.id) + '">Retirer</button>' : "") + "</div></form></details>";
  if (S.isAdmin) h += '<div class="uvrow2 uvfx"><button type="button" class="uvbtn sm ghost" data-act="uvmodon" data-w="' + esc(w.id) + '">✏️ Nom pour tous (modo)</button></div>';
  return h;
};
const nameBox = (title, cur, fn) => modal((box, close) => { box.classList.add("uvmodal"); box.innerHTML = "<h3>" + esc(title) + '</h3><input class="uvin" id="uvnm2" maxlength="40" value="' + esc(cur || "") + '"><button type="button" class="uvbtn pri" data-y="1">Enregistrer</button><button type="button" class="uvbtn ghost" data-n="1">Annuler</button>';
  box.addEventListener("click", e => { if (e.target.closest("[data-n]")) close(); if (e.target.closest("[data-y]")) { const v = box.querySelector("#uvnm2").value.trim(); if (v) { close(); fn(v); } } }); });
ACT.uvren = el => { const G = U.G, w = G.W[el.dataset.w]; if (!isMine(G, w)) return; nameBox("Nouveau nom de " + w.n, w.n, v => { w.rn0 = w.rn0 || w.n; w.hist.push({ d: G.day, t: "Devient " + v }); w.n = v; persist(); toast("Renommé : " + v); redraw(); }); };
ACT.uvrent = el => { const G = U.G, r = rent(G, el.dataset.w, 4); if (r) toast(r, { ms: 3500 }); persist(); redraw(); };
// le modo : base commune (data/univers.json sur GitHub, clé du modo) pour toutes les nouvelles parties
async function saveBase(fn) {
  if (!S.realAdmin) return;
  try { const cur = await ghGetJson("data/univers.json"), d = (cur && cur.data) || JSON.parse(JSON.stringify(modoBase() || {})); d.names = d.names || {}; d.img = d.img || {}; fn(d); await ghPutJson("data/univers.json", d, "Mode Univers : base commune (modo)"); toast("Enregistré pour toutes les nouvelles parties"); }
  catch (e) { toast(/nokey/.test(e.message || "") ? "Il faut ta clé GitHub (Paramètres › Modération)" : "Envoi impossible : " + (e.message || e)); }
}
ACT.uvmodon = el => { const G = U.G, w = G.W[el.dataset.w]; if (!w || !S.realAdmin) return; nameBox("Nom pour tous (nouvelles parties)", w.n, v => { w.n = v; persist(); redraw(); saveBase(d => { d.names[w.id] = v; }); }); };
U.modoImg = (key, v) => saveBase(d => { if (v) d.img[key] = v; else delete d.img[key]; });

// ---------- l'accueil : réunion créative, circuit indé, house show, niveau du GM ----------
U.homeX = G => {
  const M = G.meet, I = G.indie, X = gmx(G); let h = "";
  if (M && M.i < M.cards.length && G.day - M.d < 7) h += '<a class="uvdtile uvmeet" href="#/univers/reunion"><span class="uvdmini"><span class="uvdmc"><span class="uvav ini" style="width:46px;height:46px;background:#c9a7ff">💡</span></span></span><span class="uvgrow"><small>Réunion créative de la semaine</small><b>' + (M.cards.length - M.i) + " idée" + (M.cards.length - M.i > 1 ? "s" : "") + " sur la table</b><span>Garde ou jette chaque idée.</span></span><em>Y aller</em></a>";
  if (I && G.day - I.d < 21 && I.L.some(id => G.W[id] && !G.W[id].fed)) h += '<a class="uvdtile" href="#/univers/indie"><span class="uvdmini"><span class="uvdmc">' + face(G, G.W[I.L[0]], 46) + '</span></span><span class="uvgrow"><small>Circuit indé</small><b>3 talents à aller voir</b><span>Avant la rivale.</span></span><em>Voir</em></a>';
  h += '<div class="uvquick"><button type="button" class="uvbtn" data-act="uvhouse">House show ce week-end</button><a class="uvbtn" href="#/univers/carte">Carte de la tournée</a><a class="uvbtn" href="#/univers/bureau/toi">GM niveau ' + X.lv + (X.pts ? " · talent à choisir !" : "") + "</a></div>";
  return h;
};
ACT.uvhouse = () => modal((box, close) => { box.classList.add("uvmodal"); box.innerHTML = '<h3>House show ce week-end</h3><p class="uvmut">Pas de télé : de l’argent, de l’expérience pour les jeunes et du moral pour ceux qui catchent. Un par semaine.</p><button type="button" class="uvbtn pri" data-y="1">Avec les jeunes en priorité</button><button type="button" class="uvbtn" data-y="2">Avec mes meilleurs catcheurs</button><button type="button" class="uvbtn ghost" data-n="1">Annuler</button>';
  box.addEventListener("click", e => { if (e.target.closest("[data-n]")) return close(); const b = e.target.closest("[data-y]"); if (!b) return; const r = houseShow(U.G, b.dataset.y === "1"); persist(); box.innerHTML = "<h3>" + (r.ok ? "House show joué !" : "Pas possible") + '</h3><p>' + esc(r.txt) + '</p><button type="button" class="uvbtn pri" data-n="1">OK</button>'; }); });

// ---------- la réunion créative (cartes à garder ou jeter) ----------
export function reunionView() {
  const G = U.G, M = G.meet;
  if (!M || M.i >= M.cards.length) return shell("creatif", "Réunion créative", "", '<div class="uvdeck"><p class="uvempty">' + (M ? "Réunion terminée : " + M.kept + " idée" + (M.kept > 1 ? "s" : "") + " gardée" + (M.kept > 1 ? "s" : "") + "." : "Pas de réunion cette semaine.") + ' La prochaine, c’est lundi.</p><a class="uvbtn pri" href="#/univers/g">Menu général</a></div>');
  const c = M.cards[M.i], ws = [c.a, c.b, c.w].filter(Boolean).map(i => G.W[i]).filter(Boolean);
  return shell("creatif", "Réunion créative", "", '<div class="uvdeck"><p class="uvmut">Idée ' + (M.i + 1) + " sur " + M.cards.length + '</p><div class="uvdstack"><article class="uvdcard uvmcard" data-mswipe="1"><div class="uvdpic">' + ws.map(w => face(G, w, 84)).join("") + '<span class="uvdst r">Garder</span><span class="uvdst l">Jeter</span></div><div class="uvdbub"><b>' + esc(c.t) + "</b><p>" + esc(c.d) + "</p></div></article></div>" +
    '<div class="uvdch"><button type="button" class="uvbtn pri" data-act="uvmeetk" data-k="1">→ Garder</button><button type="button" class="uvbtn" data-act="uvmeetk" data-k="0">← Jeter</button></div><p class="uvdhint">Glisse la carte à droite pour garder, à gauche pour jeter.</p></div>');
}
function meetDo(keep) { const r = meetingPick(U.G, keep); persist(); if (r) toast(r); redraw(); }
ACT.uvmeetk = el => meetDo(el.dataset.k === "1");
if (typeof document !== "undefined") {
  let P = null;
  document.addEventListener("pointerdown", e => { const c = e.target.closest && e.target.closest(".uvmcard[data-mswipe]"); if (c && !(e.button > 0)) P = { c: c, x: e.clientX, dx: 0, on: false }; });
  document.addEventListener("pointermove", e => { if (!P) return; const dx = e.clientX - P.x; if (!P.on && Math.abs(dx) < 8) return; P.on = true; P.dx = dx; P.c.style.transform = "translateX(" + dx + "px) rotate(" + dx / 16 + "deg)"; P.c.style.setProperty("--sw", String(Math.max(-1, Math.min(1, dx / 110)))); });
  const up = () => { if (!P) return; const p = P; P = null; if (!p.on) return; if (Math.abs(p.dx) > 95) { p.c.classList.add(p.dx > 0 ? "outr" : "outl"); setTimeout(() => meetDo(p.dx > 0), 230); } else { p.c.style.transform = ""; p.c.style.setProperty("--sw", "0"); } };
  document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
}

// ---------- le circuit indé ----------
export function indieView() {
  const G = U.G, I = G.indie;
  if (!I) return shell("monde", "Circuit indé", "", '<p class="uvempty">Ton recruteur te proposera 3 talents au début du mois prochain.</p>');
  return shell("monde", "Circuit indé", "", '<p class="uvsm">Repérés le ' + esc(shortDate(I.d)) + ". Va les voir (5 k$) pour que ton recruteur les connaisse, puis signe-les avant la rivale.</p>" +
    I.L.map(id => { const w = G.W[id]; if (!w) return ""; const seen = I.seen[id], gone = w.fed && w.fed !== G.me, mine = w.fed === G.me;
      return '<div class="uvcard uvindie"><div class="uvrow">' + face(G, w, 54) + '<a class="uvgrow" href="#/univers/c/' + esc(w.id) + '"><b>' + esc(w.n) + "</b><small>" + w.age + " ans · " + (w.sx === "f" ? "catcheuse" : "catcheur") + " · " + (seen ? "vu" + e_(w) + " par ton recruteur" : "jamais vu" + e_(w)) + "</small></a></div>" +
        (mine ? '<p class="uvok">Chez toi !</p>' : gone ? '<p class="uvko">Signé' + e_(w) + " par " + esc((G.F[w.fed] || {}).n || "") + "</p>" : '<div class="uvrow2">' + (seen ? "" : '<button type="button" class="uvbtn sm" data-act="uvindsee" data-w="' + esc(id) + '">Aller le voir (5 k$)</button>') + '<a class="uvbtn sm pri" href="#/univers/nego/' + esc(id) + '">Lui proposer un contrat</a></div>') + "</div>"; }).join(""));
}
ACT.uvindsee = el => { const r = indieSee(U.G, el.dataset.w); if (r) toast(r); persist(); redraw(); };

// ---------- la carte de la tournée : les villes s'allument ----------
const POS = { Chicago: [-87.6, 41.9], Philadelphie: [-75.2, 40], "New York": [-74, 40.7], Boston: [-71, 42.4], "Los Angeles": [-118.2, 34], "Las Vegas": [-115.1, 36.2], Orlando: [-81.4, 28.5], Houston: [-95.4, 29.8], Atlanta: [-84.4, 33.7], Seattle: [-122.3, 47.6], Toronto: [-79.4, 43.7], "Montréal": [-73.6, 45.5],
  Londres: [-0.1, 51.5], Manchester: [-2.2, 53.5], Paris: [2.35, 48.9], Berlin: [13.4, 52.5], Madrid: [-3.7, 40.4], Rome: [12.5, 41.9], Tokyo: [139.7, 35.7], Osaka: [135.5, 34.7], Nagoya: [136.9, 35.2], Mexico: [-99.1, 19.4], Monterrey: [-100.3, 25.7], Guadalajara: [-103.3, 20.7], Sydney: [151.2, -33.9], Riyad: [46.7, 24.7] };
const LAND = ["M30 40 L95 28 L140 44 L132 70 L112 86 L96 104 L86 98 L70 86 L52 72 L38 58 Z", "M100 108 L120 108 L132 128 L124 158 L112 176 L104 160 L98 132 Z", "M188 40 L228 34 L240 46 L226 60 L206 64 L190 58 Z", "M194 70 L232 68 L246 90 L236 124 L218 138 L204 120 L196 94 Z",
  "M232 34 L318 28 L352 46 L346 68 L322 80 L292 86 L262 74 L242 62 Z", "M322 128 L356 122 L366 140 L350 152 L326 146 Z", "M346 58 L354 62 L352 74 L344 72 Z"];
export function carteView() {
  const G = U.G, V = G.cities || {}, mx = Math.max(1, ...Object.values(V)), home = meF(G).home || 0;
  const pt = n => { const p = POS[n] || [0, 0]; return [(p[0] + 180) / 360 * 400, (90 - p[1]) / 180 * 200 - 8]; };
  const dots = CITIES.map((c, i) => { const p = pt(c[0]), v = V[i] || 0, on = v > 0; return '<g class="uvcd' + (on ? " on" : "") + (i === home ? " home" : "") + '">' + (on ? '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (5 + 7 * v / mx).toFixed(1) + '" class="gl"/>' : "") + '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.4"/></g>'; }).join("");
  const list = CITIES.map((c, i) => [c, V[i] || 0, i]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
  return shell("activite", "Carte de la tournée", "", '<div class="uvmap"><svg viewBox="0 0 400 200" role="img" aria-label="Carte des villes où tu as fait un show">' + LAND.map(d => '<path d="' + d + '" class="ld"/>').join("") + dots + "</svg></div>" +
    '<p class="uvsm">Chaque ville où passe un de tes shows (télé, grand événement ou house show) s’allume. Plus tu y reviens, plus elle brille.</p>' +
    (list.length ? list.map(x => '<div class="uvline"><span class="uvcdot" aria-hidden="true"></span><span class="uvgrow"><b>' + esc(x[0][0]) + "</b><small>" + esc(REGIONS[x[0][3]] || "") + (x[2] === home ? " · ta ville" : "") + "</small></span><b>" + x[1] + " show" + (x[1] > 1 ? "s" : "") + "</b></div>").join("") : '<p class="uvempty">Aucune ville encore : ton premier show l’allumera.</p>'));
}

// ---------- Bureau › Toi : niveau et talents du GM ----------
U.gmBody = G => { const X = gmx(G), need = xpNeed(X.lv);
  return '<div class="uvtile uvgmlv"><div class="uvth">' + esc((G.gm && G.gm.n) || "Toi") + '</div><div class="uvbig">Niveau ' + X.lv + '</div><span class="uvbar"><i style="width:' + Math.round(X.xp / need * 100) + '%"></i></span><p class="uvsm">Tu gagnes de l’expérience avec tes shows, tes missions réussies, la guerre des audiences et tes signatures.' + (X.pts ? " <b>" + X.pts + " talent" + (X.pts > 1 ? "s" : "") + " à choisir.</b>" : "") + "</p></div>" +
    Object.keys(TAL).map(k => { const on = X.tal.indexOf(k) >= 0; return '<div class="uvcard uvtal' + (on ? " on" : "") + '"><div class="uvrow"><span class="uvgrow"><b>' + esc(TAL[k][0]) + "</b><small>" + esc(TAL[k][1]) + "</small></span>" + (on ? '<span class="uvok">Acquis ✓</span>' : '<button type="button" class="uvbtn sm' + (X.pts ? " pri" : "") + '" data-act="uvtal" data-k="' + k + '"' + (X.pts ? "" : " disabled") + ">Prendre</button>") + "</div></div>"; }).join(""); };
ACT.uvtal = el => { if (takeTal(U.G, el.dataset.k)) { toast("Talent acquis : " + TAL[el.dataset.k][0]); persist(); redraw(); } };

// ---------- centre de formation, prêts, équipe d'un clan ----------
U.devHead = G => '<div class="uvlock">' + decor("gym") + "<b>Centre de formation</b><small>Ils apprennent le métier. À 100 %, remise de diplôme.</small></div>";
const prevPromote = ACT.uvpromote;
ACT.uvpromote = el => { const G = U.G, y = (G.dev || []).find(x => x.id === el.dataset.y); if (!y || !prevPromote) return; const before = new Set(Object.keys(G.W)); prevPromote(el);
  const id = Object.keys(G.W).find(k => !before.has(k)), w = id && G.W[id]; if (!w) return;
  modal((box, close) => { box.classList.add("uvmodal", "uvgrad"); box.innerHTML = '<div class="uvlock">' + decor("presse") + "<b>Remise de diplôme</b><small>" + esc(w.n) + "</small></div><p>" + esc(w.n) + " a terminé sa formation. Où " + (w.sx === "f" ? "commence-t-elle" : "commence-t-il") + " ?</p>" +
    '<button type="button" class="uvbtn pri" data-g="me">Dans mon effectif' + (G.solo ? " (" + esc(G.solo) + ")" : "") + "</button>" + (G.me === "WWE" && G.solo !== "NXT" ? '<button type="button" class="uvbtn" data-g="NXT">À NXT, pour continuer à apprendre</button>' : "");
    box.addEventListener("click", e => { const b = e.target.closest("[data-g]"); if (!b) return; if (b.dataset.g === "NXT") w.br = "NXT"; else if (G.solo) w.br = G.solo; persist(); close(); redraw(); }); }); };
U.loansBox = G => { const out = roster(G, G.me).filter(w => w.guest && w.guest.lend && w.guest.until >= G.day), inn = Object.values(G.W).filter(w => w.guest && w.guest.to === G.me && w.guest.until >= G.day && w.fed !== G.me);
  return out.length || inn.length ? '<div class="uvtile"><div class="uvth">Prêts en cours</div>' + out.map(w => '<div class="uvline">' + face(G, w, 30) + '<span class="uvgrow">' + esc(w.n) + "<small> prêté" + e_(w) + " à " + esc((G.F[w.guest.to] || {}).n || "") + " jusqu’au " + esc(shortDate(w.guest.until)) + "</small></span></div>").join("") +
    inn.map(w => '<div class="uvline">' + face(G, w, 30) + '<span class="uvgrow">' + esc(w.n) + "<small> vient de " + esc((G.F[w.fed] || {}).n || "") + " jusqu’au " + esc(shortDate(w.guest.until)) + "</small></span></div>").join("") + "</div>" : ""; };
U.clanTeams = (G, c) => { const T = (G.teams || []).filter(t => t.clan === c.id); return T.length ? '<p class="uvsm">Équipe du clan : ' + T.map(t => esc(t.n)).join(", ") + "</p>" : ""; };

// ---------- lettres du passé (Ghost of Booking) et du circuit indé ----------
MACTS.ghost = m => [["Relancer la rivalité", "ghostyes"], ["Laisser le passé", "ok"]];
MACTS.ghost2 = m => [["Lancer sa quête du titre", "ghost2yes"], ["Pas maintenant", "ok"]];
MACTS.indie = m => [["Voir les talents", "go", "#/univers/indie"], ["Plus tard", "ok"]];
U.mact = Object.assign(U.mact || {}, {
  ghostyes: (G, m) => { const s = (G.sl || []).find(x => x.id === m.sl); if (!s) return "Trop tard."; const n = slMake(G, "revenge", s.a[0], s.b[0], "Le retour de « " + s.n + " »", 5); n.heat = 40; G.sl.push(n); return "La vieille rivalité reprend (Créatif › Storylines)."; },
  ghost2yes: (G, m) => { const w = G.W[m.w], o = roster(G).filter(x => x.fed === G.me && x.id !== m.w && w && x.sx === w.sx).sort((a, b) => b.pop - a.pop)[0]; if (!w || !o) return "Pas possible."; G.sl.push(slMake(G, "quest", w.id, o.id)); return "La quête du titre de " + w.n + " commence."; }
});
// le dialogue : « Parler de son avenir » révèle son rêve
U.dreamSay = (G, w) => { G.dreamK = G.dreamK || {}; G.dreamK[w.id] = 1; return "Mon rêve ? " + dreamTxt(G, w) + ". Un jour, j’y arriverai."; };
U.styOpts = () => Object.keys(STY).map(k => '<option value="' + k + '">' + esc(STY[k][0]) + " — " + esc(STY[k][1]) + "</option>").join("");
