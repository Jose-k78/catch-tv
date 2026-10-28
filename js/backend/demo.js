// Backend « mode démo » : même interface que firebase.js, mais tout reste
// dans le navigateur (localStorage). Les onglets ouverts se synchronisent entre eux.
import { feudNext } from "../feud.js";
const KEY = "ctv.demo.db";
const SKEY = "ctv.demo.uid";
const EMPTY = () => ({ accounts: {}, users: {}, history: {}, images: {}, room: [], dms: {}, msgs: {}, reads: {}, admin: "", friends: {}, feuds: {}, blocks: {}, reports: [], followed: [] });

let DB = EMPTY();
const subs = new Set();
const authSubs = new Set();
let bc = null;

function load() { try { return Object.assign(EMPTY(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return EMPTY(); } }
function notify() { subs.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); }
  catch (e) { DB = load(); throw { code: "demo/quota" }; }
  if (bc) bc.postMessage("x");
  notify();
}
function watch(fn) { subs.add(fn); Promise.resolve().then(fn); return () => subs.delete(fn); }
const clone = o => JSON.parse(JSON.stringify(o));
const uidGen = () => "demo" + Math.random().toString(36).slice(2, 12);

export async function init() {
  DB = load();
  try { bc = new BroadcastChannel("ctv-demo"); bc.onmessage = () => { DB = load(); notify(); authSubs.forEach(f => f(current())); }; } catch (e) {}
  window.addEventListener("storage", e => { if (e.key === KEY) { DB = load(); notify(); } });
}
export const isDemo = true;
export function demoAdmin() { return DB.admin; }

async function hash(s) {
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ctv:" + s));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
  }
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return "x" + h;
}
function sess() { try { return sessionStorage.getItem(SKEY); } catch (e) { return null; } }
function setSess(v) { try { if (v) sessionStorage.setItem(SKEY, v); else sessionStorage.removeItem(SKEY); } catch (e) {} }
function current() {
  const uid = sess(); if (!uid) return null;
  const acc = Object.values(DB.accounts).find(a => a.uid === uid);
  return acc ? { uid: acc.uid, email: acc.email, providers: ["password"] } : null;
}
function fireAuth() { const u = current(); authSubs.forEach(f => f(u)); }
export function onAuth(cb) { authSubs.add(cb); Promise.resolve().then(() => cb(current())); return () => authSubs.delete(cb); }

export async function signUp(email, password, pseudo) {
  const k = email.toLowerCase();
  if (DB.accounts[k]) throw { code: "auth/email-already-in-use" };
  if (password.length < 6) throw { code: "auth/weak-password" };
  const uid = uidGen();
  DB.accounts[k] = { uid: uid, email: email, pass: await hash(password) };
  const p = String(pseudo || "Fan de catch").slice(0, 30);
  DB.users[uid] = { pseudo: p, pseudoLower: p.toLowerCase(), bio: "", favShow: "", favWrestler: "", favWrestlerF: "", photo: "", createdAt: Date.now() };
  if (!DB.admin) DB.admin = uid;
  save(); setSess(uid); fireAuth();
}
export async function signIn(email, password) {
  const a = DB.accounts[email.toLowerCase()];
  if (!a || a.pass !== await hash(password)) throw { code: "auth/invalid-credential" };
  setSess(a.uid); fireAuth();
}
export async function signInGoogle() { throw { code: "demo/google" }; }
export const googleAvailable = false;
export async function signOut() { setSess(null); fireAuth(); }
export async function resetPassword() { throw { code: "demo/reset" }; }
export async function changePassword(current, next) {
  const u = current_(); const a = DB.accounts[u.email.toLowerCase()];
  if (a.pass !== await hash(current)) throw { code: "auth/invalid-credential" };
  if (next.length < 6) throw { code: "auth/weak-password" };
  a.pass = await hash(next); save();
}
export async function changeEmail(newEmail, current) {
  const u = current_(); const k = u.email.toLowerCase(); const a = DB.accounts[k];
  if (a.pass !== await hash(current)) throw { code: "auth/invalid-credential" };
  if (DB.accounts[newEmail.toLowerCase()]) throw { code: "auth/email-already-in-use" };
  delete DB.accounts[k]; a.email = newEmail; DB.accounts[newEmail.toLowerCase()] = a; save(); fireAuth();
  return "done";
}
function current_() { const u = current(); if (!u) throw { code: "auth/no-user" }; return u; }

export function watchUser(uid, cb) { return watch(() => { const u = DB.users[uid]; cb(u ? Object.assign(clone(u), { uid: uid }) : null); }); }
export async function saveProfile(uid, patch) {
  const p = Object.assign({}, patch); if (p.pseudo != null) p.pseudoLower = p.pseudo.toLowerCase();
  DB.users[uid] = Object.assign(DB.users[uid] || {}, p); save();
}
export async function listUsers() { return Object.keys(DB.users).map(uid => Object.assign(clone(DB.users[uid]), { uid: uid })).sort((a, b) => a.pseudoLower.localeCompare(b.pseudoLower)); }

export function watchHistory(uid, cb) { return watch(() => { const h = DB.history[uid] || {}; cb(Object.keys(h).map(id => Object.assign(clone(h[id]), { id: id }))); }); }
export async function setSeen(uid, id, item) {
  DB.history[uid] = DB.history[uid] || {};
  DB.history[uid][id] = { title: item.title, k: item.k, show: item.show || "", d: item.d || "", rating: item.rating || 0, comment: item.comment || "", seenAt: Date.now() }; save();
}
export async function unsetSeen(uid, id) { if (DB.history[uid]) { delete DB.history[uid][id]; save(); } }

export function watchImages(cb) { return watch(() => cb(clone(DB.images))); }
export async function setImage(id, src) { DB.images[id] = src; save(); }
export async function removeImage(id) { delete DB.images[id]; save(); }

export function watchRoom(cb) { return watch(() => cb(clone(DB.room.slice(-60)))); }
export async function sendRoom(uid, text) { DB.room.push({ id: uidGen(), uid: uid, text: text, at: Date.now() }); save(); }
export function watchConvs(uid, cb) {
  return watch(() => cb(Object.keys(DB.dms).map(id => Object.assign(clone(DB.dms[id]), { id: id }))
    .filter(c => c.members.indexOf(uid) >= 0).sort((a, b) => b.updatedAt - a.updatedAt)));
}
export async function openDM(me, other) {
  const members = [me, other].sort(), id = members.join("_");
  if (!DB.dms[id]) { const unread = {}; unread[members[0]] = 0; unread[members[1]] = 0; DB.dms[id] = { members: members, last: null, unread: unread, updatedAt: Date.now() }; save(); }
  return id;
}
export function watchMessages(convId, cb) { return watch(() => cb(clone((DB.msgs[convId] || []).slice(-100)))); }
export async function sendDM(convId, uid, other, text) {
  const now = Date.now();
  (DB.msgs[convId] = DB.msgs[convId] || []).push({ id: uidGen(), uid: uid, text: text, at: now });
  const c = DB.dms[convId]; c.last = { text: text.slice(0, 140), uid: uid, at: now }; c.updatedAt = now; c.unread[other] = (c.unread[other] || 0) + 1; save();
}
export async function markDMRead(convId, uid) { const c = DB.dms[convId]; if (c && c.unread[uid]) { c.unread[uid] = 0; save(); } }
export function watchReads(uid, cb) { return watch(() => cb(clone(DB.reads[uid] || {}))); }
export async function markRoomRead(uid) { DB.reads[uid] = { general: Date.now() }; save(); }
export async function ensureProfile() {}

// ---- Modération des messages ----
export async function deleteRoomMsg(id) { DB.room = DB.room.filter(m => m.id !== id); save(); }
export async function deleteDM(convId, id) { DB.msgs[convId] = (DB.msgs[convId] || []).filter(m => m.id !== id); save(); }
export async function fixLast(convId, text) { const c = DB.dms[convId]; if (c && c.last) { c.last.text = text; save(); } }

// ---- Amis ----
export function watchFriends(uid, cb) { return watch(() => cb(Object.keys(DB.friends).map(id => Object.assign(clone(DB.friends[id]), { id: id })).filter(f => f.members.indexOf(uid) >= 0))); }
export async function requestFriend(me, other) { const m = [me, other].sort(); DB.friends[m.join("_")] = { members: m, from: me, status: "pending", at: Date.now() }; save(); }
export async function acceptFriend(id) { if (DB.friends[id]) { DB.friends[id].status = "ok"; save(); } }
export async function removeFriend(id) { delete DB.friends[id]; save(); }

// ---- Feuds ----
export function watchFeuds(uid, cb) { return watch(() => cb(Object.keys(DB.feuds).map(id => Object.assign(clone(DB.feuds[id]), { id: id })).filter(f => f.members.indexOf(uid) >= 0))); }
export async function sendFeud(me, other, day) {
  const m = [me, other].sort(), id = m.join("_"), cur = DB.feuds[id] || null;
  const nx = feudNext(cur, me, other, day); if (!nx) return null;
  DB.feuds[id] = Object.assign({ members: m }, nx, { updatedAt: Date.now() }); save();
  return nx;
}

// ---- Bloqués, signalements, catcheurs suivis ----
export function watchBlocks(uid, cb) { return watch(() => cb(clone(DB.blocks[uid] || []))); }
export async function setBlocks(uid, list) { DB.blocks[uid] = list.slice(0, 500); save(); }
export async function report(by, r) { DB.reports.unshift(Object.assign({ id: uidGen(), by: by, at: Date.now() }, r)); save(); }
export function watchReports(cb) { return watch(() => cb(clone(DB.reports))); }
export async function deleteReport(id) { DB.reports = DB.reports.filter(r => r.id !== id); save(); }
export async function addFollowed(name) { if (DB.followed.indexOf(name) < 0) { DB.followed.push(name); save(); } }
