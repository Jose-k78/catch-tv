// Sondages : ceux préparés chaque jour par la mise à jour (data/polls.json) et ceux créés par l'admin.
// Un vote par membre (modifiable tant que le sondage est ouvert), résultats en %, réponses libres « Autre » regroupées.
import { S, B, ACT, FORM, changed } from "../state.js";
import { esc, ICON, fmt, toast, modal } from "../util.js";
import { parisDay } from "../time.js";
import { norm } from "../wrestlers.js";
import { errText } from "./account.js";

const okPoll = p => p && p.id && p.q && Array.isArray(p.opts);
export const isOpen = p => !p.closed && (!p.end || p.end >= parisDay());
// sondages du dépôt + ceux de l'admin (un document admin portant le même id remplace celui du dépôt : clôture, suppression)
export function allPolls() {
  const m = {};
  (S.polls || []).forEach(p => { if (okPoll(p)) m[p.id] = Object.assign({ src: "maj" }, p); });
  (S.fsPolls || []).forEach(p => { if (p && p.id) m[p.id] = Object.assign({}, m[p.id] || { src: "admin" }, p); });
  return Object.keys(m).map(k => m[k]).filter(p => okPoll(p) && !p.del)
    .sort((a, b) => (isOpen(b) - isOpen(a)) || String(b.d || "").localeCompare(String(a.d || "")) || (b.at || 0) - (a.at || 0));
}
const votesOf = id => (S.pollVotes || []).filter(v => v.poll === id && S.blocks.indexOf(v.uid) < 0);
const myVote = id => S.user ? (S.pollVotes || []).find(v => v.poll === id && v.uid === S.user.uid) : null;

// Résultats : chaque option, puis les réponses « Autre » regroupées (même nom à la casse et aux accents près)
export function tally(p) {
  const vs = votesOf(p.id), opts = p.opts.map(t => ({ t: t, n: 0 })), other = {};
  vs.forEach(v => {
    if (v.c >= 0 && v.c < opts.length) { opts[v.c].n++; return; }
    const o = String(v.o || "").trim(); if (!o) return;
    const hit = opts.findIndex(x => norm(x.t) === norm(o));
    if (hit >= 0) { opts[hit].n++; return; }
    const k = norm(o).replace(/\s+/g, " ");
    (other[k] = other[k] || { t: o, n: 0 }).n++;
  });
  return { total: vs.length, opts: opts, other: Object.keys(other).map(k => other[k]).sort((a, b) => b.n - a.n) };
}
const pct = (n, tot) => tot ? Math.round(n * 100 / tot) : 0;
const bar = (label, n, tot, mine, lead) => '<div class="pbar' + (mine ? " mine" : "") + (lead ? " lead" : "") + '"><span class="pfill" style="width:' + pct(n, tot) + '%"></span>' +
  '<span class="plbl">' + esc(label) + (mine ? " ✓" : "") + '</span><span class="ppc">' + pct(n, tot) + " %</span></div>";

function pollCard(p) {
  const open = isOpen(p), mv = myVote(p.id), r = tally(p), showRes = !!mv || !open;
  const max = Math.max.apply(null, r.opts.map(x => x.n).concat(r.other.map(x => x.n), [0]));
  const tag = p.type === "babies" ? "👑 Babies du mois" : p.type === "match" ? "🥊 Dream match" : "";
  let h = '<div class="poll' + (open ? "" : " closed") + (p.type ? " t-" + esc(p.type) : "") + '" id="poll-' + esc(p.id) + '"><small class="eyebrow">' + esc([tag, p.k, open ? (p.end ? "jusqu’au " + fmt(p.end) : "ouvert") : "terminé"].filter(Boolean).join(" · ")) + "</small><b class=\"pq\">" + esc(p.q) + "</b>";
  if (!showRes || (open && mv && mv.edit)) {
    h += '<div class="popts">' + p.opts.map((t, i) => '<button class="popt" data-act="pvote" data-p="' + esc(p.id) + '" data-c="' + i + '">' + esc(t) + "</button>").join("") + "</div>";
    if (p.other) h += '<form class="pother" data-form="pother" data-p="' + esc(p.id) + '"><input name="o" maxlength="40" autocomplete="off" placeholder="Autre : …" aria-label="Autre réponse"><button class="btn small">Voter</button></form>';
  } else {
    h += '<div class="pres">' + r.opts.map((x, i) => bar(x.t, x.n, r.total, mv && mv.c === i, x.n && x.n === max)).join("") +
      r.other.slice(0, 6).map(x => bar(x.t, x.n, r.total, mv && mv.c < 0 && norm(mv.o) === norm(x.t), x.n === max)).join("") + "</div>" +
      (r.other.length > 6 ? '<small class="note small">+ ' + (r.other.length - 6) + " autre" + (r.other.length - 6 > 1 ? "s" : "") + " réponse" + (r.other.length - 6 > 1 ? "s" : "") + "</small>" : "");
  }
  h += '<div class="pfoot"><small>' + r.total + " vote" + (r.total > 1 ? "s" : "") + "</small>" +
    (open && mv && !mv.edit ? '<button class="linkbtn" data-act="pedit" data-p="' + esc(p.id) + '">Changer mon vote</button>' : "") +
    (!S.user && open ? '<a class="linkbtn" href="#/connexion">Connecte-toi pour voter</a>' : "") +
    (S.isAdmin ? '<span class="padm">' + (open ? '<button class="linkbtn" data-act="pclose" data-p="' + esc(p.id) + '">Clore</button>' : "") +
      '<button class="linkbtn danger" data-act="pdel" data-p="' + esc(p.id) + '">Supprimer</button></span>' : "") + "</div></div>";
  return h;
}

export function pollsView() {
  const all = allPolls(), open = all.filter(isOpen), done = all.filter(p => !isOpen(p)).slice(0, 15);
  let h = '<a class="back" href="#/">' + ICON.back + " Accueil</a><h1>Sondages</h1>" +
    '<p class="note small">De nouveaux sondages arrivent avec l’actu du jour. Un vote par membre, tu peux le changer tant que le sondage est ouvert.</p>';
  if (S.isAdmin) h += '<button class="btn small" data-act="pnew" style="margin:6px 16px 12px">＋ Créer un sondage</button>';
  h += open.length ? '<div class="polls">' + open.map(pollCard).join("") + "</div>" : '<p class="note">Pas de sondage ouvert pour l’instant.</p>';
  h += babiesSection();
  if (done.length) h += "<h2>Terminés</h2><div class=\"polls\">" + done.map(pollCard).join("") + "</div>";
  return h;
}

// ---------- Babies du mois : classement des catcheuses qui ont reçu le plus de votes dans les sondages « babies » du mois ----------
const MOIS_L = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const monthLabel = m => { const n = MOIS_L[+m.slice(5, 7) - 1] || ""; return (/^[aeiouyéè]/.test(n) ? "d’" : "de ") + n; };
const prevMonth = m => { let y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1; if (!mo) { mo = 12; y--; } return y + "-" + String(mo).padStart(2, "0"); };
export function babiesRanking(month) {
  const tot = {};
  allPolls().filter(p => p.type === "babies" && String(p.d || "").slice(0, 7) === month).forEach(p => {
    votesOf(p.id).forEach(v => {
      const name = v.c >= 0 && v.c < p.opts.length ? p.opts[v.c] : String(v.o || "").trim(); if (!name) return;
      const k = norm(name).replace(/\s+/g, " "); (tot[k] = tot[k] || { n: name, v: 0 }).v++;
    });
  });
  return Object.keys(tot).map(k => tot[k]).sort((a, b) => b.v - a.v);
}
// gagnante du mois dernier, annoncée les 3 premiers jours du mois
export function babiesLast() {
  const day = parisDay(); if (+day.slice(8, 10) > 3) return null;
  const pm = prevMonth(day.slice(0, 7)), h = (S.hof || {})[pm], r = h && h.n ? h : babiesRanking(pm)[0];
  return r && r.n ? { label: monthLabel(pm), n: r.n } : null;
}
function babiesSection() {
  const m = parisDay().slice(0, 7), rk = babiesRanking(m), hof = S.hof || {};
  const arch = Object.keys(hof).filter(k => k < m && hof[k] && hof[k].n).sort().reverse().slice(0, 12);
  if (!rk.length && !arch.length && !allPolls().some(p => p.type === "babies")) return "";
  let h = "<h2>👑 Babies du mois " + esc(monthLabel(m)) + "</h2>";
  h += rk.length ? '<div class="board">' + rk.slice(0, 10).map((x, i) => '<div class="brow"><span class="brk">' + (i < 3 ? ["👑", "🥈", "🥉"][i] : i + 1) + "</span><b>" + esc(x.n) + '</b><span class="bpts">' + x.v + " vote" + (x.v > 1 ? "s" : "") + "</span></div>").join("") + "</div>"
    : '<p class="note">Le classement se remplit avec les votes des sondages « babies » du mois.</p>';
  if (arch.length) h += '<p class="note small" style="margin-top:8px">Les gagnantes : ' + arch.map(k => "<b>" + esc(hof[k].n) + "</b> (" + esc(MOIS_L[+k.slice(5, 7) - 1]) + " " + k.slice(0, 4) + ")").join(" · ") + "</p>";
  return h;
}
// L'admin enregistre la gagnante du mois écoulé (une fois), avec une annonce dans l'activité
let hofBusy = false;
export async function syncBabies() {
  if (!S.isAdmin || hofBusy || !S.hofReady) return;
  const pm = prevMonth(parisDay().slice(0, 7)); if ((S.hof || {})[pm]) return;
  const top = babiesRanking(pm)[0]; if (!top) return;
  hofBusy = true;
  try {
    await B.setHofMonth(pm, { n: top.n.slice(0, 60), v: top.v });
    B.setActivity(S.user.uid + "_b_" + pm, { uid: S.user.uid, kind: "babies", k: "", show: "", d: pm + "-01", title: top.n.slice(0, 150), rating: 0, comment: "", w: "", name: monthLabel(pm).slice(0, 60) }).catch(() => {});
  } catch (e) {} finally { hofBusy = false; }
}
// Tuile de l'accueil : le premier sondage ouvert auquel je n'ai pas encore répondu
export function pollTile() {
  const open = allPolls().filter(isOpen); if (!open.length) return "";
  const todo = open.filter(p => !myVote(p.id)), p = todo[0] || open[0];
  return '<a class="playtile poll-t" href="#/sondages"><span class="eyebrow">📊 SONDAGE' + (open.length > 1 ? "S · " + open.length + " OUVERTS" : "") + "</span><b>" + esc(p.q) + "</b>" +
    '<span class="discgo">' + (S.user && !todo.length ? "Voir les résultats ›" : "Voter ›") + "</span></a>";
}

// ---------- votes ----------
function find(id) { return allPolls().find(p => p.id === id); }
async function vote(id, c, o) {
  if (!S.user) { toast("Connecte-toi pour voter"); location.hash = "#/connexion"; return; }
  const p = find(id); if (!p || !isOpen(p)) { toast("Ce sondage est terminé"); return; }
  const mv = myVote(id); if (mv) delete mv.edit;
  try { await B.votePoll(id, S.user.uid, c, o || ""); toast("A voté ✓"); }
  catch (e) { toast(errText(e)); }
}
ACT.pvote = el => vote(el.dataset.p, Number(el.dataset.c), "");
FORM.pother = f => { const o = f.o.value.trim().replace(/\s+/g, " "); if (o.length < 2) { toast("Écris ta réponse"); return; } vote(f.dataset.p, -1, o.slice(0, 40)); };
ACT.pedit = el => { const mv = myVote(el.dataset.p); if (mv) { mv.edit = true; changed("pollVotes"); } };

// ---------- admin ----------
ACT.pclose = async el => {
  const p = find(el.dataset.p); if (!p || !S.isAdmin) return;
  try { await B.savePoll(p.id, strip(Object.assign({}, p, { closed: true }))); toast("Sondage clos"); } catch (e) { toast(errText(e)); }
};
ACT.pdel = el => {
  const p = find(el.dataset.p); if (!p || !S.isAdmin) return;
  modal((box, close) => {
    box.innerHTML = "<h3>Supprimer ce sondage ?</h3><p class=\"sub\">" + esc(p.q) + '</p><button class="btn wide danger" data-ok>Supprimer</button><button class="btn wide ghost" data-close>Annuler</button>';
    box.addEventListener("click", async ev => {
      if (ev.target.closest("[data-close]")) return close();
      if (!ev.target.closest("[data-ok]")) return;
      close();
      // un sondage de la mise à jour reste dans data/polls.json : on le masque avec un document « del »
      try { if (p.src === "maj") await B.savePoll(p.id, strip(Object.assign({}, p, { del: true }))); else await B.deletePoll(p.id); toast("Sondage supprimé"); } catch (e) { toast(errText(e)); }
    });
  });
};
const strip = p => ({ q: String(p.q).slice(0, 200), k: p.k || "", d: p.d || parisDay(), opts: p.opts.slice(0, 4).map(x => String(x).slice(0, 80)), other: !!p.other, end: p.end || "", closed: !!p.closed, del: !!p.del, type: ["match", "babies"].indexOf(p.type) >= 0 ? p.type : "" });
ACT.pnew = () => {
  if (!S.isAdmin) return;
  modal((box, close) => {
    box.innerHTML = '<h3>Nouveau sondage</h3><form class="pform" data-pform><label>Question<input name="q" maxlength="200" required placeholder="Qui va gagner le Royal Rumble ?"></label>' +
      '<label>Choix 1<input name="o0" maxlength="80" required></label><label>Choix 2<input name="o1" maxlength="80" required></label><label>Choix 3 (facultatif)<input name="o2" maxlength="80"></label>' +
      '<label class="chk"><input type="checkbox" name="other" checked> Ajouter une case « Autre : … » à remplir</label>' +
      '<label>Type<select name="type"><option value="">Sondage classique</option><option value="match">🥊 Dream match (qui gagne ?)</option><option value="babies">👑 Babies du mois</option></select></label>' +
      '<label>Promotion<select name="k"><option value="">Toutes</option>' + Object.keys(S.P).map(k => "<option>" + esc(k) + "</option>").join("") + "</select></label>" +
      '<label>Fin du vote (facultatif)<input type="date" name="end"></label><button class="btn wide">Publier</button></form><button class="btn wide ghost" data-close>Annuler</button>';
    box.addEventListener("click", ev => { if (ev.target.closest("[data-close]")) close(); });
    box.querySelector("[data-pform]").addEventListener("submit", async ev => {
      ev.preventDefault();
      const f = ev.target, opts = [f.o0.value, f.o1.value, f.o2.value].map(x => x.trim()).filter(Boolean);
      if (!f.q.value.trim() || opts.length < 2) { toast("Une question et au moins 2 choix"); return; }
      try { await B.savePoll("a-" + Date.now().toString(36), strip({ q: f.q.value.trim(), opts: opts, other: f.other.checked, k: f.k.value, end: f.end.value, type: f.type.value })); close(); toast("Sondage publié ✓"); }
      catch (e) { toast(errText(e)); }
    });
  });
};
