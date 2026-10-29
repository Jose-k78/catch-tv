// Pronostics : sur les matchs officiellement annoncés d'un PLE, chacun choisit son vainqueur avant le début du show.
// Après le show, les résultats (data/highlights.json) donnent 1 point par bon pronostic -> classement des membres.
import { S, B, ACT, avatar, prof, nameOf, need } from "../state.js";
import { esc, ICON, fmt, toast, docId, okDay } from "../util.js";
import { startOf, zoned, PARIS, whenParts } from "../time.js";
import { allPle } from "./catalog.js";
import { hlOf } from "./highlights.js";
import { resultWinner, sideNames } from "./mrate.js";
import { norm } from "../wrestlers.js";
import { errText } from "./account.js";

// « Titre de NXT : Grayson Waller contre Tony D’Angelo » -> { label: "Titre de NXT", sides: ["Grayson Waller", "Tony D’Angelo"] }
export function sidesOf(line) {
  let s = String(line || ""), label = "";
  const c = s.indexOf(" : ") >= 0 ? s.indexOf(" : ") : s.indexOf(": ");
  if (c > 0 && c < 90 && / contre | vs\.? /i.test(s.slice(c))) { label = s.slice(0, c).trim(); s = s.slice(c + 2); }
  const parts = s.replace(/\s*\(c\)/gi, "").split(/\s+contre\s+|\s+vs\.?\s+/i).map(x => x.replace(/\s*\((?:[^()]*)\)\s*$/, "").replace(/[.\s]+$/, "").trim()).filter(Boolean);
  return parts.length >= 2 && parts.length <= 6 ? { label: label, sides: parts } : null;
}
const hash = s => { let h = 5381; s = norm(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return "m" + (h >>> 0).toString(36); };
// Heure de fermeture : le début du show (minuit à Paris le jour J si l'heure n'est pas connue)
export const lockAt = e => startOf(e) || zoned(e.d, "00:00", PARIS);
const locked = e => !okDay(e.d) || Date.now() >= lockAt(e);
const lines = e => (Array.isArray(e.card) && okDay(e.d) ? e.card : []).map(l => { const s = sidesOf(l); return s ? Object.assign({ id: hash(l), line: l }, s) : null; }).filter(Boolean);
export const pickable = e => !!e && lines(e).length > 0 && !locked(e);
const evOf = (k, d) => allPle().find(e => e.k === k && e.d === d);
const pickId = (uid, k, d) => docId(uid + "_" + k + "_" + d);
const picksOf = (k, d) => (S.picks || []).filter(p => p.k === k && p.d === d && S.blocks.indexOf(p.uid) < 0);
const myPick = (k, d) => S.user ? (S.picks || []).find(p => p.uid === S.user.uid && p.k === k && p.d === d) : null;

// ---------- résultats ----------
const clean = s => norm(s).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// noms d'un camp, y compris ceux entre parenthèses (« Knockout Brothers (OSKAR et Yuto-Ice) »)
function names(side) {
  const inner = (String(side).match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1)).join(" et ");
  return sideNames(side).concat(inner ? sideNames(inner) : []).map(clean).filter(x => x.length >= 3);
}
const hits = (side, txt) => { const t = " " + clean(txt) + " "; return names(side).some(n => t.indexOf(" " + n + " ") >= 0); };
// Vainqueur d'un match annoncé d'après les lignes de résultats : index du camp gagnant, "draw", ou -1 (pas encore connu)
function winnerOf(m, res) {
  for (const r of res || []) {
    const w = resultWinner(r); if (!w) continue;
    if (w.draw) { if (m.sides.filter(s => hits(s, r)).length >= 2) return "draw"; continue; }
    const wi = m.sides.findIndex(s => hits(s, w.w));
    if (wi >= 0 && m.sides.some((s, i) => i !== wi && hits(s, w.l))) return wi;
  }
  return -1;
}
// Résultats d'un PLE : { id du match: index gagnant | "draw" }
function results(e) {
  const h = hlOf(e.k, "PLE", e.d), out = {};
  if (!h || !Array.isArray(h.res)) return out;
  lines(e).forEach(m => { const w = winnerOf(m, h.res); if (w !== -1) out[m.id] = w; });
  return out;
}
// Score d'un membre sur un PLE : bons pronostics / pronostics sur des matchs dont le résultat est connu
function scoreOf(p, e, res) {
  let ok = 0, n = 0;
  lines(e).forEach(m => {
    const mine = p.p && p.p[m.id], w = res[m.id];
    if (mine == null || w == null) return;
    n++; if (w !== "draw" && norm(m.sides[w]) === norm(mine)) ok++;
  });
  return { ok: ok, n: n };
}

// ---------- page d'un PLE ----------
export function pickView(k, d) {
  const e = evOf(k, d);
  let h = '<a class="back" href="#/pronostics">' + ICON.back + " Pronostics</a>";
  if (!e) return h + '<p class="empty">Événement introuvable.</p>';
  const ms = lines(e), lk = locked(e), mine = myPick(k, d), res = results(e), all = picksOf(k, d);
  h += '<section class="pickhead"><span class="eyebrow">🎯 PRONOSTICS · ' + esc(e.k) + "</span><h1>" + esc(e.t) + "</h1><small>" + (whenParts(e) ? esc(whenParts(e).paris) + " à Paris" : esc(fmt(e.d))) + "</small>" +
    '<p class="note small">' + (lk ? (Object.keys(res).length ? "Résultats : 1 point par bon pronostic." : "Pronostics fermés. Les points arrivent avec les résultats.") : "Choisis ton vainqueur pour chaque match. Tu peux changer d’avis jusqu’au début du show.") + "</p></section>";
  if (!ms.length) return h + '<p class="note">La carte n’est pas encore annoncée.</p>';
  if (!S.user) h += '<p class="note"><a class="linkbtn" style="padding:0" href="#/connexion">Connecte-toi</a> pour faire tes pronostics.</p>';
  h += '<div class="picks">' + ms.map(m => {
    const my = mine && mine.p ? mine.p[m.id] : null, w = res[m.id], tot = all.filter(p => p.p && p.p[m.id]).length;
    const showPct = lk || !!my;
    return '<div class="pickm"><small>' + esc(m.label || "Match") + '</small><div class="pside' + (m.sides.length > 2 ? " multi" : "") + '">' + m.sides.map((s, i) => {
      const on = my && norm(my) === norm(s), n = all.filter(p => p.p && p.p[m.id] && norm(p.p[m.id]) === norm(s)).length;
      const st = w == null ? "" : w === i ? " won" : " lost";
      return '<button class="pk' + (on ? " on" : "") + st + '"' + (lk || !S.user ? " disabled" : ' data-act="pickside" data-k="' + esc(k) + '" data-d="' + esc(d) + '" data-m="' + m.id + '" data-s="' + esc(s) + '"') + ">" +
        "<b>" + esc(s) + "</b>" + (showPct && tot ? "<small>" + Math.round(n * 100 / tot) + " %</small>" : "") + (w === i ? "<em>🏆</em>" : "") + (on && w != null ? "<em>" + (w === i ? "✅" : "❌") + "</em>" : "") + "</button>";
    }).join("") + "</div>" + (w === "draw" ? '<small class="note small">Match nul</small>' : "") + "</div>";
  }).join("") + "</div>";
  const other = (e.card || []).filter(l => !sidesOf(l));
  if (other.length) h += '<p class="note small">Aussi au programme : ' + other.map(esc).join(" · ") + "</p>";
  if (mine && Object.keys(res).length) { const sc = scoreOf(mine, e, res); h += '<p class="pickscore">Ton score : <b>' + sc.ok + " / " + sc.n + "</b></p>"; }
  if (lk && all.length) h += "<h2>Classement de ce show</h2>" + board(all.map(p => ({ uid: p.uid, s: scoreOf(p, e, res) })));
  return h;
}
function board(rows) {
  rows = rows.filter(r => r.s.n > 0).sort((a, b) => b.s.ok - a.s.ok || a.s.n - b.s.n);
  if (!rows.length) return '<p class="note">Les points arrivent avec les résultats du show.</p>';
  rows.forEach(r => need(r.uid));
  let rank = 0, prev = null;
  return '<div class="board">' + rows.slice(0, 30).map((r, i) => {
    if (r.s.ok !== prev) { rank = i + 1; prev = r.s.ok; }
    return '<a class="brow' + (S.user && r.uid === S.user.uid ? " me" : "") + '" href="#/profil/' + encodeURIComponent(r.uid) + '"><span class="brk">' + (rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank) + "</span>" + avatar(prof(r.uid), 30) +
      "<b>" + esc(nameOf(r.uid)) + '</b><span class="bpts">' + r.s.ok + " pt" + (r.s.ok > 1 ? "s" : "") + "<small>" + r.s.ok + "/" + r.s.n + "</small></span></a>";
  }).join("") + "</div>";
}

// ---------- page générale ----------
const upcoming = () => allPle().filter(e => lines(e).length && !locked(e)).sort((a, b) => a.d.localeCompare(b.d));
export function picksView() {
  let h = '<a class="back" href="#/">' + ICON.back + " Accueil</a><h1>Pronostics</h1>";
  const up = upcoming();
  h += "<h2>Matchs annoncés</h2>" + (up.length ? '<div class="list">' + up.map(e => {
    const n = lines(e).length, mine = myPick(e.k, e.d), done = mine && mine.p ? lines(e).filter(m => mine.p[m.id]).length : 0;
    return '<a class="item" href="#/pronostic/' + encodeURIComponent(e.k) + "/" + e.d + '"><span class="lbl"><b>' + esc(e.t) + "</b><small>" + esc(e.k) + " · " + fmt(e.d) + " · " + n + " match" + (n > 1 ? "s" : "") + "</small></span>" +
      '<span class="rt">' + (done ? (done === n ? "✅ fait" : done + "/" + n) : "🎯 À faire") + "</span></a>";
  }).join("") + "</div>" : '<p class="note">Aucune carte officielle annoncée pour l’instant. Les matchs apparaissent dès qu’ils sont officialisés.</p>');
  // classement général : tous les PLE dont les résultats sont connus
  const tot = {}, past = allPle().filter(e => locked(e) && lines(e).length);
  past.forEach(e => {
    const res = results(e); if (!Object.keys(res).length) return;
    picksOf(e.k, e.d).forEach(p => { const s = scoreOf(p, e, res), t = tot[p.uid] = tot[p.uid] || { ok: 0, n: 0 }; t.ok += s.ok; t.n += s.n; });
  });
  h += "<h2>Classement général</h2>" + board(Object.keys(tot).map(u => ({ uid: u, s: tot[u] })));
  const mineP = S.user ? past.filter(e => myPick(e.k, e.d)).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 10) : [];
  if (mineP.length) h += "<h2>Mes derniers pronostics</h2><div class=\"list\">" + mineP.map(e => {
    const res = results(e), s = scoreOf(myPick(e.k, e.d), e, res);
    return '<a class="item" href="#/pronostic/' + encodeURIComponent(e.k) + "/" + e.d + '"><span class="lbl"><b>' + esc(e.t) + "</b><small>" + esc(e.k) + " · " + fmt(e.d) + '</small></span><span class="rt">' + (s.n ? s.ok + "/" + s.n : "en attente") + "</span></a>";
  }).join("") + "</div>";
  return h;
}
// Tuile de l'accueil : le prochain PLE dont la carte est annoncée
export function pickTile() {
  const e = upcoming()[0]; if (!e) return "";
  const mine = myPick(e.k, e.d), n = lines(e).length, done = mine && mine.p ? lines(e).filter(m => mine.p[m.id]).length : 0;
  return '<a class="playtile pick-t" href="#/pronostic/' + encodeURIComponent(e.k) + "/" + e.d + '"><span class="eyebrow">🎯 PRONOSTICS</span><b>' + esc(e.t) + "</b><small>" + esc(e.k) + " · " + fmt(e.d) + " · " + n + " match" + (n > 1 ? "s" : "") + "</small>" +
    '<span class="discgo">' + (done === n ? "Pronostic fait ✓" : done ? "Continuer (" + done + "/" + n + ") ›" : "Faire mon pronostic ›") + "</span></a>";
}

// ---------- actions ----------
ACT.pick = el => { location.hash = "#/pronostic/" + encodeURIComponent(el.dataset.k) + "/" + el.dataset.d; };
ACT.pickside = async el => {
  if (!S.user) { location.hash = "#/connexion"; return; }
  const k = el.dataset.k, d = el.dataset.d, e = evOf(k, d);
  if (!e || locked(e)) { toast("Les pronostics sont fermés : le show a commencé"); return; }
  const cur = myPick(k, d), p = Object.assign({}, cur && cur.p ? cur.p : {});
  if (p[el.dataset.m] && norm(p[el.dataset.m]) === norm(el.dataset.s)) delete p[el.dataset.m]; else p[el.dataset.m] = el.dataset.s.slice(0, 120);
  // garde seulement les matchs encore à l'affiche
  const ids = lines(e).map(m => m.id); Object.keys(p).forEach(x => { if (ids.indexOf(x) < 0) delete p[x]; });
  // affichage immédiat, avant la confirmation du serveur
  const id = pickId(S.user.uid, k, d), doc = { id: id, uid: S.user.uid, ev: String(e.t).slice(0, 120), k: k, d: d, t: lockAt(e), p: p };
  S.picks = (S.picks || []).filter(x => x.id !== id).concat([doc]);
  el.closest(".pside").querySelectorAll(".pk").forEach(b => b.classList.toggle("on", b.dataset.s === el.dataset.s && !!p[el.dataset.m]));
  try { await B.setPick(id, { uid: doc.uid, ev: doc.ev, k: k, d: d, t: doc.t, p: p }); } catch (err) { toast(errText(err)); }
};
