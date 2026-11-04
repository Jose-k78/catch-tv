// Babies du mois en tournoi (bracket de 8 catcheuses) — demande de Jose, 4 nov.
// Le modérateur choisit les 8 noms du mois (document Firestore polls/bk-AAAA-MM, type « bracket », opts = 8 noms, d = 1er jour).
// 7 duels : quarts (0-3), demies (4-5), finale (6). Un nouveau duel s'ouvre chaque jour ; un duel est gagné dès qu'une
// catcheuse atteint 3 votes (peu importe le temps). Les votes vont dans pollvotes (poll = bk-AAAA-MM-mN, c = 0 ou 1),
// sans changement des règles Firestore. Un vote n'est pas modifiable (le premier à 3 votes gagne).
// Fin du mois sans finale gagnée → « Pas de babies désignée » dans la liste des gagnantes.
import { S, B, ACT, prof, need } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { parisDay } from "../time.js";
import { face, faceImg } from "../photos.js";
import { linkNames } from "../wrestlers.js";
import { errText } from "./account.js";

export const NOBABY = "Pas de babies désignée";
export const WIN = 3;
const ROUND = ["Quart de finale", "Quart de finale", "Quart de finale", "Quart de finale", "Demi-finale", "Demi-finale", "Finale"];
export const bkId = m => "bk-" + m;
// catcheuses de la base de données (rosters féminins : AEW, ROH, AAA, TNA Knockouts, CMLL Amazonas, Stardom, Marigold)
const FEM = /f[ée]minin|knockouts|amazonas/i;
export function femalePool() {
  const out = new Set();
  Object.keys(S.rosters || {}).forEach(k => { const r = S.rosters[k] || {}; Object.keys(r).forEach(g => { if (FEM.test(g) || k === "Stardom" || k === "Marigold") (r[g] || []).forEach(n => { if (n && !/\(/.test(n)) out.add(n); }); }); });
  return Array.from(out).sort();
}
// 8 noms tirés au hasard (toujours les mêmes pour un mois donné : tout le monde voit le même tableau)
export function randomEight(seedTxt) {
  const pool = femalePool(); let seed = 0; String(seedTxt).split("").forEach(ch => { seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; });
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const a = pool.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, 8);
}
export function bracketCfg(m) {
  const p = (S.fsPolls || []).find(x => x && x.id === bkId(m) && !x.del);
  if (p && Array.isArray(p.opts) && p.opts.length === 8) return p;
  // sans choix du modo : 8 catcheuses au hasard dans la base de données, tournoi lancé le 1er du mois
  const auto = randomEight("babies-" + m);
  return auto.length === 8 ? { id: bkId(m), opts: auto, d: m + "-01", auto: true } : null;
}
const dayIdx = (start, day) => Math.round((Date.parse(day + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) / 864e5);
const votesOf = id => (S.pollVotes || []).filter(v => v.poll === id && (v.c === 0 || v.c === 1) && (S.blocks || []).indexOf(v.uid) < 0).sort((a, b) => (a.at || 0) - (b.at || 0));

// état du tournoi : 7 duels { i, id, a, b, n: [votes a, votes b], w (0/1 ou -1), open, day }
export function bracketOf(cfg, today) {
  today = today || parisDay();
  const start = cfg.d || (cfg.id.slice(3) + "-01"), di = dayIdx(start, today), out = [];
  for (let i = 0; i < 7; i++) {
    let a, b;
    if (i < 4) { a = cfg.opts[2 * i]; b = cfg.opts[2 * i + 1]; }
    else { const f = i === 6 ? [4, 5] : i === 4 ? [0, 1] : [2, 3]; a = winnerName(out[f[0]]); b = winnerName(out[f[1]]); }
    const id = cfg.id + "-m" + i, vs = votesOf(id), n = [0, 0];
    let w = -1;
    vs.forEach(v => { if (w >= 0) return; n[v.c]++; if (n[v.c] >= WIN) w = v.c; });
    if (w >= 0) { n[0] = 0; n[1] = 0; vs.forEach(v => n[v.c]++); }
    out.push({ i: i, id: id, a: a, b: b, n: n, w: w, votes: vs, open: !!(a && b) && w < 0 && di >= i, day: i });
  }
  return out;
}
const winnerName = m => (m && m.w >= 0 ? (m.w === 0 ? m.a : m.b) : "");
export function bracketWinner(cfg) { const b = bracketOf(cfg); return winnerName(b[6]); }

function duel(m, mine) {
  const who = m.votes.map(v => { need(v.uid); const p = prof(v.uid); return esc((p && p.pseudo) || "Membre") + " → " + esc(v.c === 0 ? m.a : m.b); });
  const side = (name, c) => '<button class="bkside' + (m.w === c ? " win" : m.w >= 0 ? " out" : "") + (mine && mine.c === c ? " mine" : "") + '"' +
    (m.open && !mine ? ' data-act="bkvote" data-p="' + esc(m.id) + '" data-c="' + c + '"' : " disabled") + ">" +
    (name ? (face(name, 56) || '<span class="wnone big">?</span>') + "<b>" + esc(name) + "</b><small>" + m.n[c] + " / " + WIN + "</small>" : '<span class="wnone big">?</span><b>À venir</b>') + "</button>";
  return '<div class="bkduel' + (m.open ? " open" : "") + '"><small class="eyebrow">' + ROUND[m.i] + (m.open ? " · ouvert" : m.w >= 0 ? " · terminé" : "") + "</small>" +
    '<div class="bkvs">' + side(m.a, 0) + '<span class="wvsx">VS</span>' + side(m.b, 1) + "</div>" +
    (m.open && !S.user ? '<a class="linkbtn" href="#/connexion">Connecte-toi pour voter</a>' : "") +
    (who.length ? '<details class="bkwho"><summary>Qui a voté quoi (' + who.length + ")</summary><p>" + who.join("<br>") + "</p></details>" : "") + "</div>";
}

// rubrique de la page Sondages
export function bracketSection(m, monthLabel) {
  const cfg = bracketCfg(m);
  let h = "<h2>👑 Babies du mois " + esc(monthLabel(m)) + "</h2>";
  if (!cfg) return h + '<p class="note">Le tournoi du mois n’est pas encore prêt' + (S.isAdmin ? "." : " : il arrive bientôt.") + "</p>" +
    (S.isAdmin ? '<button class="btn small" data-act="bknew" style="margin:6px 16px">Préparer le tournoi (8 catcheuses)</button>' : "");
  const b = bracketOf(cfg), win = winnerName(b[6]);
  const my = id => S.user ? (S.pollVotes || []).find(v => v.poll === id && v.uid === S.user.uid) : null;
  h += '<p class="note small">8 catcheuses, un nouveau duel chaque jour. La première à ' + WIN + " votes passe au tour suivant.</p>";
  if (win) h += '<div class="bkchamp">' + (face(win, 80) || "") + "<span>👑 Babies du mois</span><b>" + linkNames(win) + "</b></div>";
  const open = b.filter(x => x.open);
  if (open.length) h += '<div class="bkopen">' + open.map(x => duel(x, my(x.id))).join("") + "</div>";
  // tableau complet
  const col = (list, t) => '<div class="bkcol"><small>' + t + "</small>" + list.map(x => '<div class="bkmini' + (x.open ? " open" : "") + '">' +
    [0, 1].map(c => { const n = c ? x.b : x.a; return '<span class="' + (x.w === c ? "win" : x.w >= 0 ? "out" : "") + '">' + (n ? faceImg(n, 18) + esc(n) : "?") + "<i>" + x.n[c] + "</i></span>"; }).join("") + "</div>").join("") + "</div>";
  h += '<div class="bktree">' + col(b.slice(0, 4), "Quarts") + col(b.slice(4, 6), "Demies") + col(b.slice(6), "Finale") + "</div>";
  const done = b.filter(x => !x.open && x.w >= 0);
  if (done.length) h += '<details class="bkpast"><summary>Les duels terminés</summary>' + done.map(x => duel(x, my(x.id))).join("") + "</details>";
  if (cfg.auto) h += '<p class="note small">Les 8 catcheuses sont tirées au hasard dans la base de données de l’app.</p>';
  if (S.isAdmin) h += '<button class="linkbtn" data-act="bknew" style="margin:6px 16px">Changer les catcheuses du tournoi</button>';
  return h;
}

ACT.bkvote = async el => {
  if (!S.user) { toast("Connecte-toi pour voter"); location.hash = "#/connexion"; return; }
  const id = el.dataset.p;
  if ((S.pollVotes || []).some(v => v.poll === id && v.uid === S.user.uid)) { toast("Tu as déjà voté pour ce duel"); return; }
  try { await B.votePoll(id, S.user.uid, Number(el.dataset.c), ""); toast("A voté ✓"); } catch (e) { toast(errText(e)); }
};
ACT.bknew = () => {
  if (!S.isAdmin) return;
  const m = parisDay().slice(0, 7), cur = bracketCfg(m), names = cur ? cur.opts : [];
  modal((box, close) => {
    box.innerHTML = "<h3>Tournoi Babies du mois</h3><p class=\"sub\">Les 8 catcheuses, dans l’ordre du tableau (1 contre 2, 3 contre 4…).</p><form data-bkf>" +
      '<button type="button" class="btn small ghost" data-rnd style="margin-bottom:8px">🎲 Tirer 8 catcheuses au hasard</button>' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(i => '<label>Catcheuse ' + (i + 1) + '<input name="n' + i + '" maxlength="60" required value="' + esc(names[i] || "") + '"></label>').join("") +
      '<button class="btn wide">Lancer le tournoi</button></form><button class="btn wide ghost" data-close>Annuler</button>';
    box.addEventListener("click", ev => {
      if (ev.target.closest("[data-close]")) close();
      if (ev.target.closest("[data-rnd]")) { const r = randomEight("x" + Date.now()); r.forEach((n, i) => { box.querySelector("[name=n" + i + "]").value = n; }); }
    });
    box.querySelector("[data-bkf]").addEventListener("submit", async ev => {
      ev.preventDefault();
      const f = ev.target, opts = [0, 1, 2, 3, 4, 5, 6, 7].map(i => f["n" + i].value.trim().replace(/\s+/g, " ")).filter(Boolean);
      if (opts.length !== 8) { toast("Il faut 8 noms"); return; }
      try { await B.savePoll(bkId(m), { q: "Babies du mois", k: "", d: cur && !cur.auto && cur.d || parisDay(), opts: opts, other: false, end: "", closed: false, del: false, type: "bracket" }); close(); toast("Tournoi lancé ✓"); }
      catch (e) { toast(errText(e)); }
    });
  });
};
