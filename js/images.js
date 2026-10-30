// Images des vignettes : héritage (vignette > show > promotion) choisie par le modérateur, sinon affiche maison
import { S, changed } from "./state.js";
import { okImg, docId, lsGet, lsSet } from "./util.js";
import { PREVIEW } from "./content.js";

// Chaîne d'héritage pour un élément du calendrier
export function chainOf(e) {
  if (e.kind === "promo") return [{ key: "promo:" + e.k, label: "Toute la " + e.k }];
  const promo = { key: "promo:" + e.k, label: "Toutes les vignettes " + e.k };
  if (e.kind === "show") return [{ key: "show:" + e.k + "|" + e.show, label: "Tous les " + e.show }, promo];
  if (e.show) return [{ key: "ep:" + e.k + "|" + e.show + "|" + e.d, label: "Cet épisode seulement" }, { key: "show:" + e.k + "|" + e.show, label: "Tous les " + e.show }, promo];
  const c = [{ key: "ple:" + e.k + "|" + e.t, label: "Ce PLE seulement" }];
  if (e.br) c.push({ key: "show:" + e.k + "|" + e.br, label: "Tout " + e.br });
  c.push(promo);
  return c;
}
export function ownImage(key) { const s = S.images[docId(key)]; return okImg(s) ? s : ""; }

// Image finale : celle choisie par le modérateur (vignette > show > promotion), sinon affiche maison.
// (Les photos automatiques de Wikimedia Commons ont été retirées le 30 oct. 2026 pour alléger l'app.)
export function resolveImage(e) {
  for (const l of chainOf(e)) { const s = ownImage(l.key); if (s) return { src: s }; }
  return { poster: true };
}
try { lsSet("ctv.free.v1", null); } catch (e) {}
