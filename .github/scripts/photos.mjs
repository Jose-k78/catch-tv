// Robot TCC TV : tient à jour la liste des photos des catcheurs (data/photos.json) d'après le dossier img/catcheurs/.
// - photo ajoutée par l'admin  -> reconnue d'après son nom de fichier (« Becky Lynch.png » ou « becky-lynch.webp »),
//   et prioritaire sur l'ancienne photo du même catcheur (elle passe en tête de liste) ;
// - photo supprimée            -> retirée de la liste ;
// - photo trop lourde (> 400 Ko) -> remplacée par une copie légère (WebP 300×300) pour que l'app reste rapide.
// Les autres noms (alias) déjà notés pour une photo sont gardés.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const DIR = "img/catcheurs", OUT = "data/photos.json";
const IMG = /\.(?:webp|png|jpe?g|gif)$/i, HEAVY = 400 * 1024;
const key = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "");
const slugOf = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "-and-").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
const nameOf = stem => stem.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b[a-z]/g, c => c.toUpperCase());

if (!fs.existsSync(DIR)) { console.log("Pas de dossier " + DIR); process.exit(0); }
let files = fs.readdirSync(DIR).filter(f => IMG.test(f) && fs.statSync(path.join(DIR, f)).isFile());
let idx = { updated: "", items: {} };
try { idx = JSON.parse(fs.readFileSync(OUT, "utf8")); if (!idx.items) idx.items = {}; } catch (e) { console.log("photos.json illisible : on repart de zéro"); }

const known = new Set(Object.values(idx.items).map(it => it && it.f));
let fresh = files.filter(f => !known.has(f));

// photos neuves trop lourdes : copie légère en WebP (si l'outil s'installe ; sinon on garde le fichier tel quel)
const heavy = fresh.filter(f => fs.statSync(path.join(DIR, f)).size > HEAVY);
if (heavy.length) {
  try {
    const tmp = "/tmp/tcc-sharp";
    if (!fs.existsSync(tmp + "/node_modules/sharp")) execSync("npm i --prefix " + tmp + " sharp@0.33.5 --no-save --no-audit --no-fund --silent", { stdio: "inherit", timeout: 120000 });
    const sharp = createRequire(tmp + "/")("sharp");
    for (const f of heavy) {
      const stem = f.replace(IMG, ""), out = slugOf(stem) + ".webp";
      if (out !== f && files.includes(out)) { console.log("Déjà une photo " + out + " : " + f + " gardée telle quelle"); continue; }
      const buf = await sharp(path.join(DIR, f)).rotate().resize(300, 300, { fit: "cover", position: sharp.strategy.attention }).webp({ quality: 82, alphaQuality: 90 }).toBuffer();
      if (out !== f) fs.unlinkSync(path.join(DIR, f));
      fs.writeFileSync(path.join(DIR, out), buf);
      files = files.filter(x => x !== f).concat(out === f ? [] : [out]);
      fresh = fresh.map(x => (x === f ? out : x));
      console.log("Allégée : " + f + " -> " + out + " (" + Math.round(buf.length / 1024) + " Ko)");
    }
  } catch (e) { console.log("Allègement impossible (" + e.message + ") : photos gardées telles quelles"); }
}

// photos disparues : retirées de la liste
const have = new Set(files);
let gone = 0;
for (const s of Object.keys(idx.items)) { const it = idx.items[s]; if (!it || !have.has(it.f)) { delete idx.items[s]; gone++; } }

// photos neuves : en tête de liste (la plus récente gagne), reprend les alias de l'ancienne photo du même catcheur
const head = {};
for (const f of fresh) {
  const stem = f.replace(IMG, ""), name = nameOf(stem), k = key(name);
  let slug = slugOf(stem); while (idx.items[slug] || head[slug]) slug += "-2";
  const old = Object.values(idx.items).find(it => [it.f.replace(IMG, "")].concat(it.n || []).some(n => key(n) === k));
  const names = [name].concat(old && old.n ? old.n.filter(n => key(n) !== k) : []);
  head[slug] = { f, n: names };
  console.log("Nouvelle photo : " + f + " -> " + names.join(", "));
}

if (!fresh.length && !gone) { console.log("Photos : rien de neuf (" + files.length + ")"); process.exit(0); }
idx = { updated: new Date().toISOString().slice(0, 10), items: Object.assign(head, idx.items) };
fs.writeFileSync(OUT, JSON.stringify(idx, null, 1) + "\n");
console.log("Photos : " + Object.keys(idx.items).length + " dans la liste (" + fresh.length + " neuve(s), " + gone + " retirée(s))");
