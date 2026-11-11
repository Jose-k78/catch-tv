// Robot TCC TV — sauvegarde des parties TCCCG (11 nov. : Jose a perdu la sienne).
// À chaque passage, pour chaque partie tcg/{uid} :
//  - tcgbak/{uid}_max : copie de la partie la plus avancée jamais vue (niveau, puis boosters ouverts, puis victoires).
//    Une partie qui recule (vidée par erreur) ne la remplace JAMAIS : on peut toujours revenir en arrière.
//  - tcgbak/{uid}_j0 … _j6 : une copie par jour de la semaine (la première vue ce jour-là), donc 7 jours d'historique.
// Les membres relisent leurs copies dans TCCCG › 🛟 Sauvegardes (règles Firestore v12) ; le modo peut restaurer pour un membre.
// Rien de personnel n'est écrit dans le journal public, sauf l'état de la partie du modo (pour vérifier sa sauvegarde).
import { accessToken, parseSA, parisDay } from "../../cloudflare/push-core.mjs";

const ADMIN = "gYOlkXsJc3WedSykoBNyeWg2ELx1";
let sa = null;
try { sa = parseSA(process.env.FIREBASE_SA); } catch (e) { console.log("Clé FIREBASE_SA illisible : " + e.message); }
if (!sa) { console.log("Pas de clé FIREBASE_SA : sauvegarde TCCCG sautée"); process.exit(0); }
const FS = "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents";

async function req(url, opt) {
  const r = await fetch(url, Object.assign({}, opt || {}, { headers: { authorization: "Bearer " + await accessToken(sa), "content-type": "application/json" } }));
  if (r.status === 404) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Firestore " + r.status + " " + ((j.error || {}).message || ""));
  return j;
}
// documents bruts (champs typés de Firestore, recopiés tels quels)
async function list(coll, mask) {
  const out = []; let page = "";
  for (let i = 0; i < 40; i++) {
    const q = "?pageSize=300" + (mask || []).map(m => "&mask.fieldPaths=" + encodeURIComponent(m)).join("") + (page ? "&pageToken=" + encodeURIComponent(page) : "");
    const j = await req(FS + "/" + coll + q); if (!j) break;
    (j.documents || []).forEach(d => out.push({ id: d.name.split("/").pop(), f: d.fields || {}, t: d.updateTime }));
    if (!j.nextPageToken) break; page = j.nextPageToken;
  }
  return out;
}
const num = v => v ? +(v.integerValue != null ? v.integerValue : v.doubleValue != null ? v.doubleValue : 0) || 0 : 0;
const str = v => v && v.stringValue != null ? v.stringValue : "";
const nCards = f => Object.keys(((f.cards || {}).mapValue || {}).fields || {}).length;
const score = f => [num(f.lvl) || 1, num(f.opened), num(f.wins)];
const atLeast = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return true; };
const bk = f => ((f._bk || {}).mapValue || {}).fields || {};
const empty = f => (num(f.lvl) || 1) <= 1 && !num(f.opened) && !nCards(f);
async function put(id, f, uid, kind, day) {
  const fields = Object.assign({}, f, { _bk: { mapValue: { fields: { uid: { stringValue: uid }, kind: { stringValue: kind }, day: { stringValue: day }, at: { timestampValue: new Date().toISOString() } } } } });
  await req(FS + "/tcgbak/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ fields: fields }) });
}
const fmt = (f, noCards) => "niveau " + (num(f.lvl) || 1) + (noCards ? "" : ", " + nCards(f) + " cartes") + ", " + num(f.opened) + " boosters ouverts, " + num(f.wins) + " victoires";

const day = parisDay(), dow = new Date(day + "T12:00:00Z").getUTCDay();
const saves = await list("tcg");
const baks = {}; (await list("tcgbak", ["_bk", "lvl", "opened", "wins"])).forEach(b => { baks[b.id] = b; });
let nMax = 0, nDay = 0, back = 0;
for (const s of saves) {
  const uid = s.id, f = s.f; if (!uid || uid.indexOf("_") >= 0) continue;
  const mx = baks[uid + "_max"], keepMax = !mx || atLeast(score(f), score(mx.f));
  if (keepMax && !empty(f)) { await put(uid + "_max", f, uid, "max", day); nMax++; }
  if (!keepMax) back++;
  const dj = baks[uid + "_j" + dow];
  if (!empty(f) && (!dj || str(bk(dj.f).day) !== day)) { await put(uid + "_j" + dow, f, uid, "jour", day); nDay++; }
  // la partie du modo (et ses autres comptes « Jose ») : état visible dans le journal pour vérifier
  if (uid === ADMIN || /^jos[eé]/i.test(str(f.name))) {
    const msg = "Partie « " + str(f.name) + " »" + (uid === ADMIN ? " (compte du modo)" : "") + " : " + fmt(f) + ", dernière sauvegarde " + s.t +
      (mx && !keepMax ? " — ⚠️ EN RECUL : la copie la plus avancée (" + fmt(mx.f, true) + ") est gardée, à restaurer dans 🛟 Sauvegardes" : "");
    console.log("::notice title=Sauvegarde TCCCG::" + msg);
  }
}
console.log("Sauvegarde TCCCG : " + saves.length + " parties lues, " + nMax + " copies « la plus avancée » mises à jour, " + nDay + " copies du jour, " + back + " partie(s) en recul (copie gardée).");
