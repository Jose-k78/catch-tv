// Heures des shows : heure de Paris + heure locale du show (changements d'heure et de jour gérés par Intl),
// jour « feud » (minuit-minuit, heure de Paris), fichier .ics pour « Me rappeler »
import { MOIS } from "./util.js";

export const PARIS = "Europe/Paris";
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CITY = {
  "America/New_York": "New York", "America/Chicago": "Chicago", "America/Denver": "Denver", "America/Phoenix": "Phoenix",
  "America/Los_Angeles": "Los Angeles", "America/Edmonton": "Edmonton", "America/Toronto": "Toronto", "America/Mexico_City": "Mexico",
  "Asia/Tokyo": "Tokyo", "Asia/Riyadh": "Riyad", "Australia/Perth": "Perth", "Europe/London": "Londres", "Europe/Paris": "Paris",
};
const pad = n => String(n).padStart(2, "0");

const fmts = {};
function parts(ms, tz) {
  let f = fmts[tz];
  if (!f) {
    try { f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }); }
    catch (e) { f = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }); }
    fmts[tz] = f;
  }
  const o = {}; f.formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, wd: WD.indexOf(o.weekday) };
}
// écart (ms) entre l'heure locale du fuseau et l'heure UTC à cet instant
function offset(tz, ms) { const p = parts(ms, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ms / 6e4) * 6e4; }

// « 2026-11-03 » + « 20:00 » dans le fuseau tz -> instant (ms UTC)
export function zoned(day, hm, tz) {
  const a = String(day).split("-").map(Number), b = String(hm).split(":").map(Number);
  const guess = Date.UTC(a[0], a[1] - 1, a[2], b[0] || 0, b[1] || 0);
  let t = guess - offset(tz, guess);
  const o2 = offset(tz, t); if (guess - o2 !== t) t = guess - o2;
  return t;
}
export function dayIn(ms, tz) { const p = parts(ms, tz); return p.y + "-" + pad(p.m) + "-" + pad(p.d); }
export function parisDay(ms) { return dayIn(ms || Date.now(), PARIS); }
export function parisHour(ms) { return parts(ms || Date.now(), PARIS).h; }
export function parisMin(ms) { const p = parts(ms || Date.now(), PARIS); return p.h * 60 + p.mi; }
export function parisWeekday(ms) { return parts(ms || Date.now(), PARIS).wd; }
export function prevDay(d) { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); }
const hm = p => pad(p.h) + " h " + pad(p.mi);
export function fmtAt(ms, tz) { const p = parts(ms, tz); return JOURS[p.wd] + " " + p.d + " " + MOIS[p.m - 1] + " " + hm(p); }
export function hourAt(ms, tz) { return hm(parts(ms, tz)); }
export function cityOf(tz) { return CITY[tz] || String(tz).split("/").pop().replace(/_/g, " "); }

// Début d'un élément du calendrier (épisode ou PLE) s'il a une heure connue
export function startOf(e) { return e && e.h && e.tz && e.d ? zoned(e.d, e.h, e.tz) : 0; }
export function endOf(e) { const t = startOf(e); return t ? t + (e.dur || 180) * 6e4 : 0; }
export function isLive(e, now) { const t = startOf(e); now = now || Date.now(); return !!t && now >= t && now < endOf(e); }

// « mar. 4 nov. 02 h 00 à Paris · lun. 3 nov. 20 h 00 à New York »
export function whenParts(e) {
  const t = startOf(e); if (!t) return null;
  return { paris: fmtAt(t, PARIS), local: e.tz === PARIS ? "" : fmtAt(t, e.tz) + " à " + (e.city || cityOf(e.tz)) };
}

// ---------- « Me rappeler » : fichier calendrier .ics ----------
const icsEsc = s => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function fold(line) { let out = "", s = line; while (s.length > 74) { out += s.slice(0, 74) + "\r\n "; s = s.slice(74); } return out + s; }
export function icsFor(e, desc) {
  const t = startOf(e), uid = (e.k + "-" + e.t + "-" + (e.d || "")).replace(/[^\w-]+/g, "-") + "@tcc-tv";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TCC TV//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp(Date.now())];
  if (t) { L.push("DTSTART:" + stamp(t), "DTEND:" + stamp(t + (e.dur || 180) * 6e4)); }
  else {
    const d = String(e.d).replace(/-/g, ""), x = new Date(e.d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1);
    L.push("DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + x.toISOString().slice(0, 10).replace(/-/g, ""));
  }
  L.push("SUMMARY:" + icsEsc(e.k + " · " + e.t));
  if (e.v || e.w) L.push("LOCATION:" + icsEsc([e.v, e.w].filter(x => x && x !== "—").join(", ")));
  if (desc) L.push("DESCRIPTION:" + icsEsc(desc));
  if (e.l) L.push("URL:" + e.l);
  L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(e.t + " commence bientôt"), "TRIGGER:" + (t ? "-PT1H" : "-PT6H"), "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
export function downloadIcs(e, desc) {
  const blob = new Blob([icsFor(e, desc)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (e.t || "evenement").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() + ".ics";
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
