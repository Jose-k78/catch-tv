// Mode Univers : 3 sauvegardes, gardées sur le téléphone (IndexedDB ; si indisponible, localStorage).
// La liste des parties (petite) est dans localStorage « ctv.univ.meta », la partie complète dans IndexedDB « ctv-univers ».
const DB = "ctv-univers", STORE = "saves", META = "ctv.univ.meta";
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore(STORE); } catch (e) {} };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error("idb"));
    } catch (e) { rej(e); }
  });
  return dbp;
}
const tx = (mode, fn) => db().then(d => new Promise((res, rej) => { const t = d.transaction(STORE, mode), s = t.objectStore(STORE), q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
export function metaAll() { try { const m = JSON.parse(localStorage.getItem(META) || "[]"); return Array.isArray(m) ? m : []; } catch (e) { return []; } }
function metaSet(slot, v) { const m = metaAll().filter(x => x && x.slot !== slot); if (v) m.push(Object.assign({ slot: slot }, v)); m.sort((a, b) => a.slot - b.slot); try { localStorage.setItem(META, JSON.stringify(m)); } catch (e) {} }
export async function saveSlot(slot, G, meta) {
  const s = JSON.stringify(G);
  try { await tx("readwrite", st => st.put(s, "slot" + slot)); }
  catch (e) { try { localStorage.setItem("ctv.univ.s" + slot, s); } catch (er) { throw new Error("Pas assez de place pour sauvegarder"); } }
  metaSet(slot, meta);
}
export async function loadSlot(slot) {
  let s = null;
  try { s = await tx("readonly", st => st.get("slot" + slot)); } catch (e) { s = null; }
  if (!s) { try { s = localStorage.getItem("ctv.univ.s" + slot); } catch (e) { s = null; } }
  return s ? JSON.parse(s) : null;
}
export async function delSlot(slot) {
  try { await tx("readwrite", st => st.delete("slot" + slot)); } catch (e) {}
  try { localStorage.removeItem("ctv.univ.s" + slot); } catch (e) {}
  metaSet(slot, null);
}
