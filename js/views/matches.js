// Matchs à découvrir : sélection de la semaine (tirée au hasard), filtre par promotion, match au hasard
import { S, ACT, changed } from "../state.js";
import { esc, ICON, modal } from "../util.js";
import { PREVIEW } from "../content.js";
import { rateBtn } from "./mrate.js";

let filter = "";
function weekNo(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() * 100 + Math.ceil(((t - y) / 864e5 + 1) / 7); }
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
function shuffle(a, seed) { const r = rng(seed), b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const okId = id => typeof id === "string" && /^[\w-]{11}$/.test(id);
const pool = () => S.matches.filter(m => m && okId(m.id) && (!filter || m.k === filter));
const ytUrl = id => "https://www.youtube.com/watch?v=" + id;
function colorOf(k) { const c = (S.P[k] && S.P[k].c) || ["#444", "#111"]; return c.length >= 3 ? "linear-gradient(120deg," + c[0] + " 0 34%,#6b6b6b 34% 66%," + c[2] + " 66%)" : "linear-gradient(160deg," + c[0] + "," + c[1] + ")"; }

function matchRow(m) {
  return '<article class="mrowc"><div class="mbadge" style="background:' + colorOf(m.k) + '">' + esc(m.k) + '</div><div class="epbody"><b class="eptitle">' + esc(m.t) + "</b>" +
    '<small class="epmeta">' + (m.ev ? esc(m.ev) + " · " : "") + "Match complet · chaîne officielle</small></div>" +
    '<div class="mrbtns"><button class="btn small" data-act="play" data-id="' + esc(m.id) + '" data-t="' + esc(m.t) + '">▶ Voir</button>' + rateBtn(m.k, m.t, m.ev || "", "") + "</div></article>";
}
export function matchesView() {
  const all = pool(), week = shuffle(all, weekNo(new Date()) + filter.length * 7919).slice(0, 10);
  const proms = Array.from(new Set(S.matches.map(m => m.k))).filter(k => S.P[k]);
  let h = '<a class="back" href="#/">' + ICON.back + " Accueil</a><h1>Matchs à découvrir</h1>" +
    '<nav class="tabs" style="padding-top:0">' + [""].concat(proms).map(k => '<button class="tab' + (k === filter ? " on" : "") + '" data-act="mfilter" data-k="' + esc(k) + '">' + (k ? esc(k) : "Tout") + "</button>").join("") + "</nav>" +
    '<div class="btns" style="justify-content:flex-start;margin:4px 16px 0"><button class="btn" data-act="mrandom">🎲 Un match au hasard</button></div>' +
    "<h2>La sélection de la semaine</h2>";
  h += week.length ? '<div class="eps">' + week.map(matchRow).join("") + "</div>" : '<p class="note">Pas encore de match pour cette promotion.</p>';
  h += '<p class="note small" style="margin-top:12px">☆ Note les matchs que tu as vus : ils rejoignent ton historique des notes. Nouvelle sélection chaque lundi. Uniquement des vidéos publiées par les chaînes YouTube officielles des promotions.</p>';
  return h;
}
ACT.mfilter = el => { filter = el.dataset.k || ""; changed("route"); };
ACT.mrandom = () => { const p = pool(); if (!p.length) return; const m = p[Math.floor(Math.random() * p.length)]; play(m.id, m.t); };
ACT.play = el => play(el.dataset.id, el.dataset.t);
function play(id, title) {
  if (!okId(id)) return;
  modal((box, close) => {
    box.innerHTML = "<h3>" + esc(title) + "</h3>" +
      (PREVIEW ? '<p class="sub">La vidéo se lira directement ici une fois l’app en ligne. En attendant, ouvre-la sur YouTube.</p>'
        : '<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0" title="' + esc(title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>') +
      '<a class="btn wide" href="' + ytUrl(id) + '" target="_blank" rel="noopener">Ouvrir sur YouTube ↗</a><button class="btn wide ghost" style="margin-top:10px" data-close>Fermer</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
  });
}
