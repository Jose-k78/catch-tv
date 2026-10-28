// Mode sans spoiler : cache les champions récents, les résultats et les highlights tant que le show n'est pas marqué « vu »
import { S, changed } from "./state.js";
import { lsGet, lsSet, today, dt, okDay } from "./util.js";

export function noSpoil() { return lsGet("ctv.nospoil") === "1"; }
export function setNoSpoil(v) { lsSet("ctv.nospoil", v ? "1" : null); changed("spoil"); }

const unlocked = new Set();                 // ce que l'utilisateur a choisi d'afficher quand même (jusqu'au rechargement)
export function unlock(key) { unlocked.add(key); changed("spoil"); }
export function isUnlocked(key) { return unlocked.has(key); }

// A-t-on marqué « vu » ce show ce jour-là ? (show = "PLE" ou "" pour un PLE)
export function seenDay(k, show, d) {
  const sh = !show || show === "PLE" ? "" : show;
  return Object.values(S.history).some(h => h.k === k && (h.show || "") === sh && h.d === d);
}
function seenSince(k, d) { return Object.values(S.history).some(h => h.k === k && okDay(h.d) && h.d >= d); }

// Highlights / résultats d'un show cachés ?
export function hlHidden(key, k, show, d) { return noSpoil() && !seenDay(k, show, d) && !unlocked.has("hl:" + key); }

// Champion masqué : règne commencé il y a moins de 45 jours et aucun show de la promotion vu depuis
export function champHidden(t) {
  if (!noSpoil() || !t || !okDay(t.since) || unlocked.has("t:" + t.id)) return false;
  const days = Math.round((today() - dt(t.since)) / 864e5);
  return days <= 45 && !seenSince(t.k, t.since);
}
