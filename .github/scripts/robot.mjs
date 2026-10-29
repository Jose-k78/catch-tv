// Robot TCC TV (GitHub Actions, toutes les 30 minutes) : sans intelligence artificielle, il copie
//  - les nouveaux articles des sites d'actu français de data/sources.json (flux RSS) ;
//  - les nouvelles vidéos des chaînes YouTube OFFICIELLES (flux publics), rangées dans le bon show à la bonne date.
// Tout va dans data/feed.json (l'app le fusionne avec news.json et data/highlights.json) : aucun conflit avec les mises à jour quotidiennes.
import fs from "node:fs";

const OUT = "data/feed.json";
const read = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } };
const cal = read("data/calendar.json", { promotions: {} }).promotions || {};
const sources = read("data/sources.json", { items: [] }).items || [];
const prev = read(OUT, { at: "", items: [], yt: {}, rss: {}, ch: {} });
const UA = { "User-Agent": "Mozilla/5.0 (compatible; TCC-TV-robot/1.0; +https://jose-k78.github.io/catch-tv/)", "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8" };
const get = async (u, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 15000); try { const r = await fetch(u, { headers: UA, signal: c.signal, redirect: "follow" }); return r.ok ? await r.text() : ""; } catch (e) { return ""; } finally { clearTimeout(t); } };
const diag = {};                    // compte rendu du passage (gardé dans data/feed.json, visible pour le débogage)
const log = (...a) => console.log(...a);

// ---------- petits outils ----------
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ecirc: "ê", ocirc: "ô", icirc: "î", ucirc: "û" };
const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] != null ? ENT[n.toLowerCase()] : m).replace(/\s+/g, " ").trim();
const tag = (x, t) => { const m = x.match(new RegExp("<" + t + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + t + ">", "i")); return m ? m[1] : ""; };
const parisDay = d => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const daysAgo = n => parisDay(new Date(Date.now() - n * 864e5));
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------- promotions et shows reconnus dans un titre ----------
const PROMO = [["WWE", /\bwwe\b|\braw\b|smackdown|\bnxt\b|wrestlemania|summerslam|royal rumble|survivor series|crown jewel|money in the bank|saturday night.?s main event/],
  ["AEW", /\baew\b|dynamite|collision|full gear|all in\b|double or nothing|worlds end|wrestledream|forbidden door|revolution/], ["AAA", /\baaa\b|lucha libre aaa|triplemania|heroes inmortales|guerra de titanes/],
  ["ROH", /\broh\b|ring of honor|final battle|supercard of honor|death before dishonor/], ["TNA", /\btna\b|impact wrestling|bound for glory|slammiversary|hard to kill/],
  ["CMLL", /\bcmll\b|arena mexico|viernes espectacular/], ["NJPW", /\bnjpw\b|new japan|wrestle kingdom|g1 climax|dominion|power struggle/], ["Stardom", /stardom/], ["Marigold", /marigold/]];
const SHOWS = [["Raw", /\braw\b/], ["SmackDown", /smackdown/], ["NXT", /\bnxt\b/], ["Evolve", /\bevolve\b/], ["Main Event", /main event/], ["Dynamite", /dynamite/], ["Collision", /collision/],
  ["Impact", /\bimpact\b/], ["ROH TV", /\broh tv\b|honor ?club/], ["Viernes Espectacular", /viernes espectacular/], ["Lucha Libre AAA", /lucha libre aaa/]];
function tagsOf(text) {
  const t = norm(text), out = [];
  PROMO.forEach(p => { if (p[1].test(t)) out.push(p[0]); });
  SHOWS.forEach(s => { if (s[1].test(t)) out.push(s[0]); });
  return out;
}

// ---------- 1) actu : flux RSS des sites d'actu de data/sources.json ----------
async function feedUrl(s) {
  if (s.rss) return s.rss;
  if (prev.rss && prev.rss[s.u]) return prev.rss[s.u];
  const home = await get(s.u);
  const m = home.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i);
  const href = m && (m[0].match(/href=["']([^"']+)["']/i) || [])[1];
  const cands = (href ? [new URL(href, s.u).href] : []).concat(["feed/", "/feed", "/rss", "/rss.xml", "/feed.xml", "/rss.php", "/index.xml", "/feed/rss", "/actualites/rss", "/rss/actualites"].map(x => new URL(x, s.u).href));
  for (const c of cands) { const x = await get(c); if (/<(rss|feed)[\s>]/i.test(x)) return c; }
  return "";
}
// Site sans flux RSS (Catch-Newz…) : on lit les liens d'articles de la page d'accueil. Un lien jamais vu est daté du jour
// où le robot le découvre (il passe toutes les 30 min) ; au tout premier passage, on ne garde que ceux dont la date est écrite.
const FR_M = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
function frDate(t) { const m = norm(t).match(/\b(\d{1,2})(?:er)?[\s-]+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)[\s-]+(20\d\d)\b/); return m ? m[3] + "-" + pad(FR_M[m[2]]) + "-" + pad(m[1]) : ""; }
async function scrape(s, seen) {
  const html = await get(s.u), host = new URL(s.u).host.replace(/^www\./, ""), out = [], first = !seen.length;
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html))) {
    let u; try { u = new URL(m[1], s.u); } catch (e) { continue; }
    if (u.host.replace(/^www\./, "") !== host || !/\/\d{3,}-[a-z0-9-]{8,}/i.test(u.pathname)) continue;
    const t = decode(m[2]); if (t.length < 20 || t.length > 220) continue;
    const href = "https://" + u.host + u.pathname, d = frDate(t) || frDate(u.pathname);
    if (out.some(x => x.u === href)) continue;
    if (seen.indexOf(href) >= 0 && !d) continue;           // déjà vu : on garde la date du premier passage
    if (first && !d) { out.push({ u: href, skip: true }); continue; }
    out.push({ t: t.slice(0, 200), u: href, s: s.n, d: d || parisDay(new Date()), tags: tagsOf(t + " " + u.pathname.replace(/[/-]/g, " ")) });
  }
  return out;
}
async function news() {
  const out = [], rss = {}, seenAll = Object.assign({}, prev.seen || {});
  for (const s of sources.filter(x => x.on !== false && (x.use || []).indexOf("actu") >= 0)) {
    const u = await feedUrl(s);
    if (!u) {
      const seen = seenAll[s.u] || [], got = await scrape(s, seen), keep = got.filter(x => !x.skip);
      keep.forEach(x => out.push(x));
      seenAll[s.u] = got.map(x => x.u).concat(seen).filter((x, i, a) => a.indexOf(x) === i).slice(0, 300);
      diag[s.n] = "pas de flux RSS : " + keep.length + " nouveaux articles lus sur la page d'accueil (" + got.length + " liens)";
      continue;
    }
    rss[s.u] = u;
    const x = await get(u); let n = 0;
    (x.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || []).forEach(it => {
      const t = decode(tag(it, "title")); let link = decode(tag(it, "link"));
      if (!link) { const m = it.match(/<link[^>]+href=["']([^"']+)["']/i); link = m ? m[1] : ""; }
      const when = decode(tag(it, "pubDate") || tag(it, "published") || tag(it, "updated") || tag(it, "dc:date"));
      const dt = when ? new Date(when) : null;
      if (!t || !/^https:\/\//.test(link) || !dt || isNaN(dt)) return;
      const d = parisDay(dt); if (d < daysAgo(7)) return;
      const cats = (it.match(/<category[^>]*>([\s\S]*?)<\/category>/gi) || []).map(decode).join(" ");
      out.push({ t: t.slice(0, 200), u: link, s: s.n, d: d, tags: tagsOf(t + " " + cats) }); n++;
    });
    log(s.n, ":", n, "articles", u); diag[s.n] = n + " articles (7 j)";
  }
  // fusion avec les articles déjà trouvés (même adresse = même article), 7 jours, 60 au plus
  const seen = {}, all = out.concat(prev.items || []).filter(a => { if (seen[a.u] || a.d < daysAgo(7)) return false; return (seen[a.u] = 1); });
  all.sort((a, b) => b.d.localeCompare(a.d));
  return { items: all.slice(0, 60), rss: rss, seen: seenAll };
}

// ---------- 2) vidéos : flux des chaînes YouTube officielles ----------
// chaînes connues (les autres sont trouvées par leur nom, et gardées dans "ch")
const CHANNELS = [{ k: ["WWE", "AAA"], id: (cal.WWE || {}).yt }, { k: ["AEW"], id: (cal.AEW || {}).yt }, { k: ["ROH"], id: (cal.ROH || {}).yt }, { k: ["CMLL"], id: (cal.CMLL || {}).yt },
  { k: ["TNA"], id: "UCOp8wkVqdrWbFYHjDv946QQ" }, { k: ["NJPW"], id: "UC1lgJkpCx_0SMzsvrTCdxPw" },
  { k: ["Stardom"], handles: ["@wwr_stardom", "@STARDOM", "@stardomofficial", "@STARDOM_official"], must: /stardom/i },
  { k: ["Marigold"], handles: ["@marigold_joshi", "@DSF_Marigold", "@DreamStarFightingMarigold", "@marigold"], must: /marigold/i }];
async function resolve(c) {
  if (c.id) return c.id;
  const key = c.k[0]; if (prev.ch && prev.ch[key]) return prev.ch[key];
  for (const h of c.handles || []) {
    const html = await get("https://www.youtube.com/" + h);
    const id = (html.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/) || [])[1], title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    if (id && (!c.must || c.must.test(title))) return id;
  }
  return "";
}
const pad = n => String(n).padStart(2, "0");
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
// date écrite dans le titre (« Oct. 26, 2026 », « 10/26/26 »)
function dateIn(t) {
  let m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d\d)\b/i);
  if (m) return m[3] + "-" + pad(MONTHS[m[1].toLowerCase()]) + "-" + pad(m[2]);
  m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(20)?(\d\d)\b/);
  if (m) return "20" + m[4] + "-" + pad(m[1]) + "-" + pad(m[2]);
  return "";
}
// dernier jour de diffusion du show (wd) avant la mise en ligne, 4 jours au plus
// (un show du soir à l'heure américaine est souvent mis en ligne le lendemain en heure UTC : on remonte au dernier jour de diffusion)
function airDay(s, pub) {
  if (typeof s.wd !== "number") return "";
  for (let i = 0; i <= 4; i++) { const d = new Date(pub.getTime() - i * 864e5); if (d.getUTCDay() === s.wd) return d.toISOString().slice(0, 10); }
  return "";
}
const WIN = /\b(wins?|won|defeats?|defeated|retains?|retained|crowned|new champion|beats?|victorious|captures?|dethrones?|triumphs?)\b/i;
// titre neutre « A contre B » (sans vainqueur) ; sinon le titre d'origine, marqué spoiler s'il dévoile un résultat
function neutral(t) {
  let x = t.replace(/^(?:full match|full segment|wwe|aew|roh|tna|cmll|njpw)\s*[:\-–—|]?\s*/i, "").replace(/^[^:]{0,60}:\s*(?=[^:]*\bvs\b)/i, "");
  const vs = x.match(/^(.{2,80}?)\s+vs\.?\s+(.{2,120}?)(?:\s*(?:[:\-–—|(]|\bat\b|\bon\b|\bin\b)|$)/i);
  if (vs) return { t: (vs[1] + " contre " + vs[2]).replace(/\s+/g, " ").trim().slice(0, 150) };
  return { t: x.slice(0, 150), sp: WIN.test(x) };
}
function placeVideo(ks, title, pub) {
  const nt = norm(title);
  let k = ks[0]; if (ks.length > 1) { const f = ks.find(x => tagsOf(title).indexOf(x) >= 0 && x !== ks[0]); if (f) k = f; }
  const pr = cal[k]; if (!pr) return null;
  const pubDay = pub.toISOString().slice(0, 10), lo = new Date(pub.getTime() - 5 * 864e5).toISOString().slice(0, 10);
  // un PLE de ces derniers jours dont le nom est dans le titre
  const ple = (pr.e || []).find(e => e.d && e.d >= lo && e.d <= pubDay && nt.indexOf(norm(String(e.t).replace(/\s+—.*$/, ""))) >= 0);
  if (ple) return k + "|PLE|" + ple.d;
  // sinon un show hebdo
  const sh = pr.s || {}, n = Object.keys(sh).find(x => SHOWS.some(s => s[0] === x && s[1].test(nt)) || nt.indexOf(norm(x)) >= 0);
  if (!n) return null;
  const d = dateIn(title) || airDay(sh[n], pub);
  return d && d >= lo && d <= pubDay ? k + "|" + n + "|" + d : null;
}
async function videos() {
  const yt = {}, ch = {};
  Object.keys(prev.yt || {}).forEach(key => { if (key.slice(-10) >= daysAgo(30)) yt[key] = prev.yt[key].map(v => Object.assign({}, v, { t: String(v.t).replace(/^full (?:match|segment)\s*[:\-–—|]?\s*/i, "") })); });
  for (const c of CHANNELS) {
    const id = await resolve(c); if (!id) { log("chaîne introuvable :", c.k[0]); diag["YouTube " + c.k[0]] = "chaîne introuvable"; continue; }
    if (!c.id) ch[c.k[0]] = id;
    const x = await get("https://www.youtube.com/feeds/videos.xml?channel_id=" + id); let n = 0;
    (x.match(/<entry>[\s\S]*?<\/entry>/g) || []).forEach(en => {
      const vid = decode(tag(en, "yt:videoId")), title = decode(tag(en, "title")), pub = new Date(decode(tag(en, "published")));
      if (!/^[\w-]{11}$/.test(vid) || !title || isNaN(pub)) return;
      // seulement les combats et les résumés (pas les centaines de petits extraits)
      if (!/\bvs\.?\b|highlights?|full match|résumé|resumen/i.test(title) || /#shorts|\bshorts?\b/i.test(title)) return;
      const key = placeVideo(c.k, title, pub); if (!key) return;
      const list = yt[key] = yt[key] || [];
      if (list.some(v => v.id === vid) || list.length >= 15) return;
      const nt = neutral(title);
      list.push(Object.assign({ id: vid, t: nt.t }, nt.sp ? { sp: true } : {})); n++;
    });
    log(c.k[0], ":", n, "nouvelles vidéos rangées"); diag["YouTube " + c.k[0]] = n + " nouvelles vidéos";
  }
  return { yt: yt, ch: ch };
}

// ---------- écriture (seulement si quelque chose a changé, ou une fois toutes les 3 h pour montrer que le robot tourne) ----------
export { neutral, placeVideo, tagsOf, dateIn, scrape };
if (!process.env.ROBOT_TEST) {
  const a = await news(), v = await videos();
  const next = { at: "", items: a.items, yt: v.yt, rss: Object.assign({}, prev.rss || {}, a.rss), ch: Object.assign({}, prev.ch || {}, v.ch), seen: a.seen };
  const same = JSON.stringify(Object.assign({}, prev, { at: "", diag: undefined })) === JSON.stringify(next);
  const old = !prev.at || Date.now() - Date.parse(prev.at) > 3 * 3600e3 || process.env.ROBOT_FORCE === "true";
  if (same && !old) log("rien de neuf");
  else {
    next.at = new Date().toISOString(); next.diag = diag;
    fs.writeFileSync(OUT, JSON.stringify(next, null, 1) + "\n");
    log("data/feed.json écrit :", next.items.length, "articles,", Object.keys(next.yt).length, "shows avec vidéos");
  }
}
