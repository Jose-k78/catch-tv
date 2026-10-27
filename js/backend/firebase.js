// Backend Firebase (Authentication + Cloud Firestore), chargé depuis le CDN officiel.
const V = "10.14.1";
const BASE = "https://www.gstatic.com/firebasejs/" + V + "/";

let A, F, auth, db;

const ms = v => (v && typeof v.toMillis === "function") ? v.toMillis() : (typeof v === "number" ? v : 0);
const data = s => s.data({ serverTimestamps: "estimate" });

export async function init(config) {
  const appMod = await import(BASE + "firebase-app.js");
  A = await import(BASE + "firebase-auth.js");
  F = await import(BASE + "firebase-firestore.js");
  const app = appMod.initializeApp(config);
  auth = A.getAuth(app);
  auth.languageCode = "fr";
  db = F.getFirestore(app);
}

function mapUser(u) {
  if (!u) return null;
  return { uid: u.uid, email: u.email || "", providers: (u.providerData || []).map(p => p.providerId) };
}
export function onAuth(cb) { return A.onAuthStateChanged(auth, u => cb(mapUser(u))); }

export async function ensureProfile(user, pseudo) {
  const ref = F.doc(db, "users", user.uid);
  const s = await F.getDoc(ref);
  if (!s.exists()) {
    const p = String(pseudo || "Fan de catch").slice(0, 30);
    await F.setDoc(ref, { pseudo: p, pseudoLower: p.toLowerCase(), bio: "", favShow: "", favWrestler: "", favWrestlerF: "", photo: "", createdAt: F.serverTimestamp() });
  }
}
export async function signUp(email, password, pseudo) {
  const c = await A.createUserWithEmailAndPassword(auth, email, password);
  await ensureProfile(c.user, pseudo);
}
export async function signIn(email, password) {
  const c = await A.signInWithEmailAndPassword(auth, email, password);
  await ensureProfile(c.user, email.split("@")[0]);
}
export async function signInGoogle() {
  const c = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
  await ensureProfile(c.user, c.user.displayName || "Fan de catch");
}
export const googleAvailable = true;
export function signOut() { return A.signOut(auth); }
export function resetPassword(email) { return A.sendPasswordResetEmail(auth, email); }
async function reauth(current) {
  const u = auth.currentUser;
  await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, current));
  return u;
}
export async function changePassword(current, next) { const u = await reauth(current); await A.updatePassword(u, next); }
export async function changeEmail(newEmail, current) { const u = await reauth(current); await A.verifyBeforeUpdateEmail(u, newEmail); return "verify"; }

// ---- Profils ----
export function watchUser(uid, cb) {
  return F.onSnapshot(F.doc(db, "users", uid), s => {
    if (!s.exists()) return cb(null);
    const d = data(s); d.uid = uid; d.createdAt = ms(d.createdAt); cb(d);
  }, () => cb(null));
}
export function saveProfile(uid, patch) {
  const p = Object.assign({}, patch);
  if (p.pseudo != null) p.pseudoLower = p.pseudo.toLowerCase();
  return F.updateDoc(F.doc(db, "users", uid), p);
}
export async function listUsers() {
  const q = F.query(F.collection(db, "users"), F.orderBy("pseudoLower"), F.limit(300));
  const r = await F.getDocs(q);
  return r.docs.map(s => { const d = data(s); d.uid = s.id; d.createdAt = ms(d.createdAt); return d; });
}

// ---- Historique « déjà vu » ----
export function watchHistory(uid, cb) {
  return F.onSnapshot(F.collection(db, "users", uid, "history"), r => {
    cb(r.docs.map(s => { const d = data(s); d.id = s.id; d.seenAt = ms(d.seenAt) || Date.now(); return d; }));
  }, () => cb([]));
}
export function setSeen(uid, id, item) {
  return F.setDoc(F.doc(db, "users", uid, "history", id), {
    title: item.title, k: item.k, show: item.show || "", d: item.d || "", rating: item.rating || 0, comment: item.comment || "", seenAt: F.serverTimestamp()
  });
}
export function unsetSeen(uid, id) { return F.deleteDoc(F.doc(db, "users", uid, "history", id)); }

// ---- Images des vignettes (admin) ----
export function watchImages(cb) {
  return F.onSnapshot(F.collection(db, "images"), r => {
    const m = {}; r.docs.forEach(s => { m[s.id] = s.data().src; }); cb(m);
  }, () => cb({}));
}
export function setImage(id, src, uid) { return F.setDoc(F.doc(db, "images", id), { src: src, by: uid, at: F.serverTimestamp() }); }
export function removeImage(id) { return F.deleteDoc(F.doc(db, "images", id)); }

// ---- Messagerie ----
const mapMsg = s => { const d = data(s); return { id: s.id, uid: d.uid, text: d.text, at: ms(d.at) || Date.now() }; };

export function watchRoom(cb) {
  const q = F.query(F.collection(db, "rooms", "general", "messages"), F.orderBy("at", "desc"), F.limit(60));
  return F.onSnapshot(q, r => cb(r.docs.map(mapMsg).reverse()), () => cb([]));
}
export function sendRoom(uid, text) {
  return F.addDoc(F.collection(db, "rooms", "general", "messages"), { uid: uid, text: text, at: F.serverTimestamp() });
}
export function watchConvs(uid, cb) {
  const q = F.query(F.collection(db, "dms"), F.where("members", "array-contains", uid));
  return F.onSnapshot(q, r => {
    cb(r.docs.map(s => {
      const d = data(s);
      return { id: s.id, members: d.members || [], unread: d.unread || {}, updatedAt: ms(d.updatedAt),
        last: d.last ? { text: d.last.text, uid: d.last.uid, at: ms(d.last.at) } : null };
    }).sort((a, b) => b.updatedAt - a.updatedAt));
  }, () => cb([]));
}
export async function openDM(me, other) {
  const members = [me, other].sort();
  const id = members.join("_");
  const ref = F.doc(db, "dms", id);
  const s = await F.getDoc(ref);
  if (!s.exists()) {
    const unread = {}; unread[members[0]] = 0; unread[members[1]] = 0;
    await F.setDoc(ref, { members: members, last: null, unread: unread, updatedAt: F.serverTimestamp() });
  }
  return id;
}
export function watchMessages(convId, cb) {
  const q = F.query(F.collection(db, "dms", convId, "messages"), F.orderBy("at", "desc"), F.limit(100));
  return F.onSnapshot(q, r => cb(r.docs.map(mapMsg).reverse()), () => cb([]));
}
export async function sendDM(convId, uid, other, text) {
  const b = F.writeBatch(db);
  b.set(F.doc(F.collection(db, "dms", convId, "messages")), { uid: uid, text: text, at: F.serverTimestamp() });
  const patch = { last: { text: text.slice(0, 140), uid: uid, at: F.serverTimestamp() }, updatedAt: F.serverTimestamp() };
  patch["unread." + other] = F.increment(1);
  b.update(F.doc(db, "dms", convId), patch);
  await b.commit();
}
export function markDMRead(convId, uid) {
  const p = {}; p["unread." + uid] = 0;
  return F.updateDoc(F.doc(db, "dms", convId), p);
}
export function watchReads(uid, cb) {
  return F.onSnapshot(F.doc(db, "reads", uid), s => {
    const d = s.exists() ? data(s) : {}; cb({ general: ms(d.general) });
  }, () => cb({}));
}
export function markRoomRead(uid) { return F.setDoc(F.doc(db, "reads", uid), { general: F.serverTimestamp() }, { merge: true }); }
