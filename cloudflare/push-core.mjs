// TCC TV — outils communs pour envoyer les notifications (service Cloudflare et robot GitHub).
// Sans dépendance : WebCrypto + fetch (Cloudflare Workers et Node 20).
// FIREBASE_SA = la clé du compte de service Firebase (fichier JSON), gardée en secret sur GitHub et Cloudflare.

const enc = new TextEncoder();
const b64u = buf => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const b64uStr = str => b64u(enc.encode(str));
const unb64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
export const PARIS = "Europe/Paris";
export const parisDay = ms => new Intl.DateTimeFormat("en-CA", { timeZone: PARIS, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms || Date.now()));
export const parisHour = ms => +new Intl.DateTimeFormat("en-GB", { timeZone: PARIS, hour: "2-digit", hourCycle: "h23" }).format(new Date(ms || Date.now()));
export const prevDay = d => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

// ---------- jeton d'accès Google (compte de service) ----------
function pemToDer(pem) { return unb64u(String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "").replace(/\+/g, "-").replace(/\//g, "_")); }
let tokCache = null;
export async function accessToken(sa) {
  if (tokCache && tokCache.exp > Date.now() + 60e3 && tokCache.who === sa.client_email) return tokCache.t;
  const now = Math.floor(Date.now() / 1000);
  const head = b64uStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64uStr(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + head + "." + claim + "." + b64u(sig) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("jeton Google refusé (" + r.status + " " + (j.error_description || j.error || "") + ")");
  tokCache = { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, who: sa.client_email };
  return tokCache.t;
}

// ---------- vérification du jeton de connexion d'un membre (Firebase Auth) ----------
let jwks = null;
export async function verifyIdToken(tok, projectId) {
  const p = String(tok || "").split("."); if (p.length !== 3) throw new Error("jeton de connexion manquant");
  const head = JSON.parse(new TextDecoder().decode(unb64u(p[0]))), body = JSON.parse(new TextDecoder().decode(unb64u(p[1])));
  if (head.alg !== "RS256") throw new Error("jeton invalide");
  if (!jwks || jwks.exp < Date.now() || !jwks.keys.some(k => k.kid === head.kid)) {
    const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    jwks = { keys: ((await r.json()) || {}).keys || [], exp: Date.now() + 3600e3 };
  }
  const jwk = jwks.keys.find(k => k.kid === head.kid); if (!jwk) throw new Error("clé de signature inconnue");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(p[2]), enc.encode(p[0] + "." + p[1]));
  const now = Date.now() / 1000;
  if (!ok || body.aud !== projectId || body.iss !== "https://securetoken.google.com/" + projectId || !(body.exp > now) || !body.sub) throw new Error("jeton de connexion refusé");
  return body.sub;
}

// ---------- Firestore (API REST) ----------
const FS = pid => "https://firestore.googleapis.com/v1/projects/" + pid + "/databases/(default)/documents";
export function decode(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return fields((v.mapValue || {}).fields);
  if ("arrayValue" in v) return ((v.arrayValue || {}).values || []).map(decode);
  return null;
}
export function fields(f) { const o = {}; Object.keys(f || {}).forEach(k => { o[k] = decode(f[k]); }); return o; }
async function fsFetch(sa, url, opt) {
  const r = await fetch(url, Object.assign({}, opt || {}, { headers: Object.assign({ authorization: "Bearer " + await accessToken(sa), "content-type": "application/json" }, (opt || {}).headers || {}) }));
  if (r.status === 404) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Firestore " + r.status + " " + ((j.error || {}).message || ""));
  return j;
}
export async function getDoc(sa, path) { const j = await fsFetch(sa, FS(sa.project_id) + "/" + path); return j ? fields(j.fields) : null; }
// liste d'une collection (mask = champs à lire seulement)
export async function listDocs(sa, coll, mask) {
  const out = []; let page = "";
  for (let i = 0; i < 40; i++) {
    const q = "?pageSize=300" + (mask || []).map(m => "&mask.fieldPaths=" + encodeURIComponent(m)).join("") + (page ? "&pageToken=" + encodeURIComponent(page) : "");
    const j = await fsFetch(sa, FS(sa.project_id) + "/" + coll + q); if (!j) break;
    (j.documents || []).forEach(d => out.push(Object.assign({ _id: d.name.split("/").pop() }, fields(d.fields))));
    if (!j.nextPageToken) break; page = j.nextPageToken;
  }
  return out;
}
// dernier message d'une discussion privée
export async function lastMessage(sa, conv) {
  const j = await fsFetch(sa, FS(sa.project_id) + "/dms/" + encodeURIComponent(conv) + ":runQuery", { method: "POST",
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "messages" }], orderBy: [{ field: { fieldPath: "at" }, direction: "DESCENDING" }], limit: 1 } }) });
  const d = (j || []).find(x => x.document); return d ? fields(d.document.fields) : null;
}
// retire un champ (jeton expiré) d'un document
export async function dropField(sa, path, field) {
  await fsFetch(sa, FS(sa.project_id) + "/" + path + "?updateMask.fieldPaths=" + encodeURIComponent(field) + "&currentDocument.exists=true", { method: "PATCH", body: JSON.stringify({ fields: {} }) });
}

// ---------- envoi (Firebase Cloud Messaging) ----------
// msg = { title, body, url, tag } ; push = document push/{uid} : { tok: { clé: { t: jeton } }, on: {...} }
export async function sendTo(sa, uid, push, msg) {
  const toks = Object.keys((push && push.tok) || {}).map(k => ({ k: k, t: (push.tok[k] || {}).t })).filter(x => typeof x.t === "string" && x.t.length > 20);
  let ok = 0;
  for (const x of toks) {
    const r = await fetch("https://fcm.googleapis.com/v1/projects/" + sa.project_id + "/messages:send", { method: "POST",
      headers: { authorization: "Bearer " + await accessToken(sa), "content-type": "application/json" },
      body: JSON.stringify({ message: { token: x.t, data: { title: String(msg.title || "TCC TV").slice(0, 120), body: String(msg.body || "").slice(0, 300), url: String(msg.url || "#/").slice(0, 300), tag: String(msg.tag || "").slice(0, 60) },
        webpush: { headers: { Urgency: "high", TTL: "86400" } } } }) });
    if (r.ok) { ok++; continue; }
    const j = await r.json().catch(() => ({})), why = JSON.stringify(j);
    // téléphone désinscrit : on oublie ce jeton
    if (r.status === 404 || /UNREGISTERED|registration-token-not-registered|NOT_FOUND/.test(why)) await dropField(sa, "push/" + uid, "tok." + x.k).catch(() => {});
  }
  return ok;
}
export const wants = (push, kind) => !!push && !!push.tok && Object.keys(push.tok).length > 0 && !(push.on && push.on[kind] === false);
