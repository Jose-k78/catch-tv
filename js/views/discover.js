// « Wrestlers à découvrir » : tirage au hasard parmi toutes les fédérations et toutes les époques
import { S, ACT } from "../state.js";
import { esc } from "../util.js";

let cur = "";
function pool() { const W = S.wrestlers || {}; return Object.keys(W).filter(k => W[k] && W[k].disc && W[k].txt); }
function pickOne() {
  const p = pool(); if (!p.length) return "";
  let n = p[Math.floor(Math.random() * p.length)];
  if (p.length > 1) while (n === cur) n = p[Math.floor(Math.random() * p.length)];
  return n;
}
export function discoverTile() {
  if (!cur || !S.wrestlers[cur]) cur = pickOne();
  if (!cur) return "";
  const w = S.wrestlers[cur];
  return '<section class="disc"><span class="eyebrow">🎲 WRESTLERS À DÉCOUVRIR</span><a class="disclink" href="#/catcheur/' + encodeURIComponent(cur) + '"><b>' + esc(cur) + "</b>" +
    "<small>" + esc([w.era, w.k].filter(Boolean).join(" · ")) + "</small><p>" + esc(w.txt) + '</p><span class="discgo">Voir sa fiche ›</span></a>' +
    '<button class="btn small glass" data-act="discover">🎲 Un autre</button></section>';
}
ACT.discover = () => { cur = pickOne(); const el = document.querySelector(".disc"); if (el) el.outerHTML = discoverTile(); };
