// Fonds animés derrière les onglets (petites vidéos MP4 en boucle, sans son) et musique de fond,
// choisis par l'admin dans Modération (data/media.json + fichiers dans media/).
import { S, ACT } from "./state.js";
import { esc, lsGet, lsSet, toast } from "./util.js";

const okPath = u => typeof u === "string" && (/^media\/[\w./-]+\.(?:mp4|mov|webm|mp3|m4a)$/i.test(u) || /^https:\/\/[^\s"<>]+$/i.test(u));
// économie de données ou animations réduites demandées par le téléphone : pas de vidéo
const lite = () => { try { return !!(navigator.connection && navigator.connection.saveData) || matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

// ---------- fonds animés ----------
// clés : "home" (accueil), "WWE" (promotion), "WWE|Raw" (show) ; un show sans vidéo reprend celle de sa promotion
export const bgKey = (k, n) => !k ? "home" : n ? k + "|" + n : k;
export function bgFor(route) {
  const m = (S.media && S.media.bg) || {};
  if (route.name === "home") return m.home || null;
  if (route.name !== "promo") return null;
  return (route.n && m[bgKey(route.k, route.n)]) || m[route.k] || null;
}
let curBg = "";
export function mountBg(route) {
  const wrap = document.getElementById("tabwrap"), box = document.getElementById("tabbg"); if (!wrap || !box) return;
  const b = lite() ? null : bgFor(route), u = b && okPath(b.u) ? b.u : "";
  wrap.classList.toggle("hasbg", !!u);
  if (u === curBg) { const v = box.querySelector("video"); if (v && v.paused) v.play().catch(() => {}); return; }
  curBg = u;
  box.innerHTML = u ? '<video muted loop playsinline autoplay preload="auto" disablepictureinpicture disableremoteplayback src="' + esc(u) + '"></video>' : "";
  const v = box.querySelector("video"); if (!v) return;
  v.muted = true; v.defaultMuted = true;
  v.addEventListener("error", () => { if (curBg === u) { wrap.classList.remove("hasbg"); box.innerHTML = ""; } });
  const p = v.play(); if (p && p.catch) p.catch(() => {});
}
document.addEventListener("visibilitychange", () => { const v = document.querySelector("#tabbg video"); if (v && !document.hidden) v.play().catch(() => {}); });

// ---------- musique de fond ----------
let audio = null, armed = false;
const music = () => { const m = S.media && S.media.music; return m && okPath(m.u) ? m : null; };
export const musicOn = () => lsGet("ctv.music") !== "off";
// pas de musique pendant qu'une vidéo est en lecture dans l'app
const videoPlaying = () => !!document.querySelector(".player iframe, .player video");
function ensure() {
  const m = music(); if (!m) { if (audio) { audio.pause(); audio = null; } return null; }
  if (!audio || audio.dataset.u !== m.u) {
    if (audio) audio.pause();
    audio = new Audio(m.u); audio.loop = true; audio.preload = "auto"; audio.dataset.u = m.u;
  }
  audio.volume = Math.min(1, Math.max(0, m.vol == null ? 0.4 : +m.vol));
  return audio;
}
function play() { const a = ensure(); if (!a || !musicOn() || videoPlaying() || document.hidden) return; a.dataset.started = "1"; const p = a.play(); if (p && p.catch) p.catch(() => {}); }
function pause() { if (audio) audio.pause(); }
// Les navigateurs n'autorisent le son qu'après un premier appui : on attend celui qui suit l'intro
export function armMusic() {
  updateMusicBtn();
  if (armed || !music()) return;
  armed = true;
  const go = () => {
    if (document.documentElement.classList.contains("introon")) return; // l'appui sert à passer l'intro
    document.removeEventListener("pointerdown", go, true); play();
  };
  document.addEventListener("pointerdown", go, true);
}
setInterval(() => { if (!audio) return; if (videoPlaying() && !audio.paused) audio.pause(); else if (!videoPlaying() && audio.paused && musicOn() && !document.hidden && armed && audio.dataset.started) play(); }, 1500);
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else if (audio && audio.dataset.started) play(); });
export function updateMusicBtn() {
  const b = document.getElementById("musicbtn"); if (!b) return;
  b.hidden = !music();
  b.textContent = musicOn() ? "🔊" : "🔇";
  b.setAttribute("aria-label", musicOn() ? "Couper la musique" : "Mettre la musique");
}
ACT.music = () => {
  const on = !musicOn();
  lsSet("ctv.music", on ? null : "off");
  if (on) play(); else pause();
  updateMusicBtn();
  toast(on ? "🔊 Musique activée" : "🔇 Musique coupée");
};
// Admin : après un changement dans Modération
export function refreshMedia(route) { curBg = curBg + "#"; mountBg(route); if (audio) { const was = !audio.paused; ensure(); if (was) play(); } armMusic(); }
