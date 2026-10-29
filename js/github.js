// Petit client GitHub pour l'admin : lire / enregistrer un fichier de données du dépôt (data/sources.json…)
// avec une clé personnelle (fine-grained token, droit « Contents : Read and write » sur le seul dépôt de l'app).
// La clé reste sur l'appareil de l'admin (stockage local), elle n'est jamais envoyée ailleurs qu'à api.github.com.
import { GH_REPO } from "./config.js";
import { lsGet, lsSet } from "./util.js";

const TK = "ctv.ghtoken", BASE = "https://api.github.com/repos/" + GH_REPO;
export const ghToken = () => lsGet(TK) || "";
export const setGhToken = t => lsSet(TK, t || null);
const H = t => Object.assign({ Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, t ? { Authorization: "Bearer " + t } : {});
const b64 = s => btoa(unescape(encodeURIComponent(s)));
const unb64 = s => decodeURIComponent(escape(atob(String(s || "").replace(/\s/g, ""))));
const fail = (r, what) => new Error(r.status === 401 ? "Clé GitHub refusée (expirée ou mal copiée)" : r.status === 403 ? "GitHub refuse l’accès (droits de la clé, ou trop de demandes : réessaie dans une heure)" : r.status === 404 ? "Dépôt ou fichier introuvable" : (what || "GitHub") + " : erreur " + r.status);

// La clé peut-elle modifier le dépôt ?
export async function ghCheck(t) {
  const r = await fetch(BASE, { headers: H(t) });
  if (!r.ok) throw fail(r);
  const j = await r.json();
  if (!(j.permissions && j.permissions.push)) throw new Error("Cette clé peut lire le dépôt mais pas le modifier : donne-lui le droit « Contents : Read and write »");
  return true;
}
export async function ghGetJson(path) {
  const r = await fetch(BASE + "/contents/" + path + "?ref=main", { headers: H(ghToken()), cache: "no-store" });
  if (r.status === 404) return { data: null, sha: "" };
  if (!r.ok) throw fail(r);
  const j = await r.json();
  return { data: JSON.parse(unb64(j.content)), sha: j.sha };
}
// Enregistre un fichier JSON (un commit sur main) ; réessaie une fois si une mise à jour automatique est passée entre-temps
export async function ghPutJson(path, obj, message, tries) {
  const t = ghToken(); if (!t) throw new Error("nokey");
  const cur = await ghGetJson(path);
  const body = { message: message, branch: "main", content: b64(JSON.stringify(obj, null, 1) + "\n") };
  if (cur.sha) body.sha = cur.sha;
  const r = await fetch(BASE + "/contents/" + path, { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, H(t)), body: JSON.stringify(body) });
  if ((r.status === 409 || r.status === 422) && (tries == null || tries > 0)) return ghPutJson(path, obj, message, (tries == null ? 1 : tries) - 1);
  if (!r.ok) throw fail(r, "Enregistrement");
  return true;
}
// Derniers envois sur le dépôt (lisible sans clé)
export async function ghCommits(n) {
  const r = await fetch(BASE + "/commits?sha=main&per_page=" + (n || 10), { headers: H(ghToken()) });
  if (!r.ok) throw fail(r);
  return (await r.json()).map(c => ({ sha: c.sha, msg: String((c.commit && c.commit.message) || "").split("\n")[0], at: Date.parse((c.commit && c.commit.committer && c.commit.committer.date) || "") || 0 }));
}
// Fichier binaire (vidéo MP4, musique MP3) envoyé depuis le téléphone de l'admin : contenu déjà en base64
export async function ghPutBinary(path, b64content, message) {
  const t = ghToken(); if (!t) throw new Error("nokey");
  const r = await fetch(BASE + "/contents/" + path, { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, H(t)), body: JSON.stringify({ message: message, branch: "main", content: b64content }) });
  if (!r.ok) throw fail(r, "Envoi du fichier");
  return true;
}
// Supprime un fichier du dépôt (ancien fond animé ou ancienne musique) ; sans erreur s'il n'existe plus
export async function ghDelete(path, message) {
  const t = ghToken(); if (!t) throw new Error("nokey");
  const g = await fetch(BASE + "/contents/" + path + "?ref=main", { headers: H(t), cache: "no-store" });
  if (g.status === 404) return false;
  if (!g.ok) throw fail(g);
  const j = await g.json();
  const r = await fetch(BASE + "/contents/" + path, { method: "DELETE", headers: Object.assign({ "Content-Type": "application/json" }, H(t)), body: JSON.stringify({ message: message, branch: "main", sha: j.sha }) });
  if (!r.ok && r.status !== 404) throw fail(r, "Suppression");
  return true;
}
// ArrayBuffer -> base64, par morceaux (un fichier de quelques Mo dépasse la taille d'appel de String.fromCharCode)
export function bufToB64(buf) {
  const u = new Uint8Array(buf); let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
