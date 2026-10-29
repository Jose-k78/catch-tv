// Robot TCC TV — notifications envoyées toutes les 30 minutes (après le robot actu et vidéos) :
//  📰 les infos qui apparaissent (nouveaux articles, défenses de titre sous spoiler, PLE du jour, pronostics bientôt fermés,
//     nouveaux sondages, storyline du jour), ⭐ les matchs des catcheurs favoris (annoncés, puis le jour J),
//  🔥 le rappel de 21 h quand une feud va s'éteindre à minuit.
// Chaque membre choisit ses notifications dans l'app (document push/{uid}) ; heures calmes de 23 h à 8 h pour les infos et les favoris.
// Ce qui a déjà été envoyé est retenu dans data/push-state.json. Sans la clé FIREBASE_SA (secret GitHub), rien n'est envoyé.
import fs from "node:fs";
import { getDoc, listDocs, sendTo, wants, parisDay, parisHour, prevDay, PARIS } from "../../cloudflare/push-core.mjs";

const read = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } };
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'");
const hash = s => { let h = 5381; s = norm(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const fmtD = d => { const p = String(d).split("-"); return (+p[2]) + " " + MOIS[+p[1] - 1]; };
const STATE = "data/push-state.json";

// ---------- heures (fuseau du lieu -> Paris) ----------
function parts(ms, tz) {
  const o = {}; new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute };
}
function zoned(day, hm, tz) {
  const a = String(day).split("-").map(Number), b = String(hm).split(":").map(Number), g = Date.UTC(a[0], a[1] - 1, a[2], b[0] || 0, b[1] || 0);
  const off = ms => { const p = parts(ms, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Math.floor(ms / 6e4) * 6e4; };
  let t = g - off(g); const o2 = off(t); if (g - o2 !== t) t = g - o2; return t;
}
const hourParis = ms => { const p = parts(ms, PARIS); return String(p.h).padStart(2, "0") + " h " + String(p.mi).padStart(2, "0"); };
const dayParis = ms => { const p = parts(ms, PARIS); return p.y + "-" + String(p.m).padStart(2, "0") + "-" + String(p.d).padStart(2, "0"); };
const startOf = e => (e.h && e.tz && e.d ? zoned(e.d, e.h, e.tz) : 0);

// ---------- ce qui est nouveau ----------
export function collect(now, data) {
  const today = parisDay(now), hour = parisHour(now), yday = prevDay(today), cal = data.cal, out = [];
  const ples = []; Object.keys(cal).forEach(k => (cal[k].e || []).forEach(e => { if (e && e.d) ples.push(Object.assign({ k: k }, e)); }));
  const evUrl = e => "#/ev/" + encodeURIComponent(e.k) + "/PLE/" + e.d;
  // 📰 articles (robot + actu du matin), d'aujourd'hui ou d'hier
  const seenU = {};
  (data.feed.items || []).concat(data.news.items || []).forEach(a => {
    if (!a || !a.u || !a.t || seenU[a.u] || String(a.d) < yday) return; seenU[a.u] = 1;
    out.push({ key: "a:" + a.u, cat: "info", kind: "art", tags: Array.isArray(a.tags) ? a.tags : [], t: a.t, s: a.s || "", u: a.u });
  });
  // 🙈 défenses et changements de titre des 2 derniers jours (texte neutre : pas de spoiler)
  (data.titles || []).forEach(t => {
    if (!t || !t.id || !cal[t.k]) return;
    const shows = cal[t.k].s || {}, where = (ev, d) => { const n = Object.keys(shows).find(x => ev && (ev === x || String(ev).indexOf(x) === 0)); const ple = (cal[t.k].e || []).find(x => x.d === d); return n ? { show: n, label: t.k + " " + n } : { show: "PLE", label: ple ? ple.t : t.k + (ev ? " " + ev : "") }; };
    const add = (kind, d, ev) => { if (!d || d < prevDay(yday) || d > today) return; const w = where(ev, d); out.push({ key: "t:" + t.id + ":" + d + ":" + kind, cat: "info", kind: "def", k: t.k, d: d, label: w.label, url: "#/hl/" + encodeURIComponent(t.k) + "/" + encodeURIComponent(w.show) + "/" + d }); };
    if (t.since) add("c", t.since, t.ev);
    (Array.isArray(t.defs) ? t.defs : []).forEach(x => { if (x && x.d) add("d" + hash(x.vs || ""), x.d, x.ev); });
  });
  // ⏳ PLE du jour (à partir de 9 h)
  ples.forEach(e => { const st = startOf(e); if ((e.d === today || (st && dayParis(st) === today && st > now)) && hour >= 9) out.push({ key: "ple:" + e.k + ":" + e.d, cat: "info", kind: "ple", k: e.k, title: "⏳ " + e.t + " (" + e.k + ") aujourd’hui", body: st ? "Début à " + hourParis(st) + " (heure de Paris)" + (dayParis(st) !== e.d ? ", dans la nuit" : "") : "Bon show !", url: evUrl(e) }); });
  // 🎯 pronostics fermés dans moins de 3 h
  ples.forEach(e => { const st = startOf(e), card = (e.card || []).filter(l => / contre /i.test(l)); if (st && card.length && st > now && st - now <= 3 * 3600e3) out.push({ key: "pick:" + e.k + ":" + e.d, cat: "info", kind: "pick", k: e.k, title: "🎯 Pronostics de " + e.t, body: "Derniers instants : fermeture à " + hourParis(st) + " (heure de Paris)", url: "#/pronostic/" + encodeURIComponent(e.k) + "/" + e.d }); });
  // 📊 nouveaux sondages, 📖 storyline du jour
  (data.polls || []).forEach(p => { if (p && p.id && p.q && p.d === today) out.push({ key: "poll:" + p.id, cat: "info", kind: "poll", k: p.k || "", q: p.q }); });
  const st = (data.stories || [])[0]; if (st && st.id && st.d === today) out.push({ key: "story:" + st.id, cat: "info", kind: "story", k: "", title: "📖 Storyline du jour", body: st.t, url: "#/storyline/" + encodeURIComponent(st.id) });
  // ⭐ matchs annoncés (nouvelle ligne sur la carte d'un PLE à venir) et le jour J
  ples.forEach(e => {
    if (e.d < today || !Array.isArray(e.card)) return;
    e.card.forEach(l => { if (l) out.push({ key: "c:" + e.k + ":" + e.d + ":" + hash(l), cat: "fav", kind: "card", k: e.k, ev: e, line: l }); });
    const s = startOf(e);
    if (e.card.length && ((s && s > now && s - now <= 10 * 3600e3) || (!s && e.d === today && hour >= 12))) out.push({ key: "fd:" + e.k + ":" + e.d, cat: "fav", kind: "day", k: e.k, ev: e, start: s });
  });
  // 🔥 rappel des feuds à 21 h
  if (hour >= 21) out.push({ key: "fr:" + today, cat: "feud", kind: "feudrem" });
  return out;
}
const nameIn = (line, name) => { const n = norm(name).trim(); if (n.length < 3) return false; const l = " " + norm(line).replace(/[^a-z0-9' .-]/g, " ") + " "; return new RegExp("[^a-z0-9]" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^a-z0-9]").test(l); };

// messages d'un membre pour les nouveautés de ce passage
export function messagesFor(user, fresh) {
  const P = Array.isArray(user.promos) ? user.promos : [], okK = k => !P.length || !k || P.indexOf(k) >= 0;
  const msgs = [];
  if (wants(user, "info")) {
    const arts = fresh.filter(x => x.kind === "art" && (!P.length || !x.tags.length || x.tags.some(t => P.indexOf(t) >= 0)));
    if (arts.length === 1) msgs.push({ cat: "info", title: "📰 " + (arts[0].s || "Nouvelle info"), body: arts[0].t, url: arts[0].u, tag: "art", short: arts[0].t });
    else if (arts.length) msgs.push({ cat: "info", title: "📰 " + arts.length + " nouvelles infos", body: arts.slice(0, 3).map(a => a.t).join(" · "), url: "#/", tag: "art", short: arts.length + " nouvelles infos" });
    const defs = {}; fresh.filter(x => x.kind === "def" && okK(x.k)).forEach(x => { const g = x.label + "|" + x.d; (defs[g] = defs[g] || []).push(x); });
    Object.keys(defs).forEach(g => { const l = defs[g], x = l[0]; msgs.push({ cat: "info", title: "🙈 " + (l.length > 1 ? l.length + " défenses de titre" : "Défense de titre") + " à " + x.label, body: "Show du " + fmtD(x.d) + " — ouvre pour voir (spoiler)", url: x.url, tag: "def-" + g, short: "🙈 Défense de titre à " + x.label }); });
    fresh.filter(x => (x.kind === "ple" || x.kind === "pick" || x.kind === "story") && okK(x.k)).forEach(x => msgs.push({ cat: "info", title: x.title, body: x.body, url: x.url, tag: x.kind, short: x.title }));
    const polls = fresh.filter(x => x.kind === "poll" && okK(x.k));
    if (polls.length) msgs.push({ cat: "info", title: polls.length > 1 ? "📊 " + polls.length + " nouveaux sondages" : "📊 Nouveau sondage", body: polls.map(p => p.q).join(" · "), url: "#/sondages", tag: "poll", short: polls.length > 1 ? polls.length + " nouveaux sondages" : "📊 " + polls[0].q });
  }
  const favs = Array.isArray(user.favs) ? user.favs : [];
  if (wants(user, "fav") && favs.length) {
    fresh.filter(x => x.kind === "card").forEach(x => { const f = favs.filter(n => nameIn(x.line, n)); if (f.length) msgs.push({ cat: "fav", title: "⭐ " + f.join(", ") + " annoncé" + (f.length > 1 ? "s" : "") + " à " + x.ev.t, body: x.line, url: "#/ev/" + encodeURIComponent(x.k) + "/PLE/" + x.ev.d, tag: "fav-" + x.k + x.ev.d, short: "⭐ " + f.join(", ") + " à " + x.ev.t }); });
    fresh.filter(x => x.kind === "day").forEach(x => {
      const f = favs.filter(n => x.ev.card.some(l => nameIn(l, n))); if (!f.length) return;
      msgs.push({ cat: "fav", title: "⭐ " + f.join(", ") + " combat" + (f.length > 1 ? "tent" : "") + " " + (x.start && dayParis(x.start) !== parisDay(Date.now()) ? "cette nuit" : "aujourd’hui"), body: x.ev.t + (x.start ? " · début à " + hourParis(x.start) + " (heure de Paris)" : ""), url: "#/ev/" + encodeURIComponent(x.k) + "/PLE/" + x.ev.d, tag: "favday-" + x.k + x.ev.d, short: "⭐ " + f.join(", ") + " · " + x.ev.t });
    });
  }
  return msgs;
}
// plus de 3 messages d'un coup : un seul résumé
export function pack(msgs) {
  if (msgs.length <= 3) return msgs;
  return [{ title: "📰 " + msgs.length + " nouveautés sur TCC TV", body: msgs.slice(0, 4).map(m => m.short || m.title).join(" · "), url: "#/", tag: "digest" }];
}
const quietNow = (u, hour) => u.quiet !== false && (hour >= 23 || hour < 8);

// ---------- passage ----------
async function main() {
  const SA = process.env.FIREBASE_SA ? JSON.parse(process.env.FIREBASE_SA) : null;
  const now = Date.now(), hour = parisHour(now), today = parisDay(now);
  const data = { cal: read("data/calendar.json", {}).promotions || {}, feed: read("data/feed.json", {}), news: read("news.json", {}), titles: read("data/titles.json", {}).titles || [],
    polls: read("data/polls.json", {}).items || [], stories: read("data/storylines.json", {}).items || [] };
  const first = !fs.existsSync(STATE), state = read(STATE, { sent: {}, pend: {} });
  state.sent = state.sent || {}; state.pend = state.pend || {};
  const all = collect(now, data), fresh = all.filter(x => !state.sent[x.key]);
  const mark = () => { fresh.forEach(x => { state.sent[x.key] = today; }); };
  // premier passage : on retient l'existant sans rien envoyer
  // (sans clé, on tient aussi l'état à jour : le jour où la clé est ajoutée, seules les vraies nouveautés partent)
  if (first || !SA) { mark(); if (first || fresh.length) write(state, now, !!SA); console.log(first ? "Notifications : premier passage, état initial enregistré" : "Notifications : pas de clé FIREBASE_SA, rien à envoyer"); return; }
  const pendWas = JSON.stringify(state.pend);
  const pushes = await listDocs(SA, "push");
  const members = pushes.filter(p => p.tok && Object.keys(p.tok).length);
  if (!members.length) { mark(); write(state, now, !!SA); console.log("Notifications : aucun téléphone inscrit"); return; }
  const needUsers = fresh.some(x => x.cat === "fav" || x.cat === "feud");
  const users = {}; if (needUsers) (await listDocs(SA, "users", ["favs", "pseudo"])).forEach(u => { users[u._id] = u; });
  let sent = 0;
  for (const p of members) {
    const u = Object.assign({}, p, { favs: (users[p._id] || {}).favs || [] });
    let msgs = messagesFor(u, fresh.filter(x => x.cat !== "feud"));
    if (quietNow(u, hour)) { if (msgs.length) state.pend[p._id] = (state.pend[p._id] || []).concat(msgs).slice(-20); msgs = []; }
    else if ((state.pend[p._id] || []).length) { msgs = state.pend[p._id].concat(msgs); delete state.pend[p._id]; }
    for (const m of pack(msgs)) sent += await sendTo(SA, p._id, p, m);
  }
  // 🔥 21 h : les feuds qui vont s'éteindre à minuit
  if (fresh.some(x => x.kind === "feudrem")) {
    const byUid = {}; members.forEach(p => { byUid[p._id] = p; });
    for (const f of await listDocs(SA, "feuds")) {
      const m = Array.isArray(f.members) ? f.members : []; if (m.length !== 2) continue;
      const days = f.days || {}, n = f.countDay === today || f.countDay === prevDay(today) ? (f.count || 0) : 0;
      for (let i = 0; i < 2; i++) {
        const me = m[i], o = m[1 - i], p = byUid[me];
        if (!p || !wants(p, "feud") || days[me] === today || !(n > 0 || days[o] === today)) continue;
        const name = (users[o] || {}).pseudo || "ton rival";
        sent += await sendTo(SA, me, p, { title: "🔥 Feud", body: n > 0 ? "Ta feud de " + n + " jour" + (n > 1 ? "s" : "") + " avec " + name + " s’éteint à minuit !" : name + " t’a lancé une feud : renvoie-la avant minuit", url: "#/profil/" + o, tag: "feudrem-" + f._id });
      }
    }
  }
  mark();
  if (fresh.length || JSON.stringify(state.pend) !== pendWas || state.sa !== true) write(state, now, !!SA);
  console.log("Notifications :", fresh.length, "nouveautés,", sent, "envois");
}
function write(state, now, sa) {
  const lim = prevDay(prevDay(parisDay(now - 12 * 864e5)));
  Object.keys(state.sent).forEach(k => { if (state.sent[k] < lim) delete state.sent[k]; });
  fs.writeFileSync(STATE, JSON.stringify({ at: new Date(now).toISOString(), sa: sa, sent: state.sent, pend: state.pend }, null, 1) + "\n");
}
if (!process.env.NOTIFY_TEST) main().catch(e => { console.log("Notifications : erreur", e.message); });
