// Lecteur musical : playlists YouTube choisies par le modérateur (data/media.json « pls » : [{ id, n }]).
// Petit lecteur flottant, toujours visible quand il joue (règle YouTube : la vidéo doit rester visible), qui continue
// pendant la navigation (il est en dehors de la page). Lecture, pause, suivant, précédent, volume, choix de la playlist.
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
  if (!box) { box = document.createElement("div"); box.id = "ytm"; document.body.appendChild(box); }
  const pl = curPl(), L = playlists(), s = st();
  box.className = "ytm" + (s.min ? " min" : "");
  box.innerHTML = '<div class="ytmvid"><div id="ytmframe"></div></div>' +
    '<div class="ytmbar"><b class="ytmt" id="ytmt">' + esc(pl ? pl.n || "Playlist" : "") + "</b>" +
    '<div class="ytmctl"><button data-act="ytm" data-a="prev" aria-label="Précédent">⏮</button><button data-act="ytm" data-a="toggle" id="ytmpp" aria-label="Lecture / pause">⏯</button><button data-act="ytm" data-a="next" aria-label="Suivant">⏭</button>' +
    '<input type="range" id="ytmvol" min="0" max="100" value="' + (s.vol == null ? 40 : s.vol) + '" aria-label="Volume">' +
    (L.length > 1 ? '<button data-act="ytm" data-a="pick" aria-label="Choisir la playlist">☰</button>' : "") +
    '<button data-act="ytm" data-a="min" aria-label="Réduire">' + (s.min ? "▴" : "▾") + '</button><button data-act="ytm" data-a="close" aria-label="Fermer">✕</button></div></div>';
}
async function start(autoplay) {
  const pl = curPl(); if (!pl || PREVIEW) { if (!pl) toast("Pas encore de playlist (le modo l’ajoute dans Modération › Apparence)"); return; }
  drawBox();
  const YT = await api(); if (!YT) { toast("YouTube ne répond pas"); return; }
  const s = st(), same = s.pl === pl.id;
  ready = false;
  player = new YT.Player("ytmframe", {
    width: "200", height: "113", host: "https://www.youtube-nocookie.com",
    playerVars: { listType: "playlist", list: pl.id, index: same ? s.i || 0 : 0, start: same ? Math.floor(s.t || 0) : 0, autoplay: autoplay ? 1 : 0, playsinline: 1, rel: 0, modestbranding: 1 },
    events: {
      onReady: e => { ready = true; e.target.setVolume(s.vol == null ? 40 : s.vol); if (autoplay) e.target.playVideo(); },
      onStateChange: e => { const b = document.getElementById("ytmpp"); if (b) b.textContent = e.data === 1 ? "⏸" : "▶"; if (e.data === 1) { const d = e.target.getVideoData && e.target.getVideoData(); const t = document.getElementById("ytmt"); if (t && d && d.title) t.textContent = d.title; } }
    }
  });
  save({ pl: pl.id, on: 1 });
  clearInterval(saveT);
  saveT = setInterval(() => { if (!player || !ready || !player.getCurrentTime) return; try { save({ i: player.getPlaylistIndex(), t: player.getCurrentTime() }); } catch (e) {} }, 5000);
}
function stop() { clearInterval(saveT); try { if (player) player.destroy(); } catch (e) {} player = null; ready = false; if (box) { box.remove(); box = null; } save({ on: 0 }); }
ACT.ytm = el => {
  const a = el.dataset.a;
  if (a === "close") return stop();
  if (a === "min") { save({ min: st().min ? 0 : 1 }); if (box) box.classList.toggle("min"); el.textContent = st().min ? "▴" : "▾"; return; }
  if (a === "pick") {
    const L = playlists(), i = Math.max(0, L.findIndex(p => p.id === (curPl() || {}).id)), nx = L[(i + 1) % L.length];
    save({ pl: nx.id, i: 0, t: 0 }); stop(); save({ pl: nx.id }); start(true); toast("🎵 " + (nx.n || "Playlist")); return;
  }
  if (!player || !ready) return;
  if (a === "toggle") { if (player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo(); }
  if (a === "next") player.nextVideo();
  if (a === "prev") player.previousVideo();
};
document.addEventListener("input", e => { if (e.target.id === "ytmvol") { const v = +e.target.value; save({ vol: v }); if (player && ready) player.setVolume(v); } });
// bouton 🎵 en haut : ouvre / ferme le lecteur
export function ytmToggle() { if (box) stop(); else start(true); }
export const ytmOn = () => !!box;
// à l'ouverture : le lecteur revient s'il était allumé (lecture auto si le navigateur l'autorise)
export function ytmBoot() { if (playlists().length && st().on && !box) start(true); }
// une autre vidéo de l'app démarre -> pause
setInterval(() => { if (!player || !ready) return; const other = [...document.querySelectorAll(".player iframe, .player video")].length; if (other && player.getPlayerState && player.getPlayerState() === 1) player.pauseVideo(); }, 1500);
