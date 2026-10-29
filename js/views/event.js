// Archives générées à la demande : un PLE ou un show passé (WrestleMania 13, Starrcade 1997, Wrestle Kingdom 9…)
// lu sur Wikipédia au moment de la recherche — rien n'est stocké dans l'app, sauf les notes des membres.
// Page française pour le résumé quand elle existe ; tableau des combats lu de préférence sur la page anglaise (plus standardisée).
import { S, changed } from "../state.js";
import { esc, ICON, fmt, okHttp, okDay } from "../util.js";
import { PREVIEW } from "../content.js";
import { templateParams, cleanWiki } from "../tech.js";
import { promoIn, norm } from "../wrestlers.js";
import { rateBtn, fromResult, mkey } from "./mrate.js";
import { ytSearch, spoilBlock } from "./highlights.js";

const API = l => "https://" + l + ".wikipedia.org/w/api.php?format=json&origin=*&";
const getJ = async u => { const r = await fetch(u); if (!r.ok) throw new Error("http " + r.status); return r.json(); };
const strip = h => String(h || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
const enc = encodeURIComponent;
const EVT = /wrestl|catch|lucha|lutte/i;
const KIND = /\bevent|événement|évènement|pay-per-view|\bppv\b|premium live|supercard|gala|spectacle|tournament|tournoi|\bshow\b|émission|television special|spécial/i;
const PERSON = /\b(?:is|was) an? (?:[\w-]+ ){0,4}(?:wrestler|wrestling (?:manager|commentator|promoter|referee))|\best une? (?:[\wéè-]+ ){0,4}(?:catcheu|lutteu)|\bné(?:e)? le\b|\bborn\b/i;
const tidyTitle = t => String(t || "").replace(/\s*\((?:catch|professional wrestling|wrestling|événement|évènement|event|\d{4})\)$/i, "").trim();
// Mots qui ressemblent à un nom d'événement : la touche « Entrée » ouvre alors les archives
export const EVENT_WORDS = /wrestle ?mania|royal rumble|summer ?slam|survivor series|starrcade|halloween havoc|great american bash|in your house|wrestle ?kingdom|dominion|king of pro|power struggle|destruction in|g1 climax|best of the super juniors|all in\b|all out\b|double or nothing|full gear|revolution|forbidden door|worlds end|wrestle ?dream|dynasty|grand slam|bound for glory|slammiversary|hard to kill|lockdown|triplema|verano de esc|guerra de titanes|héroes inmortales|heroes inmortales|money in the bank|backlash|hell in a cell|elimination chamber|crown jewel|takeover|king of the ring|unforgiven|no mercy|judgment day|extreme rules|payback|clash (?:of|at)|fastlane|armageddon|vengeance|bash at the beach|uncensored|fall brawl|souled out|spring stampede|superbrawl|world war 3|december to dismember|one night stand|night of champions|tables,? ladders|\btlc\b|wargames|main event|wrestlepalooza|evolution|bad blood|no way out|over the edge|fully loaded|great balls of fire|breaking point|bragging rights|cyber sunday|taboo tuesday|new year'?s revolution|day 1|elimination|halftime heat|clash of champions|dream star|grand destiny|crimson nightmare|sumo hall|ryōgoku|ryogoku|tokyo dome|budokan|final battle|supercard of honor|death before dishonor|best in the world|glory by honor|global wars|aniversario|anniversary show|homenaje a dos leyendas|sin piedad|juicio final|rey del inframundo|fantastica ?mania|grand prix|noche de las amazonas/i;

// ---------- recherche d'événements sur Wikipédia (fr + en) ----------
const sCache = {};
export async function searchEvents(q) {
  q = String(q || "").trim(); if (q.length < 3 || PREVIEW) return [];
  if (sCache[q]) return sCache[q];
  const one = async l => {
    try {
      const j = await getJ(API(l) + "action=query&list=search&srlimit=8&srprop=snippet&srsearch=" + enc(q));
      return ((j.query && j.query.search) || []).map(x => ({ l: l, title: x.title, sn: strip(x.snippet) }));
    } catch (e) { return []; }
  };
  const res = await Promise.all([one("fr"), one("en")]), seen = {}, out = [];
  res[0].concat(res[1]).forEach(x => {
    const txt = x.title + " " + x.sn;
    if (!EVT.test(txt) || !KIND.test(txt) || PERSON.test(x.sn) || /^(?:liste|list) /i.test(x.title)) return;
    const key = norm(tidyTitle(x.title)); if (seen[key]) return;
    seen[key] = 1; out.push(x);
  });
  return (sCache[q] = out.slice(0, 6));
}

// ---------- lecture d'une page ----------
const MO = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
const pad = n => String(n).padStart(2, "0");
// {{Start date|1997|3|23}}, {{date|23|mars|1997}}, « March 23, 1997 », « 23 mars 1997 » -> « 1997-03-23 »
export function isoDate(raw) {
  raw = String(raw || "");
  let m = raw.match(/\{\{\s*(?:start date|start date and age|date de début|dts|date)\s*\|\s*(?:df=y\w*\s*\|\s*)?(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i);
  if (m) return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]);
  m = raw.match(/\{\{\s*date\s*\|\s*(\d{1,2})(?:er)?\s*\|\s*([^|}]+?)\s*\|\s*(\d{4})/i);
  if (m && MO[norm(m[2])]) return m[3] + "-" + pad(MO[norm(m[2])]) + "-" + pad(m[1]);
  const t = norm(cleanWiki(raw));
  m = t.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  m = t.match(/(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})/); if (m && MO[m[2]]) return m[3] + "-" + pad(MO[m[2]]) + "-" + pad(m[1]);
  m = t.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/); if (m && MO[m[1]]) return m[3] + "-" + pad(MO[m[1]]) + "-" + pad(m[2]);
  return "";
}
const pickP = (p, re) => { if (!p) return ""; const k = Object.keys(p).find(x => re.test(x) && String(p[x]).trim()); return k ? p[k] : ""; };
function infobox(wt, lang) {
  if (!wt) return null;
  const p = lang === "en" ? (templateParams(wt, /\{\{\s*infobox[ _]+(?:wrestling|professional wrestling)[ _]+event/i) || templateParams(wt, /\{\{\s*infobox/i))
    : (templateParams(wt, /\{\{\s*infobox[ _]+catch/i) || templateParams(wt, /\{\{\s*infobox/i));
  if (!p) return null;
  return {
    promo: cleanWiki(pickP(p, /^(promotion|promotions|fédération|federation|fédérations|promoteur|organisateur|brand|brands|division)$/)),
    date: isoDate(pickP(p, /^(date|dates|date de l'évènement|date de l'événement)$/)),
    venue: cleanWiki(pickP(p, /^(venue|lieu|salle|aréna|arena|stade)$/)),
    city: cleanWiki(pickP(p, /^(city|ville|localisation|location|ville hôte)$/)),
    att: cleanWiki(pickP(p, /^(attendance|spectateurs|public|affluence|assistance)$/)),
  };
}
const STIP = [[/six-man tag team match/i, "Match par équipes à six"], [/tag team match/i, "Match par équipes"], [/singles match/i, "Match simple"],
  [/triple threat match/i, "Triple Threat match"], [/fatal four-way match/i, "Fatal four-way match"], [/\bmatch for the\b/i, "match pour le"], [/\bfor the\b/i, "pour le"], [/\bpre-show\b/i, "avant-show"]];
const frStip = s => STIP.reduce((x, r) => x.replace(r[0], r[1]), String(s || ""));
const cellText = c => cleanWiki(String(c || "").replace(/^\s*(?:(?:style|class|rowspan|colspan|align|width|bgcolor|scope|data-sort-value)\s*=\s*"[^"]*"\s*)+\|/i, ""));
const RESULT = /defeated|def\.|a battu|ont battu|remport|\bwon\b|\bvs\.?\b|contre|draw|match nul|no contest|eliminat|éliminé|conserv|retain/i;
// Tableau des combats : modèle « Pro Wrestling results table », sinon premier tableau de la section Résultats
export function parseResults(wt) {
  const out = [];
  const tp = templateParams(wt, /\{\{\s*pro[ _]wrestling[ _]results[ _]table/i);
  if (tp) {
    Object.keys(tp).map(k => k.match(/^match(\d+)$/)).filter(Boolean).map(m => +m[1]).sort((a, b) => a - b).forEach(n => {
      const res = cleanWiki(tp["match" + n]); if (!res) return;
      out.push({ res: res, stip: cleanWiki(tp["stip" + n] || ""), time: cleanWiki(tp["times" + n] || tp["time" + n] || ""), dark: !!(tp["dark" + n] || tp["pre" + n] || tp["preshow" + n]) });
    });
    if (out.length) return out;
  }
  const h = String(wt || "").search(/\n=+\s*(?:results|résultats|resultats|matchs|tableau des matchs|card|carte)\s*=+/i);
  if (h < 0) return out;
  const sec = wt.slice(h), a = sec.indexOf("{|"), b = sec.indexOf("\n|}", a);
  if (a < 0) return out;
  const block = sec.slice(a, b > a ? b : a + 20000);
  block.split(/\n\|-[^\n]*/).slice(1).forEach(row => {
    const cells = [];
    row.split("\n").forEach(line => {
      line = line.trim();
      if (!line || /^(?:\|\}|\{\||\|\+)/.test(line)) return;
      if (line[0] === "!") { line.slice(1).split("!!").forEach(c => cells.push({ h: true, t: cellText(c) })); return; }
      if (line[0] === "|") { line.slice(1).split("||").forEach(c => cells.push({ h: false, t: cellText(c) })); return; }
      if (cells.length) cells[cells.length - 1].t += " " + cleanWiki(line);
    });
    const i = cells.findIndex(c => !c.h && RESULT.test(c.t) && c.t.length > 8);
    if (i < 0) return;
    const rest = cells.slice(i + 1).filter(c => !c.h && c.t && !/^\d{1,2}:\d{2}/.test(c.t));
    const first = cells.slice(0, i).map(c => c.t).join(" ");
    out.push({ res: cells[i].t, stip: rest[0] ? rest[0].t : "", time: "", dark: /^\s*(?:d|p|pre|dark)\s*$/i.test(first) });
  });
  return out;
}
// Combats à noter : titres neutres ; pour une bataille royale ou un Royal Rumble, la stipulation sert de titre
export function fightsOf(rows) {
  const seen = {}, out = [];
  rows.forEach(r => {
    let t = fromResult(r.res);
    if (!t && /royal rumble|battle royal|rumble match|gauntlet|elimination|ladder|scramble|\d+-(?:man|woman|person)/i.test(r.res + " " + r.stip)) {
      t = frStip(r.stip || "").replace(/^./, c => c.toUpperCase());
      if (!t) { const m = r.res.match(/(?:the |le )?([\w\s'-]*?(?:royal rumble|battle royal|gauntlet)[\w\s'-]*?match)/i); t = m ? m[1].trim().replace(/^./, c => c.toUpperCase()) : ""; }
    }
    if (!t) return;
    const key = mkey("x", t); if (seen[key]) return; seen[key] = 1;
    out.push({ t: t, stip: frStip(r.stip), dark: r.dark });
  });
  return out;
}
function shortSum(txt) {
  const paras = String(txt || "").split(/\n+/).map(s => s.trim()).filter(s => s.length > 30);
  let out = "";
  for (const p of paras) { if (out.length > 520) break; out += (out ? "\n" : "") + p; }
  if (out.length > 950) { const cut = out.slice(0, 950), i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n")); out = (i > 300 ? cut.slice(0, i + 1) : cut + "…"); }
  return out;
}
const wikiUrl = (l, t) => "https://" + l + ".wikipedia.org/wiki/" + enc(String(t).replace(/ /g, "_"));

const eCache = {}, busy = {};
export async function loadEvent(ref) {
  let l = "", title = "";
  const m = String(ref).match(/^(fr|en):(.+)$/);
  if (m) { l = m[1]; title = m[2]; }
  else {
    const hits = await searchEvents(ref);
    if (!hits.length) throw new Error("introuvable");
    const want = norm(ref);
    const best = hits.find(x => norm(tidyTitle(x.title)) === want) || hits.find(x => x.l === "en" && norm(x.title).indexOf(want) >= 0) || hits[0];
    l = best.l; title = best.title;
  }
  // la page jumelle dans l'autre langue
  const other = l === "en" ? "fr" : "en";
  const q = await getJ(API(l) + "action=query&prop=langlinks&redirects=1&lllimit=1&lllang=" + other + "&titles=" + enc(title));
  const pg = q && q.query && q.query.pages ? Object.values(q.query.pages)[0] : null;
  if (!pg || pg.missing !== undefined) throw new Error("introuvable");
  title = pg.title || title;
  const twin = pg.langlinks && pg.langlinks[0] ? (pg.langlinks[0]["*"] || pg.langlinks[0].title || "") : "";
  const fr = l === "fr" ? title : twin, en = l === "en" ? title : twin;
  const wt = async (lang, t) => { if (!t) return ""; try { const j = await getJ(API(lang) + "action=parse&prop=wikitext&redirects=1&formatversion=2&page=" + enc(t)); return (j.parse && j.parse.wikitext) || ""; } catch (e) { return ""; } };
  const ext = async (lang, t) => { if (!t) return ""; try { const j = await getJ(API(lang) + "action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=" + enc(t)); const p = j.query && j.query.pages ? Object.values(j.query.pages)[0] : null; return (p && p.extract) || ""; } catch (e) { return ""; } };
  const got = await Promise.all([wt("en", en), wt("fr", fr), ext("fr", fr), ext("en", en)]);
  const wtEn = got[0], wtFr = got[1], exFr = got[2], exEn = got[3];
  const ibF = infobox(wtFr, "fr") || {}, ibE = infobox(wtEn, "en") || {};
  let rows = parseResults(wtEn), resLang = "en"; if (!rows.length) { rows = parseResults(wtFr); resLang = "fr"; }
  const sum = shortSum(exFr) || shortSum(exEn);
  const k = promoIn((ibE.promo || "") + " " + (ibF.promo || "") + " " + (exEn || exFr).slice(0, 400)) || "Catch";
  return {
    title: tidyTitle(fr || en), k: k, d: ibE.date || ibF.date || "",
    venue: ibF.venue || ibE.venue, city: ibF.city || ibE.city, att: ibF.att || ibE.att,
    sum: sum, sumLang: shortSum(exFr) ? "fr" : "en", url: fr ? wikiUrl("fr", fr) : wikiUrl("en", en), urlEn: en ? wikiUrl("en", en) : "",
    fights: fightsOf(rows), res: rows.map(r => (r.dark ? "Avant-show : " : "") + r.res), resLang: resLang,
  };
}
// Charge la page puis redessine (appelé après l'affichage de la route)
export async function fillEvent(ref) {
  if (PREVIEW || eCache[ref] || busy[ref]) return;
  busy[ref] = 1;
  try { eCache[ref] = await loadEvent(ref); }
  catch (e) { eCache[ref] = { err: /introuvable/.test(e && e.message) ? "notfound" : "net" }; }
  busy[ref] = 0;
  changed("event");
}

function head(e) {
  const pr = S.P[e.k], c = (pr && pr.c) || ["#7a0b12", "#16060a"];
  const bits = [okDay(e.d) ? fmt(e.d) : "", e.city, e.venue, e.att ? e.att.replace(/\s*\(.*$/, "") + " spectateurs" : ""].filter(Boolean);
  return '<section class="hlhead evhead" style="background:linear-gradient(160deg,' + esc(c[0]) + "," + esc(c[1] || c[0]) + ')"><span class="eyebrow">ARCHIVES · ' + esc(e.k) + "</span><h1>" + esc(e.title) + "</h1>" +
    (bits.length ? "<small>" + esc(bits.join(" · ")) + "</small>" : "") + "</section>";
}
export function eventView(ref) {
  let h = '<a class="back" href="javascript:history.back()">' + ICON.back + " Retour</a>";
  const label = String(ref || "").replace(/^(fr|en):/, "");
  if (PREVIEW) return h + head({ k: "Archives", title: label }) + '<p class="note" style="margin-top:14px">Les archives se génèrent depuis Wikipédia une fois l’app en ligne (l’aperçu bloque les connexions vers d’autres sites).</p>';
  const e = eCache[ref];
  if (!e) return h + head({ k: "Archives", title: label }) + '<p class="note" style="margin-top:14px">Recherche de l’événement sur Wikipédia…</p>';
  if (e.err) return h + head({ k: "Archives", title: label }) + '<p class="note" style="margin-top:14px">' + (e.err === "notfound" ? "Pas de page Wikipédia trouvée pour « " + esc(label) + " ». Essaie le nom exact de l’événement avec son numéro ou son année (ex. : WrestleMania 13, Starrcade 1997)."
    : "Impossible de joindre Wikipédia pour le moment. Réessaie dans un instant.") + "</p>";
  h += head(e);
  if (e.sum) h += "<h2>Résumé</h2>" + '<div class="wikicard evsum">' + e.sum.split("\n").map(p => "<p>" + esc(p) + "</p>").join("") +
    (okHttp(e.url) ? '<a href="' + esc(e.url) + '" target="_blank" rel="noopener">Lire la suite sur Wikipédia ↗</a>' : "") +
    '<small class="src">' + (e.sumLang === "en" ? "Résumé en anglais (pas de page en français). " : "") + "Source : Wikipédia (licence CC BY-SA)</small></div>";
  const show = e.title.slice(0, 40), yk = S.P[e.k] ? e.k : "";
  if (e.fights.length) {
    h += '<h2>Les combats <small class="cnt">' + e.fights.length + '</small></h2><div class="list fights evfights">' + e.fights.map(f => '<div class="item"><span class="lbl"><b>' + esc(f.t) + "</b>" +
      (f.stip || f.dark ? "<small>" + esc([f.dark ? "Avant-show" : "", f.stip].filter(Boolean).join(" · ")) + "</small>" : "") + "</span>" +
      '<span class="evbtns">' + rateBtn(e.k, f.t, show, e.d) + '<a class="chip ytchip" href="' + esc(ytSearch(yk || e.k, f.t.replace(/ contre /g, " vs ") + " " + e.title)) + '" target="_blank" rel="noopener" aria-label="Chercher la vidéo sur YouTube">▶ Vidéo</a></span></div>').join("") + "</div>" +
      '<p class="note small" style="margin-top:8px">☆ Note les combats que tu as vus : ils rejoignent ton historique des notes. Les titres sont neutres (noms par ordre alphabétique) pour ne pas trahir le vainqueur.</p>';
  } else h += '<p class="note" style="margin-top:14px">La page Wikipédia de cet événement ne contient pas de tableau des combats lisible par l’app.' + (okHttp(e.urlEn || e.url) ? ' <a href="' + esc(e.urlEn || e.url) + '" target="_blank" rel="noopener">Voir la page ↗</a>' : "") + "</p>";
  if (e.res.length) h += "<h2>Résultats</h2>" + spoilBlock("Voir les résultats (spoiler)", '<ul class="res">' + e.res.map(r => "<li>" + esc(r) + "</li>").join("") + "</ul>") +
    (e.resLang === "en" ? '<p class="note small" style="margin-top:8px">Résultats tirés de la page Wikipédia en anglais.</p>' : "");
  return h;
}
