// « Je veux voir » (11 nov., demande de Jose) : une liste perso de shows et de combats à regarder.
// Rangée dans l'historique du membre (même format, donc mêmes règles Firestore) : id « w_<id du show ou du combat> »,
// note 0, commentaire « [WANT] » (show) ou « [WANTM] » (combat). Quand le show ou le combat est marqué vu / noté,
// il quitte la liste tout seul. Le lien vers la liste (accueil, profil) n'apparaît que si elle n'est pas vide.
import { S, B, ACT, changed } from "./state.js";
import { esc, toast, docId, okDay, fmt, diff, ICON } from "./util.js";
import { mid } from "./views/mrate.js";

export const WANT = "w_";
export const isWant = h => !!h && typeof h.id === "string" && h.id.indexOf(WANT) === 0;
export const wantId = id => (WANT + id).slice(0, 300);
const showId = (k, show, d, t) => docId(k + "|" + (show || "PLE") + "|" + (d || "") + "|" + t);
const idOf = ds => ds.m === "1" ? mid(ds.k, ds.t, ds.d) : showId(ds.k, ds.show, ds.d, ds.t);
export const wants = () => Object.values(S.history || {}).filter(isWant).sort((a, b) => (a.d || "9").localeCompare(b.d || "9") || (b.seenAt || 0) - (a.seenAt || 0));
export const wantCount = () => S.user ? wants().length : 0;
const isM = h => !!h && typeof h.id === "string" && h.id.indexOf("m_") === 0;
// déjà vu / noté ?
function seenFor(w) {
  const tg = w.id.slice(WANT.length);
  if (S.history[tg]) return true;
  return w.comment === "[WANTM]" && Object.values(S.history).some(h => isM(h) && h.k === w.k && h.title === w.title);
}
// bouton « Je veux voir » ; kind « m » pour un combat
export function wantBtn(o, cls) {
  if (!o || !o.k || !o.t) return "";
  const ds = { m: o.m ? "1" : "", k: o.k, show: o.show || "", d: okDay(o.d) ? o.d : "", t: o.t }, id = idOf(ds);
  if (S.user && S.history[id]) return ""; // déjà vu : pas besoin
  const on = !!(S.user && S.history[wantId(id)]);
  return '<button class="' + (cls || "wantbtn") + (on ? " on" : "") + '" data-act="want" data-m="' + ds.m + '" data-k="' + esc(ds.k) + '" data-show="' + esc(ds.show) + '" data-d="' + esc(ds.d) + '" data-t="' + esc(ds.t) + '" aria-pressed="' + on + '">' +
    (on ? "★ Dans ma liste" : "＋ Je veux voir") + "</button>";
}
ACT.want = async el => {
  if (!S.user) { toast("Connecte-toi pour garder ta liste « Je veux voir »"); location.hash = "#/connexion"; return; }
  const ds = el.dataset, id = idOf(ds), w = wantId(id);
  try {
    if (S.history[w]) { await B.unsetSeen(S.user.uid, w); toast("Retiré de « Je veux voir »"); }
    else if (S.history[id]) toast("Tu l’as déjà vu");
    else { await B.setSeen(S.user.uid, w, { title: String(ds.t).slice(0, 150), k: String(ds.k).slice(0, 30), show: String(ds.show || "").slice(0, 40), d: okDay(ds.d) ? ds.d : "", rating: 0, comment: ds.m === "1" ? "[WANTM]" : "[WANT]" }); toast("👀 Ajouté à « Je veux voir »"); }
  } catch (e) { toast("Pas enregistré : " + ((e && e.message) || "erreur")); }
};
// appelé à chaque mise à jour de l'historique : ce qui est vu quitte la liste
let busy = {};
export function syncWants() {
  if (!S.user) return;
  wants().forEach(w => { if (!busy[w.id] && seenFor(w)) { busy[w.id] = 1; B.unsetSeen(S.user.uid, w.id).catch(() => {}).then(() => { delete busy[w.id]; }); } });
}
// lien discret (accueil, profil) : rien si la liste est vide
export function wantLink(cls) {
  const n = wantCount(); if (!n) return "";
  return '<a class="' + (cls || "wantlink") + '" href="#/aregarder">👀 Je veux voir <b>' + n + "</b></a>";
}
const evHref = h => "#/ev/" + encodeURIComponent(h.k) + "/" + encodeURIComponent(h.show || "PLE") + "/" + (okDay(h.d) ? h.d : "-/" + encodeURIComponent(h.title || ""));
const when = d => { if (!okDay(d)) return ""; const n = diff(d); return n > 1 ? "dans " + n + " jours" : n === 1 ? "demain" : n === 0 ? "aujourd’hui" : fmt(d); };
// la page « Je veux voir »
export function wantView() {
  let h = '<a class="back" href="javascript:history.back()">' + ICON.back + " Retour</a><h1>Je veux voir</h1>";
  if (!S.user) return h + '<p class="note">Connecte-toi pour garder ta liste.</p>';
  const L = wants(), sh = L.filter(w => w.comment !== "[WANTM]"), fi = L.filter(w => w.comment === "[WANTM]");
  if (!L.length) return h + '<p class="note">Ta liste est vide. Touche « ＋ Je veux voir » sur un show ou un combat pour l’ajouter ici. Il disparaît de la liste quand tu le marques comme vu.</p>';
  const row = w => {
    const m = w.comment === "[WANTM]", ds = ' data-k="' + esc(w.k) + '" data-show="' + esc(w.show || "") + '" data-d="' + esc(w.d || "") + '" data-t="' + esc(w.title) + '"';
    return '<div class="item wantrow"><a class="lbl" href="' + esc(m && !okDay(w.d) ? "#/matchs" : evHref(w)) + '"><b>' + esc(w.title) + "</b><small>" + esc([w.k, m && w.show && w.show !== w.title ? w.show : "", when(w.d)].filter(Boolean).join(" · ")) + "</small></a>" +
      (!okDay(w.d) || diff(w.d) <= 0 ? '<button class="btn small" data-act="' + (m ? "mrate" : "seen") + '"' + ds + ">✓ J’ai vu</button>" : "") +
      '<button class="btn small ghost" data-act="want" data-m="' + (m ? "1" : "") + '"' + ds + ' aria-label="Retirer">✕</button></div>';
  };
  if (sh.length) h += '<h2>Shows <small class="cnt">' + sh.length + '</small></h2><div class="list">' + sh.map(row).join("") + "</div>";
  if (fi.length) h += '<h2>Combats <small class="cnt">' + fi.length + '</small></h2><div class="list">' + fi.map(row).join("") + "</div>";
  return h + '<p class="note small">Quand tu marques un show ou un combat comme vu, il quitte la liste tout seul.</p>';
}
