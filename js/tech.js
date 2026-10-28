// Fiche technique d'un catcheur : surnom, ville annoncée, taille, poids, débuts, prises de finition, clans.
// Ordre : données de l'app (data/wrestlers.json, préparées en français) > Pro Wrestling Wiki (infobox) > Wikidata.
import { esc, okHttp } from "./util.js";

export const TECH = [["nick", "Surnom"], ["from", "Annoncé de"], ["ht", "Taille"], ["wt", "Poids"], ["debut", "Débuts"], ["fin", "Prises de finition"], ["teams", "Équipes et clans"], ["trainer", "Entraîné par"]];
const KEYS = {
  nick: /^(nick ?names?|nicknames?|surnoms?)$/, from: /^(billed|billed[ _]?from|hometown|résidence|annoncé[ _]de)$/, ht: /^(billed[ _]?height|height|taille)$/,
  wt: /^(billed[ _]?weight|weight|poids)$/, debut: /^(debut|débuts?|début)$/, fin: /^(finishing[ _]?moves?|finishers?|finishing|prises? de finition)$/,
  teams: /^(teams?|stables?|factions?|groups?|tag ?teams?|teams and stables)$/, trainer: /^(trainers?|trained ?by|entraîneurs?)$/,
};

// {{height|ft=6|in=3}} -> « 1,91 m » ; {{convert|265|lb|kg}} -> « 120 kg »
function conv(t) {
  const ft = t.match(/ft\s*=\s*(\d+)/i), inch = t.match(/in\s*=\s*(\d+)/i), m = t.match(/\bm\s*=\s*([\d.]+)/i);
  if (/height/i.test(t)) {
    if (ft) return (((+ft[1]) * 30.48 + (inch ? +inch[1] : 0) * 2.54) / 100).toFixed(2).replace(".", ",") + " m";
    if (m) return String(m[1]).replace(".", ",") + " m";
  }
  const c = t.match(/convert\s*\|\s*([\d.]+)\s*\|\s*(lb|kg|cm|m|ft)/i);
  if (c) {
    const v = +c[1];
    if (/lb/i.test(c[2])) return Math.round(v * 0.4536) + " kg";
    if (/kg/i.test(c[2])) return Math.round(v) + " kg";
    if (/cm/i.test(c[2])) return (v / 100).toFixed(2).replace(".", ",") + " m";
    if (/^m$/i.test(c[2])) return String(v).replace(".", ",") + " m";
  }
  return "";
}
export function cleanWiki(v) {
  return String(v || "").replace(/<!--[\s\S]*?-->/g, "").replace(/<ref[^>]*\/>/gi, "").replace(/<ref[\s\S]*?<\/ref>/gi, "").replace(/<br\s*\/?>/gi, ", ")
    .replace(/\{\{\s*(height|convert)[^{}]*\}\}/gi, m => conv(m))
    .replace(/\{\{\s*(?:plainlist|ubl|unbulleted list|flatlist|hlist)\s*\|([^{}]*)\}\}/gi, (m, x) => x.split("|").join(", "))
    .replace(/\{\{[^{}]*\}\}/g, "").replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1").replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, "$1")
    .replace(/'{2,}/g, "").replace(/<[^>]+>/g, "").replace(/^\s*[*#]\s*/gm, "").replace(/\n+/g, ", ").replace(/,\s*[*#]+\s*/g, ", ").replace(/\s+/g, " ")
    .replace(/(?:\s*,\s*){2,}/g, ", ").replace(/^[,\s*#]+|[,\s]+$/g, "").trim();
}
// Premier modèle « Infobox » d'une page wiki -> { champ: valeur nettoyée }
export function parseInfobox(wt) {
  const start = String(wt || "").search(/\{\{\s*(infobox|wrestler|professional wrestler)/i); if (start < 0) return null;
  let depth = 0, end = -1;
  for (let i = start; i < wt.length - 1; i++) {
    if (wt[i] === "{" && wt[i + 1] === "{") { depth++; i++; }
    else if (wt[i] === "}" && wt[i + 1] === "}") { depth--; i++; if (depth === 0) { end = i - 1; break; } }
  }
  const body = wt.slice(start + 2, end > 0 ? end : start + 8000), parts = [];
  let cur = "", d = 0, b = 0;
  for (let k = 0; k < body.length; k++) {
    const two = body.substr(k, 2);
    if (two === "{{") { d++; cur += two; k++; continue; }
    if (two === "}}") { d--; cur += two; k++; continue; }
    if (two === "[[") { b++; cur += two; k++; continue; }
    if (two === "]]") { b--; cur += two; k++; continue; }
    if (body[k] === "|" && d === 0 && b === 0) { parts.push(cur); cur = ""; continue; }
    cur += body[k];
  }
  parts.push(cur);
  const raw = {};
  parts.slice(1).forEach(p => { const m = p.match(/^\s*([^=]+?)\s*=\s*([\s\S]*)$/); if (m) raw[m[1].toLowerCase().trim()] = cleanWiki(m[2]); });
  const out = {};
  Object.keys(raw).forEach(key => { Object.keys(KEYS).forEach(f => { if (!out[f] && KEYS[f].test(key) && raw[key]) out[f] = raw[key].slice(0, 200); }); });
  // taille et poids : on garde le système métrique quand il est donné entre parenthèses
  if (out.ht) { const m = out.ht.match(/([\d]+[.,]\d+)\s*m\b/); if (m && !/^\d,\d+ m$/.test(out.ht)) out.ht = m[1].replace(".", ",") + " m"; }
  if (out.wt) { const k = out.wt.match(/(\d+(?:[.,]\d+)?)\s*kg/); if (k) out.wt = Math.round(parseFloat(k[1].replace(",", "."))) + " kg"; else { const l = out.wt.match(/(\d+)\s*lbs?/); if (l) out.wt = Math.round(+l[1] * 0.4536) + " kg"; } }
  return Object.keys(out).length ? out : null;
}

// ---------- sources en direct (depuis le téléphone) ----------
const cache = {};
async function fandom(name) {
  const u = "https://prowrestling.fandom.com/api.php?action=parse&format=json&origin=*&redirects=1&prop=wikitext&page=" + encodeURIComponent(name.replace(/ /g, "_"));
  const j = await (await fetch(u)).json();
  const wt = j && j.parse && j.parse.wikitext && (j.parse.wikitext["*"] || j.parse.wikitext);
  const f = typeof wt === "string" ? parseInfobox(wt) : null;
  return f ? Object.assign(f, { _src: "Pro Wrestling Wiki", _u: "https://prowrestling.fandom.com/wiki/" + encodeURIComponent((j.parse.title || name).replace(/ /g, "_")) }) : null;
}
const QUNIT = { Q11573: "m", Q174728: "cm", Q11570: "kg", Q100995: "lb" };
async function wikidata(qid) {
  if (!/^Q\d+$/.test(qid || "")) return null;
  const u = "https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims&ids=" + qid;
  const j = await (await fetch(u)).json(), cl = j && j.entities && j.entities[qid] && j.entities[qid].claims; if (!cl) return null;
  const val = p => cl[p] && cl[p][0] && cl[p][0].mainsnak && cl[p][0].mainsnak.datavalue && cl[p][0].mainsnak.datavalue.value;
  const out = {}, h = val("P2048"), w = val("P2067"), nick = cl.P1449, start = val("P2031");
  if (h && h.amount) { const unit = QUNIT[String(h.unit).split("/").pop()]; const v = parseFloat(h.amount); out.ht = (unit === "cm" ? v / 100 : v).toFixed(2).replace(".", ",") + " m"; }
  if (w && w.amount) { const unit = QUNIT[String(w.unit).split("/").pop()]; const v = parseFloat(w.amount); out.wt = Math.round(unit === "lb" ? v * 0.4536 : v) + " kg"; }
  if (nick) out.nick = nick.map(x => x.mainsnak && x.mainsnak.datavalue && x.mainsnak.datavalue.value && x.mainsnak.datavalue.value.text).filter(Boolean).slice(0, 3).join(", ");
  if (start && start.time) out.debut = start.time.slice(1, 5);
  return Object.keys(out).length ? Object.assign(out, { _src: "Wikidata", _u: "https://www.wikidata.org/wiki/" + qid }) : null;
}

export function techHTML(f, srcs) {
  const rows = TECH.filter(t => f[t[0]]).map(t => '<div><small>' + t[1] + "</small><b>" + esc(Array.isArray(f[t[0]]) ? f[t[0]].join(", ") : f[t[0]]) + "</b></div>");
  if (!rows.length) return "";
  return '<div class="wtechgrid">' + rows.join("") + "</div>" + (srcs && srcs.length ? '<small class="src">Fiche technique : ' + srcs.map(s => okHttp(s.u) ? '<a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.n) + "</a>" : esc(s.n)).join(" · ") + "</small>" : "");
}
// Complète la fiche technique affichée dans #wtech (champs manquants seulement)
export async function fillTech(name, local, qid) {
  const box = () => document.getElementById("wtech");
  const f = Object.assign({}, local || {}), srcs = [];
  if (local && Object.keys(local).length) srcs.push({ n: "TCC TV" });
  const key = name + "|" + (qid || "");
  try {
    const extra = cache[key] || (cache[key] = await Promise.all([fandom(name).catch(() => null), wikidata(qid).catch(() => null)]));
    extra.forEach(x => {
      if (!x) return; let used = false;
      TECH.forEach(t => { if (!f[t[0]] && x[t[0]]) { f[t[0]] = x[t[0]]; used = true; } });
      if (used) srcs.push({ n: x._src, u: x._u });
    });
  } catch (e) {}
  if (box()) box().innerHTML = techHTML(f, srcs);
}
