// Photos des catcheurs choisies par l'admin : fichiers dans img/catcheurs/, liste dans data/photos.json
// (tenue à jour par le robot GitHub : une photo déposée dans le dossier est reconnue d'après son nom de fichier).
// On les retrouve par le nom du catcheur (accents, majuscules, ponctuation et « The » ignorés) et par ses autres noms.
import { S } from "./state.js";
import { esc } from "./util.js";
import { wInfo } from "./wrestlers.js";

const key = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "");
let map = null, mapOf = null;
function index() {
  const P = S.photos || {};
  if (map && mapOf === P) return map;
  map = new Map(); mapOf = P;
  Object.keys(P).forEach(s => {
    const it = P[s]; if (!it || typeof it.f !== "string") return;
    const inl = /^data:image\/(?:webp|png|jpeg);base64,/.test(it.f); // aperçu tout-en-un : photo intégrée
    if (!inl && !/^[^/\\]+\.(?:webp|png|jpe?g|gif)$/i.test(it.f)) return;
    const src = inl ? it.f : "img/catcheurs/" + encodeURIComponent(it.f);
    [s].concat(Array.isArray(it.n) ? it.n : []).forEach(n => { const k = key(n); if (k && !map.has(k)) map.set(k, src); });
  });
  return map;
}
// adresse de la photo d'un catcheur, ou ""
export function photoOf(name) {
  if (!name) return "";
  const m = index(); if (!m.size) return "";
  const k = key(String(name).replace(/\s*\(.*\)$/, ""));
  if (m.has(k)) return m.get(k);
  if (k.indexOf("the") === 0 && m.has(k.slice(3))) return m.get(k.slice(3));
  const w = wInfo(name);
  if (w) for (const n of [w.name].concat(Array.isArray(w.a) ? w.a : [])) { const p = m.get(key(n)); if (p) return p; }
  return "";
}
const href = n => "#/catcheur/" + encodeURIComponent(n);
// petite photo ronde qui mène à la fiche (rien si pas de photo)
export function face(name, size, cls) {
  const p = photoOf(name); if (!p) return "";
  return '<a class="wface' + (cls ? " " + cls : "") + '" href="' + href(name) + '" title="' + esc(name) + '" style="width:' + size + "px;height:" + size + 'px"><img src="' + esc(p) + '" alt="' + esc(name) + '" loading="lazy" onerror="this.parentNode.remove()"></a>';
}
// les catcheurs d'un camp : « The Vision (Bron Breakker et Austin Theory) » -> les membres ; « A et B » -> A, B
export function peopleOf(side) {
  const s = String(side || ""), inner = s.match(/\(([^)]+)\)/);
  const src = inner && /\bet\b|,|&/.test(inner[1]) ? inner[1] : s.replace(/\([^)]*\)/g, " ");
  return src.split(/\s*(?:&|,|\bet\b|\band\b)\s*/i).map(x => x.trim()).filter(x => x.length >= 2);
}
// une ligne « Titre : A contre B » -> les photos face à face (rien si aucune photo)
export function versus(line, size) {
  let s = String(line || "");
  const c = s.indexOf(" : "); if (c > 0 && c < 90 && / contre | vs\.? /i.test(s.slice(c))) s = s.slice(c + 3);
  s = s.split(/\s+[—–]\s+/)[0];
  const sides = s.split(/\s+contre\s+|\s+vs\.?\s+/i);
  if (sides.length < 2) return "";
  const html = sides.map(sd => peopleOf(sd).map(n => face(n, size || 40)).join(""));
  if (!html.some(Boolean)) return "";
  return '<span class="wvs">' + html.map(h => '<span class="wside">' + (h || '<span class="wnone">?</span>') + "</span>").join('<span class="wvsx">VS</span>') + "</span>";
}
// rangée de photos des catcheurs cités (6 au plus)
export function faceRow(names, size, max) {
  const seen = {}, out = [];
  (names || []).forEach(n => { const p = photoOf(n); if (p && !seen[p] && out.length < (max || 6)) { seen[p] = 1; out.push(face(n, size || 36)); } });
  return out.length ? '<div class="wfaces">' + out.join("") + "</div>" : "";
}
// photo sans lien (dans un bouton : vote d'un sondage)
export function faceImg(name, size) {
  const p = photoOf(name); if (!p) return "";
  return '<img class="wface0" src="' + esc(p) + '" alt="" loading="lazy" style="width:' + size + "px;height:" + size + 'px" onerror="this.remove()">';
}
