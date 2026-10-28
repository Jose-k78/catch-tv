// Roster de chaque promotion, par show (Raw, SmackDown…) ou par division / clan ; chaque nom ouvre sa fiche
import { S } from "../state.js";
import { esc, ICON, okHttp } from "../util.js";
import { plain, colorOf } from "./catalog.js";
import { isFav } from "./favs.js";
import { alignOf } from "../wrestlers.js";

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export function rosterOf(k) { const r = S.rosters && S.rosters[k]; return r && typeof r === "object" ? r : null; }
// Où apparaît ce nom : [{k, g}]
export function rosterSpots(name) {
  const n = norm(name), out = [];
  Object.keys(S.rosters || {}).forEach(k => { const r = S.rosters[k] || {}; Object.keys(r).forEach(g => { if ((r[g] || []).some(x => norm(x) === n)) out.push({ k: k, g: g }); }); });
  return out;
}
function champs() {
  const set = {};
  (S.titles || []).forEach(t => (t.who || []).forEach(w => { set[norm(w)] = 1; }));
  return set;
}
export function rosterTile(k, n) {
  const r = rosterOf(k); if (!r) return "";
  const groups = Object.keys(r), total = new Set([].concat.apply([], groups.map(g => r[g] || []))).size;
  const g = n && r[n] ? n : "";
  return '<a class="titletile" href="#/roster/' + encodeURIComponent(k) + (g ? "/" + encodeURIComponent(g) : "") + '"><span class="tt-belt" style="' + esc(plain(colorOf(k, n || ""))) + '">👥</span>' +
    '<span class="tt-txt"><b>Roster ' + esc(g || k) + "</b><small>" + (g ? (r[g] || []).length : total) + " catcheurs et catcheuses" + (g ? "" : " · " + esc(groups.join(", "))) + '</small></span><span class="chev">›</span></a>';
}
let lastQ = "";
export function rosterView(k, g) {
  const r = rosterOf(k);
  let h = '<a class="back" href="#/p/' + encodeURIComponent(k) + (g && S.P[k] && S.P[k].s && S.P[k].s[g] ? "/" + encodeURIComponent(g) : "") + '">' + ICON.back + " " + esc(g && S.P[k] && S.P[k].s && S.P[k].s[g] ? g : k) + "</a><h1>Roster " + esc(k) + "</h1>";
  if (!r) return h + '<p class="note">Le roster de cette promotion arrive bientôt.</p>';
  const ch = champs(), q = norm(lastQ);
  const order = Object.keys(r).sort((a, b) => (a === g ? -1 : b === g ? 1 : 0));
  h += '<div class="search"><input id="rq" type="search" placeholder="Chercher dans le roster" autocomplete="off" value="' + esc(lastQ) + '"></div>';
  h += order.map(grp => '<h2>' + esc(grp) + ' <small class="cnt">' + (r[grp] || []).length + '</small></h2><div class="chips wrap rgrid">' + (r[grp] || []).map(nm => {
    const c = ch[norm(nm)], f = S.user && isFav(nm), al = alignOf(nm);
    return '<a class="chip rn' + (c ? " gold" : "") + (al && al.k ? " al-" + al.k : "") + (al && al.inj ? " inj" : "") + '" data-n="' + esc(norm(nm)) + '" href="#/catcheur/' + encodeURIComponent(nm) + '"' + (q && norm(nm).indexOf(q) < 0 ? " hidden" : "") + ">" + (f ? "⭐ " : "") + (c ? "🏆 " : "") + esc(nm) + (al && al.inj ? " 🤕" : "") + "</a>";
  }).join("") + "</div>").join("");
  const src = S.rostersSrc && S.rostersSrc[k];
  const anyAl = Object.keys(r).some(grp => (r[grp] || []).some(nm => alignOf(nm)));
  h += '<p class="note small" style="margin-top:14px">🏆 = champion actuel · ⭐ = dans tes favoris.' + (anyAl ? ' Pastille <span class="dotk al-face"></span> face · <span class="dotk al-heel"></span> heel · <span class="dotk al-tweener"></span> tweener · 🤕 blessé (d’après The SmackDown Hotel, complété au fil des mises à jour).' : "") + ' ' + (okHttp(src) ? 'Source : <a href="' + esc(src) + '" target="_blank" rel="noopener">' + esc(src.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]) + "</a>, mis à jour automatiquement." : "") + "</p>";
  return h;
}
document.addEventListener("input", e => {
  if (e.target.id !== "rq") return;
  lastQ = e.target.value; const q = norm(lastQ);
  document.querySelectorAll(".rn").forEach(el => { el.hidden = !!q && el.dataset.n.indexOf(q) < 0; });
});
