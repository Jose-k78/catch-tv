// Petits outils partagés
export const MOIS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];

export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
// URL utilisable dans un style CSS background-image
export function cssUrl(u) {
  return 'url("' + String(u).replace(/["\\\n\r]/g, c => encodeURIComponent(c)) + '")';
}
export function okHttp(u) { return typeof u === "string" && /^https?:\/\/[^\s"<>]+$/.test(u); }
export function okImg(u) { return okHttp(u) || (typeof u === "string" && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u)); }
export function okDay(d) { return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d); }

export function today() { const t = new Date(); t.setHours(0,0,0,0); return t; }
export function dt(s) { const p = s.split("-"); return new Date(+p[0], +p[1]-1, +p[2]); }
export function ymd(x) { return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); }
export function fmt(s) {
  if (!s) return "À confirmer";
  const x = dt(s);
  return x.getDate()+" "+MOIS[x.getMonth()]+(x.getFullYear() !== today().getFullYear() ? " "+x.getFullYear() : "");
}
export function fmtMs(ms, withYear) {
  if (!ms) return "";
  const x = new Date(ms);
  return x.getDate()+" "+MOIS[x.getMonth()]+((withYear || x.getFullYear() !== new Date().getFullYear()) ? " "+x.getFullYear() : "");
}
export function diff(s) { return s ? Math.round((dt(s) - today()) / 864e5) : 9999; }
export function cd(s) {
  if (!s) return "À confirmer";
  const n = diff(s);
  return n < 0 ? "Terminé" : n === 0 ? "Aujourd’hui" : n === 1 ? "Demain" : "Dans "+n+" jours";
}
// prochaine date (aujourd'hui compris) pour un jour de semaine 0-6
export function nextWeekday(w) { const x = today(); x.setDate(x.getDate() + ((w - x.getDay() + 7) % 7)); return ymd(x); }

export function timeLabel(ms) {
  if (!ms) return "";
  const d = new Date(ms), now = new Date();
  if (d.toDateString() === now.toDateString()) return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
  const y = new Date(now); y.setDate(now.getDate()-1);
  if (d.toDateString() === y.toDateString()) return "Hier";
  return fmtMs(ms);
}
export function dayLabel(ms) {
  const d = new Date(ms), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Aujourd’hui";
  const y = new Date(now); y.setDate(now.getDate()-1);
  if (d.toDateString() === y.toDateString()) return "Hier";
  return fmtMs(ms, true);
}
export function hhmm(ms) { const d = new Date(ms); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }

export function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
export function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

export function toast(text, opts) {
  opts = opts || {};
  if (opts.top) document.querySelectorAll(".toast.top").forEach(t => t.remove());
  const d = document.createElement(opts.onClick ? "button" : "div");
  d.className = "toast" + (opts.top ? " top" : "");
  d.textContent = text;
  if (opts.onClick) d.addEventListener("click", () => { d.remove(); opts.onClick(); });
  document.body.appendChild(d);
  setTimeout(() => d.remove(), opts.ms || 2600);
  return d;
}

// Fenêtre modale simple. build(box, close) remplit la boîte.
export function modal(build) {
  const wrap = document.createElement("div");
  wrap.className = "modal";
  wrap.innerHTML = '<div class="modalbox" role="dialog" aria-modal="true"></div>';
  const box = wrap.firstChild;
  const close = () => { wrap.remove(); document.body.classList.remove("noscroll"); };
  wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
  document.body.appendChild(wrap);
  document.body.classList.add("noscroll");
  build(box, close);
  return close;
}

// Recadre / réduit une image choisie et renvoie une data URL JPEG
export function fileToDataUrl(file, maxW, maxH, square) {
  return new Promise((resolve, reject) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(u);
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
      const r = Math.min(1, maxW / sw, maxH / sh);
      const c = document.createElement("canvas");
      c.width = Math.round(sw * r); c.height = Math.round(sh * r);
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      let q = 0.85, out = c.toDataURL("image/jpeg", q);
      while (out.length > 700000 && q > 0.4) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error("image")); };
    img.src = u;
  });
}

export function docId(s) { return String(s).replace(/\//g, "∕").replace(/^\.+$/, "_").slice(0, 300); }

export const ICON = {
  user: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 9 9 0 0 1-3.9-.9L3 20.5l1.6-4.6a8 8 0 0 1-1.1-4.4A8.4 8.4 0 0 1 12.5 3.2 8.4 8.4 0 0 1 21 11.5z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.6 21 12 3.4 3.4l-.1 6.7L15 12 3.3 13.9z"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  group: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.8"/><path d="M2 20c0-3.6 3.1-6 7-6s7 2.4 7 6z"/><path d="M15.5 14.2c3.6.1 6.5 2.2 6.5 5.8h-4.5c0-2.3-.8-4.3-2-5.8z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/></svg>',
  starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/></svg>',
  starF: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
};
export function stars(n) {
  let h = '<span class="stars" aria-label="'+n+' sur 5">';
  for (let i = 1; i <= 5; i++) h += '<span class="st'+(i <= n ? " on" : "")+'">'+ICON.star+'</span>';
  return h + "</span>";
}
