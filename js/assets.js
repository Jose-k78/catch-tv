// Images fournies par l'admin (dossiers de Jose) : logos des shows, logos des grands événements, ceintures des titres,
// logos des tag teams / factions. Liste dans data/logos.json = { shows, events, titles, groups } :
// { "Nom du fichier": { f: "fichier.webp", v: [anciennes versions] } } — la version la plus récente est toujours en premier.
// Les groupes (tag teams, factions) sont décrits dans data/groups.json (membres, anciens membres, années, matchs de référence).
import { S } from "./state.js";
import { esc } from "./util.js";
import { norm, wInfo } from "./wrestlers.js";

const DIR = { shows: "img/shows/", events: "img/events/", titles: "img/titres/", groups: "img/groupes/" };
const okF = f => typeof f === "string" && /^[\w.-]+\.(?:webp|png|jpe?g)$/i.test(f);
const key = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const tight = s => key(s).replace(/ /g, "");
export const artSrc = (sec, f) => (/^data:image\/(?:webp|png);base64,/.test(String(f)) ? f : okF(f) ? DIR[sec] + f : ""); // data: = aperçu tout-en-un
export function art(sec, name) {
  const it = ((S.art || {})[sec] || {})[name];
  return it ? artSrc(sec, it.f) : "";
}
export function artVersions(sec, name) {
  const it = ((S.art || {})[sec] || {})[name];
  return it && Array.isArray(it.v) ? it.v.map(f => artSrc(sec, f)).filter(Boolean) : [];
}

// ---------- logos des shows et des promotions ----------
const SHOW = { Raw: "RAW", SmackDown: "Smackdown", NXT: "NXT", Evolve: "EVOLVE", Dynamite: "Dynamite", Collision: "AEW Collision", Rampage: "Rampage",
  "Lucha Libre AAA": "AAA", "ROH TV": "ROH", Impact: "TNA", "205 Live": "205" };
const PROMO = { WWE: "WWE", AEW: "AEW", AAA: "AAA", ROH: "ROH", TNA: "TNA", CMLL: "CMLL", NJPW: "NJPW", Stardom: "STARDOM", Marigold: "Marigold" };
export function showLogo(k, n) {
  if (n && SHOW[n] && art("shows", SHOW[n])) return art("shows", SHOW[n]);
  if (n && art("shows", n)) return art("shows", n);
  return PROMO[k] ? art("shows", PROMO[k]) : "";
}

// ---------- logos des grands événements (Royal Rumble, Wrestle Kingdom…) ----------
const EVP = { WWE: ["WWE", "NXT", "NXTUK"], AEW: ["AEW"], ROH: ["ROH"], TNA: ["TNA", "Impact", "IMPACT"], NJPW: ["NJPW", "NJoA"], Stardom: ["STARDOM"], Marigold: ["Marigold"], AAA: ["AAA"], CMLL: ["CMLL"] };
let evIdx = null, evOf = null;
function evIndex() {
  const E = (S.art || {}).events || {};
  if (evIdx && evOf === E) return evIdx;
  evOf = E; evIdx = Object.keys(E).map(name => {
    const sp = name.indexOf(" "), pre = sp > 0 ? name.slice(0, sp) : name, rest = sp > 0 ? name.slice(sp + 1) : "";
    return { name: name, pre: pre, t: tight(rest), num: (rest.match(/(\d+)\s*$/) || [])[1] || "", base: tight(rest.replace(/\s*\d+\s*$/, "")) };
  }).filter(x => x.t);
  return evIdx;
}
// e = { k, t (titre), show } : nom exact (avec le numéro), sinon le nom sans numéro, sinon la version la plus récente
export function eventLogo(e) {
  if (!e || !e.t) return "";
  const pres = EVP[e.k] || [e.k], T = tight(e.t), num = (String(e.t).match(/(\d+)\s*$/) || [])[1] || "", baseT = tight(String(e.t).replace(/\s*\d+\s*$/, "").replace(/:.*$/, ""));
  if (!baseT || baseT.length < 4) return "";
  const list = evIndex().filter(x => pres.indexOf(x.pre) >= 0);
  let best = list.find(x => x.t === T) || (num && list.find(x => x.base === baseT && x.num === num));
  if (!best) {
    const same = list.filter(x => x.base === baseT || x.t === baseT);
    best = same.find(x => !x.num) || same.sort((a, b) => (+b.num || 0) - (+a.num || 0))[0];
  }
  // « Survivor Series: WarGames » -> « Survivor Series »
  if (!best) best = list.filter(x => x.base.length >= 6 && T.indexOf(x.base) === 0).sort((a, b) => b.base.length - a.base.length)[0];
  return best ? art("events", best.name) : "";
}

// ---------- ceintures ----------
// id des titres de data/titles.json -> nom du fichier de la ceinture
export const BELT = {
  "wwe-whc": "WWE World Heavy", "wwe-wwc": "WWE Women World", "wwe-ic": "WWE IC", "wwe-wic": "WWE W IC", "wwe-wtt": "WWE World Tag", "wwe-wwe": "WWE Undisputed",
  "wwe-wc": "WWE Womens", "wwe-us": "WWE US", "wwe-wus": "WWE W US", "wwe-tt": "WWE Tag", "wwe-wtag": "WWE W Tag",
  nxt: "NXT World", "nxt-w": "NXT Womens", "nxt-na": "NXT NA", "nxt-wna": "NXT NA W", "nxt-tt": "NXT Tag",
  "aew-world": "AEW World", "aew-women": "AEW Womens", "aew-intl": "AEW International", "aew-tnt": "AEW TNT", "aew-tbs": "AEW TBS", "aew-cont": "AEW Continental",
  "aew-nat": "AEW National", "aew-tag": "AEW Tag", "aew-trios": "AEW Trios", "aew-wtag": "AEW Women Tag",
  "tna-world": "TNA World", "tna-x": "TNA X", "tna-intl": "TNA International", "tna-ko": "TNA KO", "tna-kotag": "TNA KO Tag", "tna-tag": "TNA Tag",
  "cmll-heavy": "CMLL Heavyweight", "cmll-lightheavy": "CMLL Light Heavyweight", "cmll-middle": "CMLL Middleweight", "cmll-welter": "CMLL Welterweight", "cmll-light": "CMLL Lightweight",
  "cmll-tag": "CMLL Tag Team", "cmll-trios": "CMLL Trios", "cmll-women": "CMLL Womens",
  "mex-heavy": "Mexican National Heavyweight Championship", "mex-lightheavy": "Mexican National Light Heavyweight Championship", "mex-middle": "Mexican National Middleweight Championship",
  "mex-welter": "Mexican National Welterweight Championship", "mex-light": "Mexican National Lightweight Championship", "mex-tag": "Mexican National Tag Team Championship",
  "mex-trios": "Mexican National Trios Championship", "mex-women": "Mexican National Womens Championship", "mex-women-tag": "Mexican National Womens Tag Team Championship",
  "njpw-hw": "IWGP Heavyweight", "njpw-global": "IWGP Global", "njpw-jr": "IWGP Jr", "njpw-never": "NEVER Openweight", "njpw-6man": "NEVER 6", "njpw-tag": "IWGP Tag",
  "njpw-jrtag": "IWGP Jr Tag", "njpw-tv": "NJPW TV", "njpw-strong": "NJPW Strong Open",
  "aaa-mega": "AAA Mega", "aaa-reina": "AAA Reina", "aaa-latin": "AAA LA", "aaa-cruiser": "AAA CW", "aaa-tag": "AAA Tag", "aaa-mixed": "AAA World Mixed", "aaa-trios": "AAA Trio",
  "roh-world": "ROH World", "roh-tv": "ROH TV", "roh-pure": "ROH Pure", "roh-tag": "ROH Tag", "roh-six": "ROH 6", "roh-women": "ROH Womens", "roh-women-tv": "ROH Womens TV", "roh-women-pure": "ROH W Pure",
  "stardom-world": "Stardom World", "stardom-wonder": "Wonder of Stardom", "stardom-goddesses": "Stardom Goddesses", "stardom-artist": "Stardom Artists", "stardom-future": "Stardom Future",
  "stardom-iwgpw": "IWGP Womens", "marigold-world": "MARIGOLD World", "marigold-un": "MARIGOLD National", "marigold-superfly": "MARIGOLD Super Fly", "marigold-twinstar": "MARIGOLD Twin Star"
};
export const beltOf = id => (BELT[id] ? art("titles", BELT[id]) : "");
export const beltVersions = id => (BELT[id] ? artVersions("titles", BELT[id]) : []);
// Anciennes ceintures : toutes celles du dossier qui ne sont pas un titre actuel (archives, seulement par la recherche)
const ABBR = [[/\bW\b(?=.*)/g, "Women’s"], [/\bWomens\b/g, "Women’s"], [/\bIC\b/g, "Intercontinental"], [/\bUS\b/g, "United States"], [/\bNA\b/g, "North American"], [/\bEU\b/g, "European"],
  [/\bUni\b/g, "Universal"], [/\bCruiser\b/g, "Cruiserweight"], [/\bCW\b/g, "Cruiserweight"], [/\bKO\b/g, "Knockouts"], [/\bTV\b/g, "Television"], [/\bMitB\b/g, "Money in the Bank"],
  [/\bKotR\b/g, "King of the Ring"], [/\bKQotR\b/g, "King et Queen of the Ring"], [/\bWM\b/g, "WrestleMania"], [/\bWMitB\b/g, "Money in the Bank (femmes)"], [/\bSD\b/g, "SmackDown"],
  [/\bJr\b/g, "Junior Heavyweight"], [/\bLA\b/g, "Latin American"], [/\bDM\b/g, "Digital Media"], [/\bID\b/g, "Independent"], [/\bGRumble\b/g, "Greatest Royal Rumble"], [/\bAndre\b/g, "André the Giant Memorial Trophy"],
  [/\bBOSJ\b/g, "Best of the Super Juniors"], [/\bMYCb\b/g, "Mae Young Classic"], [/\bDusty\b/g, "Dusty Rhodes Tag Team Classic"], [/\bX\b/g, "X Division"], [/\b6\b/g, "6-Man"]];
export function beltLabel(name) {
  let s = String(name).replace(/\s*\(([^)]+)\)$/, " ($1)").replace(/_Custom$/, " (modèle spécial)");
  ABBR.forEach(r => { s = s.replace(r[0], r[1]); });
  return s.replace(/\s+/g, " ").trim();
}
export function archivedBelts() {
  const T = (S.art || {}).titles || {}, cur = {};
  Object.keys(BELT).forEach(id => { cur[BELT[id]] = 1; });
  return Object.keys(T).filter(n => !cur[n]).map(n => ({ key: n, label: beltLabel(n), src: art("titles", n), k: n.split(" ")[0] }));
}

// ---------- tag teams et factions ----------
let gIdx = null, gOf = null;
function groupIndex() {
  const G = S.groups || {};
  if (gIdx && gOf === G) return gIdx;
  gOf = G; gIdx = { byName: new Map(), byMember: new Map() };
  Object.keys(G).forEach(id => {
    const g = G[id]; if (!g || !g.n) return;
    [g.n, g.lg].concat(Array.isArray(g.a) ? g.a : []).forEach(n => { const k = tight(String(n).replace(/^the\s+/i, "")); if (k && !gIdx.byName.has(k)) gIdx.byName.set(k, id); });
    const add = (n, cur) => { const k = norm(n); if (!k) return; const l = gIdx.byMember.get(k) || []; l.push({ id: id, cur: cur }); gIdx.byMember.set(k, l); };
    (g.m || []).forEach(n => add(n, !!g.on));
    (g.ex || []).forEach(n => add(n, false));
  });
  return gIdx;
}
export const groupHref = id => "#/groupe/" + encodeURIComponent(id);
export function groupById(id) { return (S.groups || {})[id] || null; }
export function groupId(name) {
  if (!name) return "";
  const G = S.groups || {}; if (G[name]) return name;
  return groupIndex().byName.get(tight(String(name).replace(/^the\s+/i, ""))) || "";
}
export function groupLogo(id) {
  const g = groupById(id); return g ? art("groups", g.lg) : "";
}
// groupes d'un catcheur : { cur: [ids des groupes actuels], past: [ids] }
export function groupsOf(name) {
  const idx = groupIndex(), seen = {}, out = { cur: [], past: [] };
  const w = wInfo(name), names = [name].concat(w ? [w.name].concat(Array.isArray(w.a) ? w.a : []) : []);
  names.forEach(n => (idx.byMember.get(norm(n)) || []).forEach(x => {
    if (seen[x.id]) { if (x.cur && out.past.indexOf(x.id) >= 0) { out.past.splice(out.past.indexOf(x.id), 1); out.cur.push(x.id); } return; }
    seen[x.id] = 1; (x.cur ? out.cur : out.past).push(x.id);
  }));
  return out;
}
// petit logo (ou nom écrit) d'un groupe, lien vers sa fiche
export function groupChip(id, size) {
  const g = groupById(id); if (!g) return "";
  const src = groupLogo(id);
  return '<a class="gchip" href="' + groupHref(id) + '" title="' + esc(g.n) + '">' + (src ? '<img src="' + esc(src) + '" alt="' + esc(g.n) + '" style="height:' + (size || 26) + 'px" loading="lazy" onerror="this.replaceWith(document.createTextNode(this.alt))">' : "<span>" + esc(g.n) + "</span>") + "</a>";
}
// recherche : groupes dont le nom contient la recherche
export function searchGroups(q) {
  const n = key(q); if (n.length < 2) return [];
  const G = S.groups || {};
  return Object.keys(G).filter(id => [G[id].n].concat(G[id].a || []).some(x => key(x).indexOf(n) >= 0)).slice(0, 12);
}
