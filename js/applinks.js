// Sur téléphone, « Regarder » ouvre l'appli (Netflix, YouTube) au lieu du site ; si l'appli n'est pas installée, le site s'ouvre.
const UA = navigator.userAgent || "";
export const isIOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isAndroid = /Android/i.test(UA);

function viaApp(u, host, iosScheme, pkg) {
  const m = u.match(/^https?:\/\/(?:www\.|m\.)?[^/]+(\/.*)?$/), path = (m && m[1]) || "/";
  if (isIOS) return iosScheme + "://" + host + path;
  if (isAndroid) return "intent://" + host + path + "#Intent;scheme=https;package=" + pkg + ";S.browser_fallback_url=" + encodeURIComponent(u) + ";end";
  return "";
}
export function appUrl(u) {
  if (/^https?:\/\/(www\.)?netflix\.com/i.test(u)) return viaApp(u, "www.netflix.com", "nflx", "com.netflix.mediaclient");
  if (/^https?:\/\/(www\.|m\.)?youtube\.com/i.test(u)) return viaApp(u, "www.youtube.com", "youtube", "com.google.android.youtube");
  if (/^https?:\/\/youtu\.be\//i.test(u)) return appUrl("https://www.youtube.com/watch?v=" + u.split("/").pop());
  return "";
}
export function openOut(u) {
  const app = appUrl(u);
  if (!app) return false;
  if (isAndroid) { location.href = app; return true; }      // l'intent ouvre le site tout seul si l'appli manque
  // iPhone : on tente l'appli ; si on est toujours là après 1,6 s, on ouvre le site
  let left = false;
  const gone = () => { left = true; };
  document.addEventListener("visibilitychange", gone, { once: true });
  window.addEventListener("pagehide", gone, { once: true });
  location.href = app;
  setTimeout(() => { if (!left && !document.hidden) location.href = u; }, 1600);
  return true;
}
// Tous les liens Netflix / YouTube de l'app passent par l'appli sur téléphone
document.addEventListener("click", e => {
  if (!isIOS && !isAndroid) return;
  const a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
  if (appUrl(a.href) && openOut(a.href)) { e.preventDefault(); e.stopPropagation(); }
}, true);
