// Images des vignettes : héritage (vignette > show > promotion), photos libres (Wikimedia Commons), sinon affiche maison
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

// Photo libre recherchée pour un élément (lieu du PLE, ou ambiance générique pour les shows)
const GENERIC = ["empty boxing ring", "arena spotlights stage", "arena crowd lights"];
function freeQuery(e) {
  if (e.kind === "promo") return "";
  if (!e.show && e.kind !== "show") return e.v || (e.w && e.w !== "—" && !/habituel|confirmer/.test(e.w) ? e.w : "");
  const n = e.show || "";
  let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0;
  return GENERIC[Math.abs(h) % GENERIC.length];
}

// Image finale : {src, credit, poster}
export function resolveImage(e) {
  for (const l of chainOf(e)) { const s = ownImage(l.key); if (s) return { src: s }; }
  const q = freeQuery(e);
  if (q) { const f = S.free[q]; if (f && f.src) return { src: f.src, credit: f }; if (!f) requestFree(q); }
  return { poster: true };
}

// ---- Wikimedia Commons ----
const CACHE = "ctv.free.v1", MONTH = 30 * 864e5;
let loaded = false; const pending = new Set(); let timer = null;
function loadCache() {
  if (loaded) return; loaded = true;
  try { const c = JSON.parse(lsGet(CACHE) || "{}"); Object.keys(c).forEach(q => { if (Date.now() - (c[q].at || 0) < MONTH) S.free[q] = c[q]; }); } catch (e) {}
}
function saveCache() { try { lsSet(CACHE, JSON.stringify(S.free)); } catch (e) {} }
const strip = h => String(h || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
function requestFree(q) {
  loadCache();
  if (PREVIEW || S.free[q] || pending.has(q)) return;
  pending.add(q);
  clearTimeout(timer); timer = setTimeout(flush, 50);
}
async function flush() {
  const list = Array.from(pending); pending.clear();
  for (const q of list) {
    try {
      const u = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8" +
        "&gsrsearch=" + encodeURIComponent(q + " filetype:bitmap") + "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=900";
      const r = await fetch(u); const j = await r.json();
      const pages = j && j.query && j.query.pages ? Object.values(j.query.pages).sort((a, b) => (a.index || 0) - (b.index || 0)) : [];
      let pick = null;
      for (const p of pages) {
        const ii = p.imageinfo && p.imageinfo[0]; if (!ii) continue;
        if (!/jpeg|png|webp/.test(ii.mime || "") || (ii.width || 0) < 600 || (ii.width || 0) < (ii.height || 0)) continue;
        const md = ii.extmetadata || {};
        pick = { src: ii.thumburl || ii.url, author: strip(md.Artist && md.Artist.value) || "Auteur inconnu", lic: strip(md.LicenseShortName && md.LicenseShortName.value) || "Licence libre",
          link: ii.descriptionurl || "", title: (p.title || "").replace(/^File:/, ""), at: Date.now() };
        break;
      }
      S.free[q] = pick || { none: true, at: Date.now() };
    } catch (err) { S.free[q] = { none: true, at: Date.now() - MONTH + 864e5 }; } // réessai demain
  }
  saveCache(); changed("images");
}
export function usedCredits() { return Object.keys(S.free).map(q => Object.assign({ q: q }, S.free[q])).filter(f => f.src); }
