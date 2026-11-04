// Lecteur musical : playlists YouTube choisies par le modérateur (data/media.json « pls » : [{ id, n }]).
// Discret (demande de Jose, 4 nov.) : juste le son, sans vidéo à l'écran ; commandes dans un petit panneau sous le bouton 🎵
// du haut. Continue pendant la navigation. Lecture, pause, suivant, précédent, volume, choix de la playlist.
// Reprend la dernière musique écoutée (playlist, morceau, moment). Démarre tout seul à l'ouverture si le membre l'a laissé
// allumé et si le navigateur l'autorise. Se met en pause quand une autre vidéo de l'app est lancée.
import { S, ACT } from "./state.js";
import { esc, lsGet, lsSet, toast } from "./util.js";
import { PREVIEW } from "./content.js";

export const playlists = () => ((S.media && Array.isArray(S.media.pls)) ? S.media.pls : []).filter(p => p && /^[\w-]{10,64}$/.test(p.id || ""));
const ST = "ctv.ytm";
const st = () => { try { return JSON.parse(lsGet(ST) || "{}") || {}; } catch (e) { return {}; } };
const save = o => lsSet(ST, JSON.stringify(Object.assign(st(), o)));
let player = null, apiP = null, box = null, ready = false, saveT = null;

function api() {
  if (apiP) return apiP;
  apiP = new Promise(res => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) try { prev(); } catch (e) {} res(window.YT); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true; s.onerror = () => res(null);
    document.head.appendChild(s);
  });
  return apiP;
}
const curPl = () => { const L = playlists(), id = st().pl; return L.find(p => p.id === id) || L[0] || null; };

function drawBox() {
  // le lecteur YouTube, caché hors de l'écran (seul le son compte)
  if (!box) { box = document.createElement("div"); box.id = "ytm"; box.className = "ytmhide"; box.innerHTML = '<div id="ytmframe"></div>'; document.body.appendChild(box); }
}
// panneau des commandes, sous le bouton 🎵 du haut
function panel(show) {
  let p = document.getElementById("ytmpanel");
  if (!show) { if (p) p.remove(); return; }
  const pl = curPl(), L = playlists(), s = st();
  if (!p) { p = document.createElement("div"); p.id = "ytmpanel"; p.className = "ytmpanel"; document.body.appendChild(p); }
  p.innerHTML = '<b class="ytmt" id="ytmt">' + esc(curTitle || (pl ? pl.n || "Playlist" : "")) + "</b>" +
    '<div class="ytmctl"><button data-act="ytm" data-a="prev" aria-label="Précédent">⏮</button><button data-act="ytm" data-a="toggle" id="ytmpp" aria-label="Lecture / pause">' + (playing ? "⏸" : "▶") + '</button><button data-act="ytm" data-a="next" aria-label="Suivant">⏭</button>' +
    '<input type="range" id="ytmvol" min="0" max="100" value="' + (s.vol == null ? 40 : s.vol) + '" aria-label="Volume"></div>' +
    '<div class="ytmrow">' + (L.length > 1 ? '<select id="ytmpl" aria-label="Playlist">' + L.map(x => '<option value="' + esc(x.id) + '"' + (pl && x.id === pl.id ? " selected" : "") + ">" + esc(x.n || "Playlist") + "</option>").join("") + "</select>" : '<small>' + esc(pl ? pl.n || "" : "") + "</small>") +
    '<button class="linkbtn" data-act="ytm" data-a="close">Arrêter</button><button class="linkbtn" data-act="ytm" data-a="hide">Fermer</button></div>' +
    '<div class="ytmrow"><button class="chip' + (s.shuf ? " on" : "") + '" data-act="ytm" data-a="shuf">🔀 Aléatoire</button><button class="chip' + (s.auto ? " on" : "") + '" data-act="ytm" data-a="auto">⏯ Lecture auto à l’ouverture</button></div>';
}
let curTitle = "", playing = false;
export function ytmPanel() { if (document.getElementById("ytmpanel")) panel(false); else panel(true); }
async function start(autoplay) {
  const pl = curPl(); if (!pl || PREVIEW) { if (!pl) toast("Pas encore de playlist (le modo l’ajoute dans Modération › Apparence)"); return; }
  drawBox();
  const YT = await api(); if (!YT) { toast("YouTube ne répond pas"); return; }
  const s = st(), same = s.pl === pl.id;
  ready = false;
  player = new YT.Player("ytmframe", {
    width: "240", height: "240", host: "https://www.youtube.com",
    playerVars: { listType: "playlist", list: pl.id, index: same ? s.i || 0 : 0, start: same ? Math.floor(s.t || 0) : 0, autoplay: autoplay ? 1 : 0, playsinline: 1, rel: 0, loop: 1, origin: location.origin },
    events: {
      onReady: e => {
        ready = true; if (document.getElementById("ytmpanel")) panel(true);
        const p = e.target; p.setVolume(s.vol == null ? 40 : s.vol);
        try { p.setLoop(true); if (st().shuf) { p.setShuffle(true); if (!same) p.playVideoAt(0); } } catch (x) {}
        if (autoplay) {
          // sans appui sur l'écran, le navigateur n'autorise que la lecture en sourdine : le son revient au premier appui
          if (!gesture) { p.mute(); const un = () => { try { p.unMute(); p.playVideo(); } catch (x) {} document.removeEventListener("pointerdown", un, true); }; document.addEventListener("pointerdown", un, true); }
          p.playVideo();
        }
      },
      onError: e => { try { e.target.nextVideo(); } catch (x) {} },
      onStateChange: e => {
        playing = e.data === 1; const b = document.getElementById("ytmpp"); if (b) b.textContent = playing ? "⏸" : "▶";
        const mb = document.getElementById("musicbtn"); if (mb) mb.classList.toggle("on", playing);
        if (playing) { const d = e.target.getVideoData && e.target.getVideoData(); if (d && d.title) { curTitle = d.title; const t = document.getElementById("ytmt"); if (t) t.textContent = d.title; } }
      }
    }
  });
  save({ pl: pl.id, on: 1 });
  clearInterval(saveT);
  saveT = setInterval(() => { if (!player || !ready || !player.getCurrentTime) return; try { save({ i: player.getPlaylistIndex(), t: player.getCurrentTime() }); } catch (e) {} }, 5000);
}
function stop() { clearInterval(saveT); try { if (player) player.destroy(); } catch (e) {} player = null; ready = false; playing = false; if (box) { box.remove(); box = null; } panel(false); save({ on: 0 }); const mb = document.getElementById("musicbtn"); if (mb) mb.classList.remove("on"); }
ACT.ytm = el => {
  const a = el.dataset.a;
  if (a === "close") return stop();
  if (a === "hide") return panel(false);
  if (a === "shuf") { const on = !st().shuf; save({ shuf: on ? 1 : 0 }); if (player && ready) { try { player.setShuffle(on); if (on) player.playVideoAt(0); } catch (x) {} } el.classList.toggle("on", on); toast(on ? "🔀 Lecture aléatoire" : "Lecture dans l’ordre"); return; }
  if (a === "auto") { const on = !st().auto; save({ auto: on ? 1 : 0 }); el.classList.toggle("on", on); toast(on ? "La musique se lancera à l’ouverture de l’app" : "Plus de lecture automatique"); return; }
  if (!player || !ready) return;
  if (a === "toggle") { if (player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo(); }
  if (a === "next") player.nextVideo();
  if (a === "prev") player.previousVideo();
};
document.addEventListener("change", e => {
  if (e.target.id !== "ytmpl") return;
  const nx = playlists().find(p => p.id === e.target.value); if (!nx) return;
  stop(); save({ pl: nx.id, i: 0, t: 0 }); start(true); setTimeout(() => panel(true), 300); toast("🎵 " + (nx.n || "Playlist"));
});
document.addEventListener("input", e => { if (e.target.id === "ytmvol") { const v = +e.target.value; save({ vol: v }); if (player && ready) player.setVolume(v); } });
// bouton 🎵 en haut : lance la musique (1er appui) puis ouvre / ferme le panneau des commandes
let gesture = false;
export function ytmToggle() { gesture = true; if (!box) { start(true); panel(true); } else ytmPanel(); }
export const ytmOn = () => !!box;
// à l'ouverture : le lecteur revient s'il était allumé (lecture auto si le navigateur l'autorise)
export function ytmBoot() { if (playlists().length && (st().on || st().auto) && !box) start(true); }
// une autre vidéo de l'app démarre -> pause
setInterval(() => { if (!player || !ready) return; const other = [...document.querySelectorAll(".player iframe, .player video")].length; if (other && player.getPlayerState && player.getPlayerState() === 1) player.pauseVideo(); }, 1500);
// toucher ailleurs ferme le panneau (la musique continue)
document.addEventListener("click", e => { const p = document.getElementById("ytmpanel"); if (p && !p.contains(e.target) && !e.target.closest("#musicbtn")) p.remove(); }, true);
