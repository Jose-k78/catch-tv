// Mode Univers : état de la partie en cours, sauvegarde, images, cadre commun (barre latérale, en-tête, onglets).
import { S, ACT, changed } from "../state.js";
import { esc, toast, lsGet, lsSet, modal, fileToDataUrl } from "../util.js";
import { showLogo, beltOf, beltVersions, artVersions, eventLogo, BELT, groupLogo } from "../assets.js";
import { saveSlot } from "./save.js";
import { dayLabel, dateOf, weekOf, fmtM } from "./world.js";
import { meF, autoCard, playShow } from "./sim.js";

export const U = { G: null, slot: 0, loading: false, f: { mail: "tout", actu: "coul", actuF: "tout", buzz: "tout", mw: "tous", mq: "", mfed: "", msty: "", mn: 40, eff: "tous", sty: "", chat: {}, gen: null, agen: null, nego: {} } };
export const go = h => { location.hash = h; };
export const redraw = () => changed("univ");

// ---------- sauvegarde (après chaque action, un peu retardée) ----------
let saveT = 0;
export function persist(now) {
  const G = U.G, slot = U.slot; if (!G || !slot) return;
  // pendant le direct (Gorilla position), la sauvegarde attend la fin du show
  if (U.live && U.live.L && !U.live.L.done) return;
  clearTimeout(saveT);
  const run = () => { const f = meF(G), aud = f.aud.length ? f.aud[f.aud.length - 1] : 0; saveSlot(slot, G, { n: f.n, sh: f.sh, c: f.c, fed: G.me, day: G.day, aud: aud, at: Date.now() }).catch(e => toast("⚠️ " + (e.message || "Sauvegarde impossible"))); };
  if (now) run(); else saveT = setTimeout(run, 600);
}
if (typeof window !== "undefined") window.addEventListener("pagehide", () => { if (U.G) persist(true); });

// ---------- images (base de données de TCC TV, changeables dans la partie) ----------
const IMG = (G, k) => (G.img || {})[k] || "";
export const imgW = (G, w) => (w && (IMG(G, "w:" + w.id) || w.pic)) || "";
export const imgT = (G, t) => (t && (IMG(G, "t:" + t.id) || beltOf(t.id))) || "";
export const imgFed = (G, k) => IMG(G, "f:" + k) || (k !== "ME" ? showLogo(k, "") : "") || "";
export const imgShow = (G, k, n) => IMG(G, "s:" + k + "|" + n) || (k !== "ME" ? showLogo(k, n) : "") || imgFed(G, k);
const grp = (G, id) => (G.teams || []).concat(G.clans || []).find(x => x.id === id);
export const imgTeam = (G, t) => (t && (IMG(G, "g:" + t.id) || (t.g ? groupLogo(t.g) : ""))) || "";
export const imgEv = (G, ev) => IMG(G, "e:" + ev.fed + "|" + ev.n) || (ev.kind === "tv" ? imgShow(G, ev.fed, ev.n) : (ev.fed !== "ME" && eventLogo({ k: ev.fed, t: ev.n })) || imgFed(G, ev.fed));
const initials = n => String(n || "?").split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
export function face(G, w, sz, cls) {
  const s = imgW(G, w), z = sz || 36;
  return s ? '<img class="uvav ' + (cls || "") + '" src="' + esc(s) + '" alt="" loading="lazy" style="width:' + z + "px;height:" + z + 'px">'
    : '<span class="uvav ini ' + (cls || "") + '" style="width:' + z + "px;height:" + z + "px;background:" + (w && w.fed === U.G.me ? "#f5b13d" : w && !w.fed ? "#63d69c" : "#a3abbd") + '">' + esc(initials(w && w.n)) + "</span>";
}
// un nom toujours accompagné de sa photo (21 nov. : « toujours afficher les photos à côté des noms »)
export function wnH(G, id, sz) { const w = (G.W || {})[id] || (G.staff || {})[id]; return '<span class="uvwn">' + face(G, w || { n: "?" }, sz || 22, "in") + esc((w && w.n) || "?") + "</span>"; }
export const teamH = (G, ids, sz) => (ids || []).map(i => wnH(G, i, sz)).join(" et ");
export const sidesH = (G, sides, sz) => (sides || []).map(s => teamH(G, s, sz)).join(" contre ");
// un texte (titre d'actu, buzz…) qui parle d'un catcheur : sa photo devant, si on reconnaît son nom
let NIX = null, NIXG = null;
export function whoIn(G, txt) {
  if (!txt) return null;
  if (NIXG !== G) { NIXG = G; NIX = Object.values(G.W).filter(w => w.n && w.n.length >= 5 && !w.ret).sort((a, b) => b.pop - a.pop).map(w => [w.n, w.id]); }
  for (let i = 0; i < NIX.length; i++) if (txt.indexOf(NIX[i][0]) >= 0) return G.W[NIX[i][1]] || null;
  return null;
}
// l'expéditeur d'un message : la photo du catcheur concerné, sinon ses initiales
export function mailAv(G, m, sz) {
  const w = (m.w && G.W[m.w]) || (m.fromW && G.W[m.fromW]);
  if (w && (m.from === w.n || /^Agent de /.test(m.from || "") || m.k === "demand" || m.k === "req" || m.k === "retire" || m.k === "askrel" || m.k === "playhurt" || m.k === "inj")) return face(G, w, sz);
  return '<span class="uvav ini" style="width:' + sz + "px;height:" + sz + "px;background:" + esc(m.c || "#a3abbd") + '">' + esc(m.ini || "") + "</span>";
}
export function crest(G, k, sz) {
  const f = G.F[k], s = imgFed(G, k), z = sz || 40;
  return s ? '<img class="uvcrest" src="' + esc(s) + '" alt="' + esc(f ? f.n : k) + '" style="width:' + z + "px;height:" + z + 'px">' : '<span class="uvcrest ini" style="width:' + z + "px;height:" + z + "px;background:" + esc((f && f.c) || "#f5b13d") + '">' + esc((f && f.sh) || k) + "</span>";
}
// choix d'une image : versions déjà dans les dossiers de Jose, ou une image du téléphone
export function photoChoices(w) {
  const out = [], e = (S.photos || {})[w.id];
  if (e) [e.f].concat(e.v || []).forEach(f => f && out.push("img/catcheurs/" + f));
  ((S.bank || {})[w.id] || []).forEach(f => out.push("img/tcg/alt/" + f));
  if (w.pic && out.indexOf(w.pic) < 0) out.unshift(w.pic);
  return out;
}
export function choicesFor(G, key) {
  const [t, id] = [key.slice(0, 1), key.slice(2)];
  if (t === "w") return photoChoices(G.W[id] || { id: id });
  // un titre sans ceinture dans les dossiers (titre créé dans la partie) : toutes les ceintures de TCC TV au choix
  if (t === "t") return beltOf(id) ? [beltOf(id)].concat(beltVersions(id)) : Object.keys(BELT).map(beltOf).filter(Boolean);
  if (t === "g") { const g = grp(G, id); return g && g.g && groupLogo(g.g) ? [groupLogo(g.g)] : []; }
  if (t === "f") return id !== "ME" ? [showLogo(id, "")].filter(Boolean) : [];
  if (t === "s") { const p = id.split("|"); return [showLogo(p[0], p[1])].filter(Boolean).concat(artVersions("shows", p[1])); }
  if (t === "e") { const p = id.split("|"); return [eventLogo({ k: p[0], t: p[1] })].filter(Boolean); }
  return [];
}
ACT.uvimg = el => {
  const G = U.G; if (!G) return; const key = el.dataset.k, cur = IMG(G, key), list = choicesFor(G, key).filter((x, i, a) => x && a.indexOf(x) === i);
  modal((box, close) => {
    box.classList.add("uvmodal");
    box.innerHTML = "<h3>Changer l’image</h3><p class=\"uvmut\">Le changement reste dans cette partie : les images de l’appli ne bougent pas.</p>" +
      (list.length ? '<div class="uvimgs">' + list.map(u => '<button type="button" class="uvimgc' + (u === cur ? " on" : "") + '" data-u="' + esc(u) + '"><img src="' + esc(u) + '" alt="" loading="lazy"></button>').join("") + "</div>" : '<p class="uvmut">Pas d’autre image dans tes dossiers pour celui-ci.</p>') +
      '<label class="uvbtn">Importer une image du téléphone<input type="file" accept="image/*" hidden></label>' +
      (cur ? '<button type="button" class="uvbtn ghost" data-reset="1">Remettre l’image de base</button>' : "") + (S.isAdmin && cur && !/^data:/.test(cur) ? '<button type="button" class="uvbtn ghost" data-all="1">✏️ Cette image pour tous (modo)</button>' : "") + '<button type="button" class="uvbtn ghost" data-close="1">Fermer</button>';
    const set = v => { G.img = G.img || {}; if (v) G.img[key] = v; else delete G.img[key]; persist(); close(); redraw(); };
    box.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.u) set(b.dataset.u); if (b.dataset.reset) set(""); if (b.dataset.close) close(); if (b.dataset.all && U.modoImg) { U.modoImg(key, cur); close(); } });
    box.querySelector("input[type=file]").addEventListener("change", async e => { const f = e.target.files && e.target.files[0]; if (!f) return; try { set(await fileToDataUrl(f, 360, 360, false, 60000)); } catch (er) { toast("Image illisible"); } });
  });
};
// choisir un catcheur dans une liste avec les photos (remplace les menus déroulants : toujours la photo à côté du nom)
// groups = [[titre, [{ w, ok, info }]]] ; cb(id)
export function pickW(G, title, groups, cb) {
  modal((box, close) => {
    box.classList.add("uvmodal", "uvpick");
    const row = r => '<button type="button" class="uvpkr"' + (r.ok === false ? " disabled" : "") + ' data-w="' + esc(r.w.id) + '">' + face(G, r.w, 40) + '<span class="uvgrow"><b>' + esc(r.w.n) + "</b>" + (r.info ? "<small>" + esc(r.info) + "</small>" : "") + "</span></button>";
    const paint = q => { const n = (q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), ok = w => !n || w.n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").indexOf(n) >= 0;
      const h = groups.map(g => { const L = g[1].filter(r => ok(r.w)); return L.length ? (g[0] ? '<h4 class="uvpkh">' + esc(g[0]) + "</h4>" : "") + L.map(row).join("") : ""; }).join("");
      box.querySelector(".uvpkl").innerHTML = h || '<p class="uvempty">Personne ne correspond.</p>'; };
    box.innerHTML = "<h3>" + esc(title) + '</h3><input class="uvin" type="search" placeholder="Chercher un nom…" aria-label="Chercher un nom"><div class="uvpkl" role="list"></div><button type="button" class="uvbtn ghost" data-x="1">Fermer</button>';
    paint("");
    box.querySelector("input").addEventListener("input", e => paint(e.target.value));
    box.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.x) close(); if (b.dataset.w && !b.disabled) { close(); cb(b.dataset.w); } });
  });
}
// tous les menus déroulants de catcheurs du mode Univers deviennent un bouton avec la photo (le menu reste caché dans le formulaire)
function enhanceSel(sel) {
  const G = U.G; if (!G) return; sel.dataset.wx = "1";
  const opts = Array.from(sel.options).filter(o => o.value);
  if (!opts.length || !opts.every(o => G.W[o.value])) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "uvwselb";
  const ph = (sel.options[0] && !sel.options[0].value ? sel.options[0].textContent : "") || "Choisir…";
  const paint = () => { const w = G.W[sel.value]; b.innerHTML = w ? face(G, w, 26) + "<span>" + esc(w.n) + "</span>" : "<span>" + esc(ph) + "</span>"; };
  paint(); sel.classList.add("uvwselh"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true"); sel.after(b);
  if (sel.getAttribute("aria-label")) b.setAttribute("aria-label", sel.getAttribute("aria-label"));
  b.addEventListener("click", () => {
    const groups = [], add = (g, o) => { const w = G.W[o.value], t = o.textContent, i = t.indexOf(w.n); let L = groups.find(x => x[0] === g); if (!L) groups.push(L = [g, []]); L[1].push({ w: w, ok: !o.disabled, info: (i >= 0 ? t.slice(i + w.n.length) : t).replace(/^[\s·(]+|[\s)]+$/g, "") }); };
    Array.from(sel.children).forEach(c => { if (c.tagName === "OPTGROUP") Array.from(c.children).forEach(o => o.value && add(c.label, o)); else if (c.value) add("", c); });
    pickW(G, ph.replace(/^[—+\s]+|[—\s]+$/g, "") || "Choisir", groups, id => { sel.value = id; paint(); sel.dispatchEvent(new Event("change", { bubbles: true })); });
  });
}
if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  const scan = () => { if (!document.body.classList.contains("univ") || !U.G) return; document.querySelectorAll(".uv select:not([data-wx]), .uvmodal select:not([data-wx])").forEach(enhanceSel); };
  let qd = 0; new MutationObserver(() => { if (qd) return; qd = 1; requestAnimationFrame(() => { qd = 0; scan(); }); }).observe(document.documentElement, { childList: true, subtree: true });
}
export const imgBtn = (key, label) => '<button type="button" class="uvimgbtn" data-act="uvimg" data-k="' + esc(key) + '">' + (label || "🖼️ Changer l’image") + "</button>";

// ---------- cadre commun ----------
const P = {
  menu: "M4 7h16M4 12h16M4 17h16", tel: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2M9 6h6", g: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z", courrier: "M3 6h18v12H3zM3 7l9 6 9-6",
  actu: "M4 5h13v14H5a1 1 0 0 1-1-1zM17 8h3v10a1 1 0 0 1-1 1h-2M7 9h7M7 12h7M7 15h4", buzz: "M3 10v4h3l7 4V6l-7 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12",
  monde: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18", fede: "M12 3l8 3v6c0 4.5-3.4 7.7-8 9-4.6-1.3-8-4.5-8-9V6zM9 12l2 2 4-4",
  creatif: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3", activite: "M4 20V10M10 20V4M16 20v-7M3 20h18", bureau: "M4 9h16v11H4zM9 9V5h6v4M4 14h16", parties: "M6 4h9l3 3v13H6zM9 4v5h6V4M9 14h6"
};
export const svg = d => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"></path></svg>';
const NAV = [["g", "Accueil"], ["courrier", "Courrier"], ["tel", "Tél."], ["actu", "Actu"], ["buzz", "Buzz"], ["monde", "Monde"], ["fede", "Ma fédé"], ["creatif", "Créatif"], ["activite", "Activité"], ["bureau", "Bureau"]];
export const unread = G => G.mail.filter(m => !m.read).length;
export function shell(sec, title, tabs, body) {
  const G = U.G, hide = lsGet("ctv.univ.rail") === "0", n = unread(G);
  const rail = hide ? "" : '<nav class="uvrail" aria-label="Barre latérale du mode Univers"><button type="button" class="uvrl" data-act="uvrail" aria-label="Cacher la barre latérale">' + svg(P.menu) + "<span>Cacher</span></button>" +
    NAV.map(x => '<a class="uvrl' + (x[0] === sec ? " on" : "") + '" href="#/univers/' + x[0] + '"' + (x[0] === sec ? ' aria-current="page"' : "") + ">" + svg(P[x[0]]) + "<span>" + x[1] + "</span>" + (x[0] === "courrier" && n ? '<b class="uvbdg">' + (n > 99 ? "99+" : n) + "</b>" : "") + (x[0] === "tel" && U.telBadge && U.telBadge(G) ? '<b class="uvbdg">' + U.telBadge(G) + "</b>" : "") + "</a>").join("") +
    '<a class="uvrl" href="#/univers">' + svg(P.parties) + "<span>Parties</span></a></nav>";
  const date = dayLabel(G.day) + " · Année " + dateOf(G.day).y;
  // trophées / missions réussies : la fenêtre s'ouvre sur l'accueil, le courrier, le bureau ou les résultats (jamais au milieu d'un formulaire)
  if (((G._ach || []).length || (G._pop || []).length) && U.pops && /^(g|courrier|bureau|activite)$/.test(sec) && !document.querySelector(".uvform input:focus")) setTimeout(() => U.pops && U.pops(), 450);
  return '<div class="uv' + (hide ? " norail" : "") + '">' + rail + '<div class="uvmain"><header class="uvtop">' +
    (hide ? '<button type="button" class="uvhb" data-act="uvrail" aria-label="Afficher la barre latérale">' + svg(P.menu) + "</button>" : "") +
    '<div class="uvtt"><b>' + esc(title) + "</b><small>" + esc(date) + (sec === "g" ? " · semaine " + weekOf(G.day) : "") + "</small></div>" +
    '<button type="button" class="uvnext" data-act="uvnext"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5l8 7-8 7zM12 5l8 7-8 7z"></path></svg><span class="uvnx1">Jour </span>suivant</button></header>' +
    (tabs || "") + '<div class="uvsc">' + body + "</div></div></div>";
}
export function tabs(base, list, cur) {
  return '<nav class="uvtabs" aria-label="Sous-menus">' + list.map(t => '<a class="uvtab' + (t[0] === cur ? " on" : "") + '" href="' + base + "/" + t[0] + '"' + (t[0] === cur ? ' aria-current="page"' : "") + ">" + esc(t[1]) + "</a>").join("") + "</nav>";
}
export const chips = (g, list, cur) => '<div class="uvchips" role="group">' + list.map(c => '<button type="button" class="uvchip' + (c[0] === cur ? " on" : "") + '" aria-pressed="' + (c[0] === cur) + '" data-act="uvchip" data-g="' + g + '" data-v="' + esc(c[0]) + '">' + esc(c[1]) + "</button>").join("") + "</div>";
ACT.uvchip = el => { U.f[el.dataset.g] = el.dataset.v; if (el.dataset.g === "mw") U.f.mn = 40; redraw(); };
ACT.uvrail = () => { lsSet("ctv.univ.rail", lsGet("ctv.univ.rail") === "0" ? null : "0"); redraw(); };

// « Jour suivant »
export function showPrompt(ev) {
  modal((box, close) => {
    box.classList.add("uvmodal");
    box.innerHTML = "<h3>Ce soir : " + esc(ev.n) + "</h3><p class=\"uvmut\">Avant de passer au jour suivant, il faut jouer le show de ce soir.</p>" +
      '<button type="button" class="uvbtn pri" data-a="book">Préparer la carte</button><button type="button" class="uvbtn" data-a="live">Vivre en direct (carte de l’IA si elle est vide)</button><button type="button" class="uvbtn" data-a="auto">Laisser l’IA tout faire (passer le show)</button><button type="button" class="uvbtn ghost" data-a="x">Plus tard</button>';
    box.addEventListener("click", e => { const b = e.target.closest("button[data-a]"); if (!b) return; close(); if (b.dataset.a === "book") go("#/univers/ev/" + encodeURIComponent(ev.id)); if (b.dataset.a === "auto") autoPlay(ev); if (b.dataset.a === "live" && U.goLive) U.goLive(ev); });
  });
}
export function autoPlay(ev) {
  const G = U.G; autoCard(G, ev); playShow(G, ev);
  G.mail.forEach(m => { if (m.k === "show" && m.ev === ev.id && !m.done) { m.done = "Show joué par l’IA."; m.read = true; } });
  persist(true); go("#/univers/ev/" + encodeURIComponent(ev.id)); redraw();
}
// « Jour suivant » : l'écran de défilement des jours est dans ui5.js (ACT.uvnext)
export const audTxt = v => fmtM(v || 0);
