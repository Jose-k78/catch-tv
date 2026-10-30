// TCC TV — notifications instantanées (service Cloudflare, gratuit) : messages privés, feuds, annonces du modérateur.
// L'app appelle POST /notify avec le jeton de connexion du membre ; le service vérifie tout dans Firebase avant d'envoyer.
// Installé et mis à jour automatiquement par GitHub (.github/workflows/push-worker.yml) : rien à modifier dans Cloudflare.
import { verifyIdToken, getDoc, listDocs, lastMessage, sendTo, wants, parisDay, prevDay, parseSA } from "./push-core.mjs";
import { feudAct } from "./feud-acts.mjs";

const json = (o, h, status) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ "content-type": "application/json" }, h) });
const cardLabel = c => !c ? "" : c.sp ? "🙈 Spoiler partagé" : "📎 " + String(c.t || "");

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "", allow = String(env.ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const cors = { "Access-Control-Allow-Origin": allow.indexOf(origin) >= 0 ? origin : (allow[0] || "*"), "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", Vary: "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (req.method === "GET") { let ready = false, why = ""; try { ready = !!parseSA(env.FIREBASE_SA); } catch (e) { why = e.message; } return json({ ok: true, service: "TCC TV notifications", ready: ready, why: why }, cors); }
    if (url.pathname !== "/notify") return json({ error: "introuvable" }, cors, 404);
    if (allow.length && allow.indexOf(origin) < 0) return json({ error: "origine refusée" }, cors, 403);
    try {
      const body = JSON.parse(await req.text());
      const sa = parseSA(env.FIREBASE_SA); if (!sa) throw new Error("clé Firebase absente");
      const uid = await verifyIdToken(body.idToken, sa.project_id);
      return json(await handle(body, uid, sa, env), cors);
    } catch (e) { return json({ error: String((e && e.message) || e) }, cors, 400); }
  }
};

async function pseudo(sa, uid) { const u = await getDoc(sa, "users/" + uid).catch(() => null); return (u && u.pseudo) || "Un membre"; }
async function blocked(sa, by, uid) { const b = await getDoc(sa, "blocks/" + by).catch(() => null); return !!b && Array.isArray(b.list) && b.list.indexOf(uid) >= 0; }

async function handle(b, uid, sa, env) {
  const now = Date.now();
  // ---- message privé (ou carte partagée en privé)
  if (b.type === "dm") {
    const conv = String(b.conv || ""), pair = conv.split("_");
    if (pair.length !== 2 || pair.indexOf(uid) < 0) throw new Error("discussion refusée");
    const other = pair[0] === uid ? pair[1] : pair[0];
    const m = await lastMessage(sa, conv);
    if (!m || m.uid !== uid || now - (m.at || 0) > 120e3) return { sent: 0, why: "pas de nouveau message" };
    const push = await getDoc(sa, "push/" + other);
    if (!wants(push, "dm") || await blocked(sa, other, uid)) return { sent: 0 };
    const rd = await getDoc(sa, "reads/" + other).catch(() => null), cp = rd && rd.cp && rd.cp[conv];
    if (cp && (cp.mute || 0) > now) return { sent: 0, why: "sourdine" };
    const name = await pseudo(sa, uid), prev = !(push.on && push.on.prev === false);
    const txt = m.text || (m.card ? cardLabel(m.card) : m.gif ? "GIF" : m.img ? "📷 Photo" : "");
    return { sent: await sendTo(sa, other, push, { title: "💬 " + name, body: prev ? txt : "Nouveau message", url: "#/chat/" + conv, tag: "dm-" + conv }) };
  }
  // ---- feud du jour lancée ou renvoyée
  if (b.type === "feud") {
    const other = String(b.other || ""); if (!other || other === uid) throw new Error("membre manquant");
    const id = [uid, other].sort().join("_"), f = await getDoc(sa, "feuds/" + id), day = parisDay(now);
    if (!f || !f.days || f.days[uid] !== day) return { sent: 0, why: "pas de feud aujourd’hui" };
    const push = await getDoc(sa, "push/" + other);
    if (!wants(push, "feud") || await blocked(sa, other, uid)) return { sent: 0 };
    const name = await pseudo(sa, uid), back = f.days[other] === day;
    const n = f.countDay === day || f.countDay === prevDay(day) ? (f.count || 0) : 0;
    // l'action du jour tirée au hasard (la même que celle affichée dans l'app)
    const act = name + " " + feudAct(id, uid, day).b;
    return { sent: await sendTo(sa, other, push, { title: back ? "🔥 Feud · " + n + " jour" + (n > 1 ? "s" : "") + " d’affilée" : "🔥 Feud", body: act + (back ? "" : " Réponds avant minuit !"), url: "#/profil/" + uid, tag: "feud-" + id }) };
  }
  // ---- annonce du modérateur : à tous les membres
  if (b.type === "ann") {
    if (uid !== env.ADMIN_UID) throw new Error("réservé au modérateur");
    const a = await getDoc(sa, "annonces/" + String(b.id || "")); if (!a || !a.t) throw new Error("annonce introuvable");
    const all = await listDocs(sa, "push"); let sent = 0, members = 0;
    for (const p of all) { if (!wants(p, "ann")) continue; members++; sent += await sendTo(sa, p._id, p, { title: "📣 " + a.t, body: a.x || "", url: a.h || "#/notifs", tag: "ann-" + b.id }); }
    return { sent: sent, members: members };
  }
  // ---- notification de test (pour soi)
  if (b.type === "test") {
    const push = await getDoc(sa, "push/" + uid);
    return { sent: await sendTo(sa, uid, push, { title: "🔔 TCC TV", body: "Les notifications marchent sur ce téléphone 👍", url: "#/parametres/notifs", tag: "test" }) };
  }
  throw new Error("type inconnu");
}
