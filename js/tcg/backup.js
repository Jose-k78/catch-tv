// TCCCG — sauvegardes (11 nov., Jose a perdu sa partie). Deux sortes de copies :
//  - celles du robot dans Firebase (tcgbak/{uid}_max = la plus avancée jamais vue, _j0…_j6 = une par jour de la semaine) ;
//  - celles de ce téléphone (localStorage : la dernière, la plus avancée, une par jour).
// « Restaurer » remet la copie choisie comme partie. Le modo peut aussi restaurer la partie d'un membre.
import { S, B, ACT, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { me, cleanSave, localCopies, scoreOf, atLeast } from "./store.js";
import { giveButton } from "./give.js";

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const when = ms => ms ? new Date(ms).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "date inconnue";
const nCards = d => Object.keys(d.cards || {}).length;
const sum = d => "Niveau " + (+d.lvl || 1) + " · " + nCards(d) + " carte" + (nCards(d) > 1 ? "s" : "") + " · " + (+d.opened || 0) + " booster" + ((+d.opened || 0) > 1 ? "s" : "") + " ouverts · 💵 " + (((d.res || {}).money) || 0);
let mine = null, all = null, loading = false;
const bkAt = c => +(c._bk && c._bk.at) || +c.at || 0;
function load() {
  if (loading || !S.user || !B.tcgBackups) return; loading = true;
  B.tcgBackups(S.user.uid).then(L => { mine = L; }).catch(() => { mine = []; }).then(() => { loading = false; changed("tcg"); });
}
function copies() {
  const L = [];
  (mine || []).slice().sort((a, b) => (a._id.slice(-3) === "max" ? -1 : 1) - (b._id.slice(-3) === "max" ? -1 : 1) || bkAt(b) - bkAt(a)).forEach(c => {
    const j = c._id.match(/_j(\d)$/);
    L.push({ k: "fb:" + c._id, t: c._id.slice(-4) === "_max" ? "☁️ La plus avancée (copie Firebase)" : "☁️ Copie du " + (j ? JOURS[+j[1]] : "jour") + " (Firebase)", at: bkAt(c), d: c });
  });
  const lo = localCopies(S.user.uid);
  if (lo.best) L.push({ k: "lo:best", t: "📱 La plus avancée (sur ce téléphone)", at: lo.best.at, d: lo.best.d });
  if (lo.last) L.push({ k: "lo:last", t: "📱 La dernière (sur ce téléphone)", at: lo.last.at, d: lo.last.d });
  Object.keys(lo.days || {}).sort().reverse().forEach(day => L.push({ k: "lo:" + day, t: "📱 Copie du " + day.split("-").reverse().join("/") + " (sur ce téléphone)", at: lo.days[day].at, d: lo.days[day].d }));
  return L;
}
export function backupView() {
  if (!S.user) return "";
  if (mine === null) load();
  const cur = me(), L = copies();
  let h = '<section class="tccghead"><h1>Sauvegardes</h1><small>Les archives de ta partie</small></section>' +
    '<p class="tnote">Ta partie est copiée toute seule : par le robot dans Firebase (la plus avancée + une par jour de la semaine) et sur ce téléphone. Si ta partie disparaît, choisis une copie et touche « Restaurer ».</p>' +
    '<div class="tbkcur"><b>Ta partie maintenant</b><small>' + (S.tcgReady ? esc(sum(cur)) : "en cours de chargement…") + "</small></div>";
  if (mine === null) h += '<p class="tnote">Recherche des copies…</p>';
  h += L.length ? '<div class="list tbklist">' + L.map(c => {
    const low = S.tcgReady && !atLeast(scoreOf(c.d), scoreOf(cur)), lock = low && !S.realAdmin && (+c.d.lvl || 1) < (+cur.lvl || 1);
    return '<div class="item"><span class="lbl"><b>' + esc(c.t) + "</b><small>" + esc(when(c.at)) + "</small><small>" + esc(sum(c.d)) + "</small>" + (low ? '<small class="tbklow">Moins avancée que ta partie actuelle</small>' : "") + "</span>" +
      '<button class="btn small' + (low ? " ghost" : "") + '" data-act="tcgrestore" data-k="' + esc(c.k) + '"' + (lock ? " disabled" : "") + ">Restaurer</button></div>";
  }).join("") + "</div>" : (mine === null ? "" : '<p class="tnote">Aucune copie pour l’instant. Le robot fait la première dans l’heure qui suit, puis tous les jours.</p>');
  if (S.realAdmin) h += "<h2>Modo : parties des membres</h2>" + '<div style="margin:0 16px 8px">' + giveButton() + "</div>" + (all ? allView() : '<button class="btn wide ghost" data-act="tcgbkall">Voir les copies de tous les membres</button>');
  return h;
}
function restore(uid, d, label, done) {
  const x = cleanSave(d), cur = uid === S.user.uid ? me() : null;
  modal((box, close) => {
    box.innerHTML = "<h3>Restaurer cette copie ?</h3><p class=\"sub\">" + esc(label) + "<br><b>" + esc(sum(x)) + "</b>" + (cur ? "<br><br>Ta partie actuelle (" + esc(sum(cur)) + ") sera remplacée." : "<br><br>La partie actuelle de ce membre sera remplacée.") + "</p>" +
      '<button class="btn wide" data-y>🛟 Restaurer</button><button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      if (!e.target.closest("[data-y]")) return;
      close();
      B.saveTcg(uid, x).then(() => { toast("🛟 Partie restaurée ✓"); if (done) done(); }).catch(er => toast("Restauration refusée : " + ((er && er.message) || "erreur") + (uid === S.user.uid ? "" : " (règles Firebase v12 collées ?)"), { ms: 6000 }));
    });
  });
}
ACT.tcgrestore = el => {
  const c = copies().find(x => x.k === el.dataset.k); if (!c) return;
  restore(S.user.uid, c.d, c.t + " · " + when(c.at));
};
// ---------- modo ----------
let members = null;
ACT.tcgbkall = () => {
  if (!S.realAdmin || !B.tcgBackupsAll) return; toast("Chargement…");
  Promise.all([B.tcgBackupsAll(), B.listTcg ? B.listTcg() : []]).then(r => { all = r[0] || []; members = r[1] || []; changed("tcg"); }).catch(e => toast("Lecture impossible : " + ((e && e.message) || "") + " (règles Firebase v12 collées ?)", { ms: 6000 }));
};
function allView() {
  const by = {};
  all.forEach(c => { const uid = (c._bk && c._bk.uid) || c._id.replace(/_(max|j\d)$/, ""); (by[uid] = by[uid] || []).push(c); });
  const U = Object.keys(by); if (!U.length) return '<p class="tnote">Aucune copie pour l’instant (le robot passe toutes les heures).</p>';
  return '<div class="list tbklist">' + U.map(uid => {
    const L = by[uid], best = L.find(c => c._id.slice(-4) === "_max") || L[0], now = (members || []).find(m => m.uid === uid), behind = now && !atLeast(scoreOf(now), scoreOf(best));
    return '<div class="item"><span class="lbl"><b>' + esc(best.name || now && now.name || "Membre") + "</b><small>Copie la plus avancée : " + esc(sum(best)) + "</small><small>Maintenant : " + (now ? esc(sum(now)) : "pas de partie") + "</small>" + (behind ? '<small class="tbklow">⚠️ Sa partie a reculé</small>' : "") + "</span>" +
      '<span class="tbkbtns"><button class="btn small' + (behind ? "" : " ghost") + '" data-act="tcgbkrest" data-uid="' + esc(uid) + '">Restaurer</button>' + giveButton(uid, best.name || now && now.name || "Membre") + "</span></div>";
  }).join("") + "</div>";
}
ACT.tcgbkrest = el => {
  const uid = el.dataset.uid, L = (all || []).filter(c => ((c._bk && c._bk.uid) || c._id.replace(/_(max|j\d)$/, "")) === uid); if (!L.length) return;
  modal((box, close) => {
    box.innerHTML = "<h3>Quelle copie ?</h3>" + '<div class="list">' + L.sort((a, b) => bkAt(b) - bkAt(a)).map(c => '<button class="item" data-id="' + esc(c._id) + '"><span class="lbl"><b>' + esc(c._id.slice(-4) === "_max" ? "La plus avancée" : "Copie du " + JOURS[+c._id.slice(-1)]) + "</b><small>" + esc(when(bkAt(c)) + " · " + sum(c)) + "</small></span></button>").join("") + '</div><button class="btn wide ghost" style="margin-top:8px" data-close>Annuler</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const b = e.target.closest("[data-id]"); if (!b) return; const c = L.find(x => x._id === b.dataset.id); close();
      restore(uid, c, (c.name || "Membre") + " · " + when(bkAt(c)), () => { ACT.tcgbkall(); });
    });
  });
};
