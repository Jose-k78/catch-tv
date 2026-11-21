// Mode Univers (21 nov., heure du codage) : le calendrier des grands événements.
// Année 1 = les vrais PLE / PPV de 2026 de chaque promotion (data/univers-calendrier.json), au même jour de la semaine qu'en vrai.
// Chaque année suivante reprend les événements de l'année qui finit TELS QUE LE JOUEUR LES A LAISSÉS (renommés, supprimés, ajoutés),
// avec les numéros augmentés (WrestleMania 42 → 43, Triplemanía XXXIV → XXXV). On invente des noms seulement pour une fédé sans aucun événement.
// NXT a ses propres PLE (ev.br = "NXT"). Événements communs (co) : AAA à Worlds Collide, NJPW / CMLL / Stardom au Forbidden Door…
import { udata } from "./data.js";
import { dayOfDate, dateOf, lastSat, BIGNAMES } from "./world.js";

const ROM = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
const toRom = n => ROM.reduce((s, r) => { while (n >= r[0]) { s += r[1]; n -= r[0]; } return s; }, "");
const fromRom = s => { let n = 0, i = 0; ROM.forEach(r => { while (s.slice(i, i + r[1].length) === r[1]) { n += r[0]; i += r[1].length; } }); return i === s.length ? n : 0; };
// le numéro d'un événement augmente chaque année (pas les dates comme « 6.14 », ni « 5★Star »)
export function bumpName(n, k) {
  if (!k) return n; n = String(n || "");
  const m = n.match(/(^|\s)(\d{1,3})(?=$|\s|[—–-])/); if (m && !/\d[.★]|[.★]\d/.test(n)) return n.replace(m[0], m[1] + (+m[2] + k));
  const r = n.match(/(\s)([IVXLC]{2,})$/); if (r && fromRom(r[2])) return n.replace(/[IVXLC]{2,}$/, toRom(fromRom(r[2]) + k));
  return n;
}
// le jour de la partie le plus proche de cette date, le même jour de la semaine qu'en vrai (samedi reste samedi)
export function mapDay(y, m, dm, wd) {
  const b = dayOfDate(y, m, dm);
  for (const d of [0, -1, 1, -2, 2, -3, 3]) if ((1 + b + d) % 7 === wd) return b + d;
  return b;
}
const realWd = s => new Date(s + "T12:00:00Z").getUTCDay();
export const calData = () => (udata() || {}).cal || null;
const maniaRe = k => { const c = calData(), t = c && c.mania && c.mania[k]; return t ? new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null; };
// WWE avec un seul show : les PLE des autres shows (NXT ou roster principal) sont dirigés par leur GM
export function soloFlag(G, e) {
  if (!G.solo || e.fed !== G.me || e.kind === "tv") return;
  const mine = G.solo === "NXT" ? e.br === "NXT" : G.solo === "Evolve" ? e.br === "Evolve" : !e.br;
  if (mine) delete e.ai; else e.ai = true;
}
// les grands événements de l'année y pour toutes les fédérations
export function calYear(F, y, me, from) {
  const c = calData(), out = [];
  Object.keys(F).forEach(k => {
    const L = (c && c.feds && c.feds[k]) || [];
    if (!L.length) { for (let m = 0; m < 12; m++) { const d = lastSat(y, m); if (from != null && d <= from) continue; out.push({ id: k + "-cal-" + y + "-f" + m, fed: k, n: BIGNAMES[m % BIGNAMES.length], kind: F[k].big === "PLE" ? "ple" : "ppv", day: d, items: [], card: [], seg: [], done: false, cal: 1 }); } return; }
    L.forEach((x, i) => {
      const p = x.d.split("-"), md = [+p[1] - 1, +p[2]], wd = realWd(x.d), day = mapDay(y, md[0], md[1], wd); if (from != null && day <= from) return;
      const co = (x.co || []).filter(f => F[f]);
      const base = { n: bumpName(x.t, y - 1), kind: F[k].big === "PLE" ? "ple" : "ppv", day: day, items: [], card: [], seg: [], done: false, cal: 1, md: md, wdk: wd, br: x.br || "" };
      // l'organisateur (si c'est moi, mes partenaires sont réservables ; si c'est l'IA, elle mélange avec un partenaire qui n'est pas moi)
      const pt = co.filter(f => f !== me)[0] || "";
      out.push(Object.assign({ id: k + "-cal-" + y + "-" + i, fed: k }, base, pt ? { part: pt } : {}));
      // je suis associé à l'événement : j'ai le mien, avec les catcheurs de l'organisateur
      if (me && me !== k && co.indexOf(me) >= 0) out.push(Object.assign({ id: me + "-cal-" + y + "-" + k + i, fed: me, part: k }, base, { kind: F[me].big === "PLE" ? "ple" : "ppv", br: "" }));
    });
  });
  return out;
}
// le plus grand show de l'année pour une fédé
export function maniaOf(G, k, y) {
  const L = G.ev.filter(e => e.fed === k && (e.kind === "ple" || e.kind === "ppv") && dateOf(e.day).y === y && !e.ai).sort((a, b) => a.day - b.day), re = maniaRe(k);
  return ((re && L.find(e => re.test(e.n))) || L[3] || L[L.length - 1] || {}).id || "";
}
// passage à l'année suivante : on recopie l'année qui finit, avec les changements du joueur
export function calNext(G, y) {
  const yy = y + 1, newMania = {};
  Object.keys(G.F).forEach(k => {
    const cur = G.ev.filter(e => e.fed === k && (e.kind === "ple" || e.kind === "ppv") && dateOf(e.day).y === y && !/-co\d|-co$/.test(e.id) && !e.once), seen = new Set();
    if (!cur.length) { calYear({ [k]: G.F[k] }, yy, G.me).forEach(e => G.ev.push(e)); return; }
    cur.sort((a, b) => a.day - b.day).forEach((e, i) => {
      const key = e.n + "|" + (e.br || ""); if (seen.has(key)) return; seen.add(key);
      const t = dateOf(e.day), md = e.md || [t.m, t.dm], wd = e.wdk != null ? e.wdk : t.wd;
      const n = { id: k + "-cal-" + yy + "-" + i, fed: k, n: bumpName(e.n, 1), kind: e.kind, day: mapDay(yy, md[0], md[1], wd), items: [], card: [], seg: [], done: false, cal: 1, md: md, wdk: wd, br: e.br || "" };
      if (e.part) n.part = e.part; if (e.ai) n.ai = true;
      G.ev.push(n); if (G.mania === e.id) newMania.id = n.id;
    });
  });
  G.mania = newMania.id || maniaOf(G, G.me, yy);
}
// une ancienne partie passe au vrai calendrier : les grands événements à venir, pas encore préparés, sont remplacés
export function calUpgrade(G) {
  if (G.calv === 1) return; G.calv = 1;
  if (!calData()) { G.calv = 0; return; }
  const y = dateOf(G.day).y, keepMania = G.ev.find(e => e.id === G.mania);
  G.ev = G.ev.filter(e => !(/-big-/.test(e.id) && !e.done && !(e.items || []).length && e.day > G.day + 1));
  calYear(G.F, y, G.me, G.day + 1).forEach(e => { if (!G.ev.some(x => x.fed === e.fed && x.n === e.n && Math.abs(x.day - e.day) < 5)) G.ev.push(e); });
  G.ev.forEach(e => soloFlag(G, e));
  if (!keepMania || !G.ev.some(e => e.id === G.mania)) G.mania = maniaOf(G, G.me, y);
}

// AAA est liée à la WWE (choix de Jose) : fédé à part (son calendrier, ses titres) mais partenaire pour toujours ; catcheurs partagés
export const SISTER = { WWE: "AAA", AAA: "WWE" };
export function sisterLink(G) {
  const o = SISTER[G.me]; if (!o || !G.F[o]) return;
  G.part = G.part || {}; const p = G.part[o] || (G.part[o] = { rel: 0, deal: null });
  if (!p.sis) { p.sis = 1; p.rel = Math.max(p.rel || 0, 40); p.deal = { since: G.day, until: 9999999, sis: 1 }; }
  else if (p.deal) p.deal.until = 9999999;
}
// l'IA de la WWE ou de l'AAA invite parfois des catcheurs de la fédé sœur dans ses shows
export const sisterGuests = (G, ev, rnd) => { const o = SISTER[ev.fed]; if (!o || !G.F[o] || ev.fed === G.me || o === G.me || rnd() > (ev.kind === "tv" ? 0.15 : 0.35)) return []; return Object.values(G.W).filter(w => w.fed === o && !w.ret && w.pop >= 45).sort(() => rnd() - 0.5).slice(0, 2); };
