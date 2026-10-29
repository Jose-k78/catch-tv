// Trophées : gagnés pour toujours, chacun avec sa petite icône dessinée exprès (bronze, argent, or, puis un palier spécial).
// Calculés sur l'appareil du membre à partir de ses données ; les paliers gagnés sont gardés dans son profil (tro).
import { S, B, ACT, avatar, prof, nameOf, need, changed } from "../state.js";
import { esc, ICON, fmt, toast, modal } from "../util.js";
import { parisDay } from "../time.js";
import { isMatchNote } from "./mrate.js";
import { perfectCards } from "./picks.js";
import { ding } from "../intro.js";
import { errText } from "./account.js";

// fin des inscriptions « Membre fondateur »
const FOUNDER_UNTIL = Date.parse("2026-12-01T00:00:00+01:00");

// ---------- icônes (SVG 48×48, dessins originaux) ----------
const MET = { b: ["#d58c4a", "#7a4416"], s: ["#e3e7ec", "#6f7782"], o: ["#f7c948", "#8f6200"] };
const sv = (inner, size, title) => '<svg class="tro-ic" viewBox="0 0 48 48" width="' + size + '" height="' + size + '" aria-hidden="true">' + inner + "</svg>";
const STAR = (cx, cy, r, fill) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1); } return '<path d="' + d + 'Z" fill="' + fill + '"/>'; };
const G = {
  ticket: (f, s) => '<path d="M5 14h38v6a4 4 0 0 0 0 8v6H5v-6a4 4 0 0 0 0-8z" fill="' + f + '" stroke="' + s + '" stroke-width="2"/><path d="M33 15v18" stroke="' + s + '" stroke-width="1.6" stroke-dasharray="2 2.5"/>' + STAR(19, 24, 6.5, s),
  tshirt: () => '<path d="M17 7l-10 6 4.5 8 4-2v22h17V19l4 2 4.5-8-10-6c-1 3.2-4 5-7 5s-6-1.8-7-5z" fill="#3dff2e" stroke="#168000" stroke-width="2" stroke-linejoin="round"/><path d="M19 27h10" stroke="#168000" stroke-width="2" stroke-linecap="round"/>',
  bubble: (f, s) => '<path d="M8 9h32a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H23l-9 8v-8H8a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4z" fill="' + f + '" stroke="' + s + '" stroke-width="2"/><circle cx="16" cy="21" r="2.6" fill="' + s + '"/><circle cx="24" cy="21" r="2.6" fill="' + s + '"/><circle cx="32" cy="21" r="2.6" fill="' + s + '"/>',
  phone: (f, s) => '<rect x="13" y="4" width="22" height="40" rx="5" fill="' + f + '" stroke="' + s + '" stroke-width="2"/><rect x="16.5" y="9" width="15" height="27" rx="2" fill="' + s + '" opacity=".25"/><circle cx="24" cy="22" r="5" fill="#e50914"/><circle cx="24" cy="22" r="8.5" fill="none" stroke="#e50914" stroke-width="1.6" opacity=".6"/><rect x="21" y="39" width="6" height="2" rx="1" fill="' + s + '"/>',
  mic: (f, s) => '<rect x="17" y="4" width="14" height="23" rx="7" fill="' + f + '" stroke="' + s + '" stroke-width="2"/><path d="M17 12h14M17 17h14" stroke="' + s + '" stroke-width="1.5" opacity=".6"/><path d="M11 21a13 13 0 0 0 26 0M24 34v8M16 43h16" fill="none" stroke="' + s + '" stroke-width="3" stroke-linecap="round"/>',
  plaque: () => '<rect x="4" y="12" width="40" height="28" rx="4" fill="#eef7ff" stroke="#5b7c99" stroke-width="2"/><rect x="8" y="16" width="32" height="20" rx="2" fill="none" stroke="#5b7c99" stroke-width="1" opacity=".5"/>' +
    [11, 17.5, 24, 30.5].map(x => STAR(x, 27, 3.6, "#f5b301")).join("") + STAR(37.5, 27, 3.6, "#f5b301") + STAR(40, 9, 5.2, "#ff5a63"),
  globe: (f, s, n) => '<circle cx="24" cy="25" r="17" fill="' + f + '" stroke="' + s + '" stroke-width="2"/><ellipse cx="24" cy="25" rx="7.5" ry="17" fill="none" stroke="' + s + '" stroke-width="1.5"/><path d="M7 25h34M10 16h28M10 34h28" stroke="' + s + '" stroke-width="1.5"/>' +
    [[15, 13], [33, 15], [27, 31], [12, 29], [37, 27], [20, 21], [30, 22], [22, 36], [17, 33]].slice(0, n).map(p => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.4" fill="#e50914" stroke="#fff" stroke-width="1"/>').join(""),
  vhs: (f, s) => '<rect x="4" y="12" width="40" height="25" rx="3" fill="' + f + '" stroke="' + s + '" stroke-width="2"/><rect x="11" y="17" width="26" height="11" rx="2" fill="' + s + '" opacity=".85"/><circle cx="18" cy="22.5" r="3.2" fill="' + f + '"/><circle cx="30" cy="22.5" r="3.2" fill="' + f + '"/><path d="M10 32h28" stroke="' + s + '" stroke-width="1.6"/>',
  crystal: () => '<circle cx="24" cy="21" r="15" fill="#b892ff" stroke="#5a2ca0" stroke-width="2"/><path d="M15 15a10 10 0 0 1 8-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/><rect x="17" y="18" width="14" height="9" rx="1" fill="#fff"/><path d="M17 18l7 5 7-5" fill="none" stroke="#5a2ca0" stroke-width="1.3"/><path d="M14 36h20l3 7H11z" fill="#5a2ca0"/>',
  ballot: (f, s) => '<rect x="16" y="5" width="16" height="20" rx="1.5" fill="#fff" stroke="' + s + '" stroke-width="1.6"/><path d="M19.5 14l3 3 6-7" fill="none" stroke="#1f9d55" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="7" y="21" width="34" height="21" rx="3" fill="' + f + '" stroke="' + s + '" stroke-width="2"/><rect x="15" y="20" width="18" height="3" rx="1.5" fill="' + s + '"/>',
  ring: (f, s) => '<rect x="7" y="11" width="34" height="28" rx="2" fill="' + f + '" opacity=".35"/>' + [16, 22, 28].map(y => '<path d="M7 ' + y + 'h34" stroke="' + s + '" stroke-width="2.2"/>').join("") +
    [[7, 11], [41, 11], [7, 39], [41, 39]].map(p => '<rect x="' + (p[0] - 2.5) + '" y="' + (p[1] - 4) + '" width="5" height="8" rx="1.5" fill="' + f + '" stroke="' + s + '" stroke-width="1.4"/>').join(""),
  cage: (f, s) => '<rect x="7" y="8" width="34" height="33" rx="1.5" fill="none" stroke="' + s + '" stroke-width="2.4"/>' + [13.5, 20, 26.5, 33].map(x => '<path d="M' + x + ' 8v33" stroke="' + f + '" stroke-width="2.4"/>').join("") +
    [16, 24, 32].map(y => '<path d="M7 ' + y + 'h34" stroke="' + f + '" stroke-width="1.6"/>').join("") + '<path d="M7 41h34" stroke="' + s + '" stroke-width="3"/>',
  cell: (f, s) => '<path d="M4 18L24 5l20 13z" fill="#b3121c" stroke="' + s + '" stroke-width="1.6" stroke-linejoin="round"/><rect x="7" y="18" width="34" height="24" fill="#b3121c" opacity=".25" stroke="' + s + '" stroke-width="2"/>' +
    [12.5, 18, 23.5, 29, 34.5].map(x => '<path d="M' + x + ' 18v24" stroke="' + f + '" stroke-width="2.2"/>').join("") + '<path d="M7 26h34M7 34h34" stroke="' + f + '" stroke-width="1.4"/>',
  burst: (f, s, n) => { let d = "", k = n || 10; for (let i = 0; i < k * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / k, r = i % 2 ? 11 : 20; d += (i ? "L" : "M") + (24 + r * Math.cos(a)).toFixed(1) + " " + (24 + r * Math.sin(a)).toFixed(1); }
    return '<path d="' + d + 'Z" fill="' + f + '" stroke="' + s + '" stroke-width="2" stroke-linejoin="round"/><text x="24" y="28.5" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="11" fill="' + s + '">POP</text>'; },
  glass: (f, s) => '<circle cx="24" cy="24" r="19" fill="' + f + '" stroke="' + s + '" stroke-width="2"/><path d="M24 24L13 9M24 24l14-12M24 24l17 4M24 24l9 17M24 24L12 39M24 24L5 21" stroke="' + s + '" stroke-width="1.8" stroke-linecap="round"/><path d="M18 17l6-1 4 4M28 30l-6 1-5-3M33 22l-2 5" fill="none" stroke="' + s + '" stroke-width="1.2"/><circle cx="24" cy="24" r="2.6" fill="' + s + '"/>',
  bulb: (f, s) => '<path d="M24 4a13 13 0 0 0-7.5 23.6V33h15v-5.4A13 13 0 0 0 24 4z" fill="' + f + '" stroke="' + s + '" stroke-width="2"/><path d="M19 37h10M20 41h8" stroke="' + s + '" stroke-width="2.6" stroke-linecap="round"/><path d="M20 24l4-6 4 6" fill="none" stroke="' + s + '" stroke-width="1.8"/>' +
    '<path d="M6 13l3 1.5M42 13l-3 1.5M24 1v0" stroke="' + s + '" stroke-width="2" stroke-linecap="round"/>',
  stone: () => '<path d="M10 10h28l5 9-5 21H10L5 19z" fill="#c9c4bb" stroke="#6b645a" stroke-width="2" stroke-linejoin="round"/><path d="M10 10l4 9h20l4-9M14 19L10 40M34 19l4 21" fill="none" stroke="#6b645a" stroke-width="1" opacity=".6"/><text x="24" y="34" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="15" fill="#e50914">1</text>',
  slammy: () => '<path d="M14 9h20v9a10 10 0 0 1-20 0z" fill="#f7c948" stroke="#8f6200" stroke-width="2"/><path d="M14 12H8a6 6 0 0 0 6 7M34 12h6a6 6 0 0 1-6 7" fill="none" stroke="#8f6200" stroke-width="2"/><path d="M24 28v6M16 42h16l-2-8H18z" fill="#f7c948" stroke="#8f6200" stroke-width="2" stroke-linejoin="round"/>' + STAR(24, 17, 5.5, "#e50914"),
};

// ---------- familles et paliers (validés par l'admin) ----------
// v : valeur du membre ; t : [seuil, nom, dessin, couleurs]
export const FAM = [
  { id: "spec", n: "Spectateur", what: "shows marqués « vu »", t: [[10, "Dernier rang", "ticket", "b"], [50, "Deuxième rang", "ticket", "s"], [100, "Premier rang", "ticket", "o"], [500, "Le Green T-shirt Guy", "tshirt"]] },
  { id: "crit", n: "Critique", what: "notes avec un commentaire", t: [[10, "Le Twittos", "bubble", "b"], [50, "L’Influenceur", "phone", "s"], [100, "Le Journaliste", "mic", "o"], [500, "Dave Meltzer", "plaque"]] },
  { id: "globe", n: "Globe-trotter", what: "promotions avec au moins un show noté", t: [[3, "Le Touriste", "globe", "b"], [5, "Le Free Agent", "globe", "s"], [0, "Forbidden Door", "globe", "o"]] },
  { id: "hist", n: "Historien", what: "shows d’avant 2010 notés", t: [[5, "Ruthless Aggression", "vhs", "b"], [25, "Attitude Era", "vhs", "s"], [50, "Golden Era", "vhs", "o"]] },
  { id: "pred", n: "It’s not a prediction", what: "cartes de PLE pronostiquées à 100 %", t: [[1, "It’s not a prediction", "crystal"]] },
  { id: "vote", n: "Électeur", what: "sondages votés", t: [[10, "« What? »", "ballot", "b"], [50, "« Yes! Yes! Yes! »", "ballot", "s"], [100, "Le Yes Movement", "ballot", "o"]] },
  { id: "riv", n: "Rivalité", what: "jours de feud d’affilée (record)", t: [[7, "Match simple", "ring", "b"], [30, "Steel Cage", "cage", "s"], [100, "Hell in a Cell", "cell", "o"]] },
  { id: "pop", n: "Populaire", what: "réactions et réponses reçues", t: [[10, "Le petit pop", "burst", "b"], [50, "Le gros pop", "burst", "s"], [100, "Glass Shatter", "glass", "o"]] },
  { id: "idea", n: "Idée retenue", what: "idées passées en « Fait »", t: [[1, "Le Booker", "bulb", "s"], [3, "Head of Creative", "bulb", "o"]] },
  { id: "found", n: "Membre fondateur", what: "inscrit dès le lancement de l’app", t: [[1, "Day One", "stone"]] },
];
const seuil = (f, i) => f.id === "globe" && !f.t[i][0] ? Math.max(6, Object.keys(S.P).length) : f.t[i][0];
export function trophyIcon(fid, i, size, locked) {
  const f = FAM.find(x => x.id === fid), t = f && f.t[i]; if (!t) return "";
  const c = locked ? ["#a2a2ad", "#8b8b96"] : MET[t[3]] || ["#ccc", "#666"];
  const extra = fid === "globe" ? [3, 5, 9][i] : fid === "pop" ? [8, 12][i] : undefined;
  return '<span class="tro' + (locked ? " locked" : "") + '">' + sv(G[t[2]](c[0], c[1], extra), size || 40) + "</span>";
}
export const slammyIcon = size => '<span class="tro">' + sv(G.slammy(), size || 40) + "</span>";
const tierId = (fid, i) => fid + "-" + i;
const nameOfTier = id => { const p = id.split("-"), f = FAM.find(x => x.id === p[0]), t = f && f.t[+p[1]]; return t ? { f: f, i: +p[1], n: t[1] } : null; };

// ---------- calcul (pour moi) ----------
export function myValues() {
  const me = S.user ? S.user.uid : "", hist = Object.values(S.history || {});
  const shows = hist.filter(h => !isMatchNote(h));
  const promos = new Set(shows.filter(h => h.rating > 0 && S.P[h.k]).map(h => h.k));
  const old = new Set(hist.filter(h => h.rating > 0 && h.d && h.d < "2010-01-01").map(h => h.k + "|" + h.d));
  const pop = (S.myAct || []).reduce((n, a) => n + Object.keys(a.rx || {}).filter(u => u !== me).length + Math.max(0, a.rn || 0), 0);
  const created = S.profile && S.profile.createdAt;
  return {
    spec: shows.length, crit: hist.filter(h => h.comment && String(h.comment).trim()).length, globe: promos.size, hist: old.size,
    pred: me ? perfectCards(me) : 0, vote: (S.pollVotes || []).filter(v => v.uid === me).length,
    riv: Math.max(0, ...(S.feuds || []).map(f => Math.max(f.best || 0, f.count || 0))), pop: pop,
    idea: (S.ideas || []).filter(i => i.uid === me && i.st === "fait").length,
    found: created && created < FOUNDER_UNTIL ? 1 : 0,
  };
}
// paliers gagnés : ceux du profil (gardés pour toujours) + ceux qui viennent d'être atteints
function earnedOf(uid) {
  const p = (S.user && uid === S.user.uid ? S.profile : prof(uid)) || {}, set = new Set(Object.keys(p.tro || {}));
  if (S.user && uid === S.user.uid) { const v = myValues(); FAM.forEach(f => f.t.forEach((t, i) => { if (v[f.id] >= seuil(f, i)) set.add(tierId(f.id, i)); })); }
  return set;
}
const best = (set, f) => { let b = -1; f.t.forEach((t, i) => { if (set.has(tierId(f.id, i))) b = i; }); return b; };
const slammysOf = uid => (S.slammys || []).filter(x => x.uid === uid);

// ---------- nouveaux trophées : enregistrement, activité, célébration ----------
const awarded = new Set();
let checkT = null;
export function checkTrophies() { clearTimeout(checkT); checkT = setTimeout(runCheck, 2500); }
async function runCheck() {
  if (!S.user || !S.profile) return;
  const me = S.user.uid, have = S.profile.tro || {}, v = myValues(), fresh = [];
  FAM.forEach(f => f.t.forEach((t, i) => { const id = tierId(f.id, i); if (v[f.id] >= seuil(f, i) && !have[id] && !awarded.has(id)) fresh.push(id); }));
  if (!fresh.length) return;
  fresh.forEach(id => awarded.add(id));
  const map = {}; fresh.forEach(id => { map[id] = parisDay(); });
  try { await B.addTrophies(me, map); } catch (e) { return; }
  // dans l'activité : seulement le plus haut palier gagné de chaque famille
  const top = {}; fresh.forEach(id => { const x = nameOfTier(id); if (!top[x.f.id] || top[x.f.id].i < x.i) top[x.f.id] = { id: id, i: x.i, n: x.n, fn: x.f.n }; });
  Object.keys(top).forEach(fid => { const x = top[fid]; B.setActivity(me + "_t_" + x.id, { uid: me, kind: "trophy", k: "", show: "", d: "", title: x.n.slice(0, 150), rating: 0, comment: "", w: x.id, name: x.fn.slice(0, 60) }).catch(() => {}); });
  celebrate(fresh);
}
function celebrate(ids) {
  try { ding(); } catch (e) {}
  modal((box, close) => {
    box.innerHTML = '<div class="trowin">' + (ids.length === 1 ? "" : '<p class="sub">' + ids.length + " nouveaux trophées</p>") +
      ids.map(id => { const x = nameOfTier(id); return '<div class="trowin-it">' + trophyIcon(x.f.id, x.i, ids.length === 1 ? 110 : 56) + "<b>" + esc(x.n) + "</b><small>" + esc(x.f.n) + "</small></div>"; }).join("") +
      '</div><h3 style="margin-top:6px">' + (ids.length === 1 ? "Nouveau trophée !" : "Bravo !") + '</h3><a class="btn wide" href="#/trophees" data-close>Voir mes trophées</a><button class="btn wide ghost" style="margin-top:10px" data-close>Fermer</button>';
    box.addEventListener("click", ev => { if (ev.target.closest("[data-close]")) close(); });
  });
}

// ---------- page des trophées (#/trophees, #/trophees/<uid>) ----------
export function trophiesView(uid) {
  const me = S.user && (!uid || uid === S.user.uid); uid = uid || (S.user ? S.user.uid : "");
  const p = me ? S.profile : prof(uid); if (!p) { need(uid); return '<p class="empty">Chargement…</p>'; }
  const set = earnedOf(uid), v = me ? myValues() : null, tro = p.tro || {}, sl = slammysOf(uid);
  const total = FAM.reduce((n, f) => n + f.t.length, 0);
  let h = '<a class="back" href="javascript:history.back()">' + ICON.back + " Retour</a><h1>" + (me ? "Mes trophées" : "Trophées de " + esc(p.pseudo || "Membre")) + "</h1>" +
    '<p class="note small">' + set.size + " palier" + (set.size > 1 ? "s" : "") + " sur " + total + (sl.length ? " · " + sl.length + " Slammy" : "") + (me ? " · ils se gagnent tout seuls en utilisant l’app." : "") + "</p>";
  if (sl.length) h += '<div class="trofam slam"><div class="trohead">' + slammyIcon(48) + '<div><b>Le Slammy</b><small>Trophée spécial remis par l’admin</small></div></div><div class="trotiers">' +
    sl.map(x => '<div class="trotier on">' + slammyIcon(34) + "<small>" + esc(x.n) + "</small>" + (S.isAdmin ? '<button class="linkbtn danger" data-act="slammydel" data-id="' + esc(x.id) + '">Retirer</button>' : "") + "</div>").join("") + "</div></div>";
  h += '<div class="trofams">' + FAM.map(f => {
    const b = best(set, f), next = f.t.findIndex((t, i) => !set.has(tierId(f.id, i)));
    let prog = "";
    if (me && next >= 0) { const goal = seuil(f, next), cur = Math.min(v[f.id], goal); prog = '<div class="trobar"><span style="width:' + Math.round(cur * 100 / goal) + '%"></span></div><small class="tronext">' + cur + "/" + goal + " " + esc(f.what) + " · vers <b>" + esc(f.t[next][1]) + "</b></small>"; }
    else if (me) prog = '<small class="tronext">🏁 Tous les paliers gagnés</small>';
    return '<div class="trofam' + (b < 0 ? " none" : "") + '"><div class="trohead">' + (b >= 0 ? trophyIcon(f.id, b, 48) : trophyIcon(f.id, 0, 48, true)) + "<div><b>" + esc(f.n) + "</b><small>" + (b >= 0 ? esc(f.t[b][1]) : "Pas encore gagné") + "</small></div></div>" + prog +
      '<div class="trotiers">' + f.t.map((t, i) => { const on = set.has(tierId(f.id, i)); return '<div class="trotier' + (on ? " on" : "") + '">' + trophyIcon(f.id, i, 34, !on) + "<small>" + esc(t[1]) + "</small><em>" + (f.id === "found" ? "avant déc. 2026" : f.id === "pred" ? "100 %" : seuil(f, i)) + (on && tro[tierId(f.id, i)] ? " · " + esc(fmt(tro[tierId(f.id, i)])) : "") + "</em></div>"; }).join("") + "</div></div>";
  }).join("") + "</div>";
  return h;
}
// Vitrine du profil : le plus haut palier de chaque famille gagnée
export function showcase(uid) {
  const set = earnedOf(uid), sl = slammysOf(uid), items = [];
  sl.forEach(x => items.push(slammyIcon(44) + "<small>Slammy · " + esc(x.n) + "</small>"));
  FAM.forEach(f => { const b = best(set, f); if (b >= 0) items.push(trophyIcon(f.id, b, 44) + "<small>" + esc(f.t[b][1]) + "</small>"); });
  const me = S.user && uid === S.user.uid;
  return '<h2>🏆 Vitrine <a class="linkbtn" style="font-size:13px;text-decoration:none" href="#/trophees' + (me ? "" : "/" + encodeURIComponent(uid)) + '">' + (me ? "Ma progression ›" : "Tout voir ›") + "</a></h2>" +
    (items.length ? '<a class="vitrine" href="#/trophees' + (me ? "" : "/" + encodeURIComponent(uid)) + '">' + items.map(x => '<span class="vit">' + x + "</span>").join("") + "</a>"
      : '<p class="note">' + (me ? "Pas encore de trophée. Marque des shows comme vus, note, vote et pronostique pour en gagner !" : "Pas encore de trophée.") + "</p>");
}
// ligne d'activité « a gagné le trophée … »
export function trophyActivity(a) {
  const x = nameOfTier(a.w || "");
  return { txt: "a gagné le trophée " + (x ? trophyIcon(x.f.id, x.i, 20) : "🏆") + " <b>" + esc(a.title) + "</b> (" + esc(a.name) + ")", href: "#/trophees/" + encodeURIComponent(a.uid) };
}

// ---------- Slammy (admin) ----------
ACT.tro = () => { location.hash = S.user ? "#/trophees" : "#/connexion"; };
ACT.slammygive = el => {
  const uid = el.dataset.uid; if (!S.isAdmin || !uid) return;
  modal((box, close) => {
    box.innerHTML = '<div style="text-align:center">' + slammyIcon(72) + "</div><h3>Slammy pour " + esc(nameOf(uid)) + '</h3><label class="fld">Nom du Slammy<input id="slamn" maxlength="60" placeholder="Ex. : Membre du mois d’octobre"></label>' +
      '<button class="btn wide" data-ok>Remettre le Slammy</button><button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button>';
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-no]")) return close();
      if (!e.target.closest("[data-ok]")) return;
      const n = box.querySelector("#slamn").value.trim(); if (!n) { toast("Donne un nom au Slammy"); return; }
      close();
      try {
        const ref = await B.giveSlammy(uid, n), sid = (ref && ref.id) || Date.now().toString(36);
        B.setActivity(S.user.uid + "_s_" + sid, { uid: S.user.uid, kind: "slammy", k: "", show: "", d: "", title: n.slice(0, 150), rating: 0, comment: "", w: uid.slice(0, 80), name: nameOf(uid).slice(0, 60) }).catch(() => {});
        if (uid !== S.user.uid) B.pushNotif(uid, "slammy_" + sid, { type: "slammy", from: S.user.uid, name: n.slice(0, 60), text: "" }).catch(() => {});
        toast("Slammy remis ✓");
      } catch (err) { toast(errText(err)); }
    });
  });
};
ACT.slammydel = async el => { if (!S.isAdmin) return; try { await B.deleteSlammy(el.dataset.id); toast("Slammy retiré"); } catch (e) { toast(errText(e)); } };
