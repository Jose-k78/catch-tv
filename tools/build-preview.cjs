// Construit un fichier HTML unique (aperçu en mode démo) : node tools/build-preview.cjs sortie.html
const esbuild = require("/opt/npm-tools/node_modules/esbuild");
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const out = process.argv[2] || path.join(root, "preview.html");
(async () => {
const r = await esbuild.build({
  entryPoints: [path.join(root, "js/app.js")], bundle: true, format: "iife", write: false, minify: true, target: "es2019",
  plugins: [{ name: "inline-content", setup(b) {
    b.onResolve({ filter: /\/content\.js$/ }, () => ({ path: path.join(root, "js/content-inline.js") }));
    // logos (img/logos/…) intégrés en data URL pour que l'aperçu tout-en-un les affiche
    b.onLoad({ filter: /calendar\.json$/ }, a => {
      const txt = fs.readFileSync(a.path, "utf8").replace(/"(img\/logos\/[\w.-]+\.png)"/g, (m, f) => '"data:image/png;base64,' + fs.readFileSync(path.join(root, f)).toString("base64") + '"');
      return { contents: txt, loader: "json" };
    });
    // photos des catcheurs : seulement celles des noms cités dans les données de démo, en petit (aperçu léger)
    b.onLoad({ filter: /photos\.json$/ }, async a => {
      const sharp = require("/opt/npm-tools/node_modules/sharp");
      const key = s => " " + String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
      const txt = key(["calendar", "polls", "recaps", "highlights", "titles", "storylines", "matches", "wrestlers"].map(f => { try { return fs.readFileSync(path.join(root, "data", f + ".json"), "utf8"); } catch (e) { return ""; } }).join(" "));
      const P = JSON.parse(fs.readFileSync(a.path, "utf8")), items = {};
      for (const s of Object.keys(P.items)) {
        const it = P.items[s];
        if (![s.replace(/-/g, " ")].concat(it.n || []).some(n => txt.indexOf(key(n)) >= 0)) continue;
        try { items[s] = { f: "data:image/webp;base64," + (await sharp(path.join(root, "img/catcheurs", it.f)).resize(120, 120).webp({ quality: 70 }).toBuffer()).toString("base64"), n: it.n }; } catch (e) {}
      }
      return { contents: JSON.stringify({ updated: P.updated, items }), loader: "json" };
    });
    // logos (ceintures des titres actuels, shows, événements à venir, groupes actifs) : en petit, intégrés
    b.onLoad({ filter: /logos\.json$/ }, async a => {
      const sharp = require("/opt/npm-tools/node_modules/sharp");
      const L = JSON.parse(fs.readFileSync(a.path, "utf8")), out = { updated: L.updated, shows: {}, events: {}, titles: {}, groups: {} };
      const DIR = { shows: "img/shows/", events: "img/events/", titles: "img/titres/", groups: "img/groupes/" }, SZ = { shows: 120, events: 220, titles: 150, groups: 110 };
      const assets = fs.readFileSync(path.join(root, "js/assets.js"), "utf8");
      const belts = new Set([...assets.matchAll(/"[\w-]+": "([^"]+)"/g)].map(m => m[1]));
      const cal = fs.readFileSync(path.join(root, "data/calendar.json"), "utf8");
      const G = JSON.parse(fs.readFileSync(path.join(root, "data/groups.json"), "utf8")).items, activeG = new Set(Object.values(G).filter(g => g.on).map(g => g.lg));
      const want = { shows: n => true, titles: n => belts.has(n), groups: n => activeG.has(n), events: n => cal.indexOf(n.replace(/^\S+\s/, "").replace(/\s*\d+$/, "")) >= 0 && !/\d/.test(n.slice(-2)) };
      for (const sec of Object.keys(out).filter(k => k !== "updated")) for (const n of Object.keys(L[sec] || {})) {
        if (!want[sec](n)) continue;
        try { out[sec][n] = { f: "data:image/webp;base64," + (await sharp(path.join(root, DIR[sec], L[sec][n].f)).resize(SZ[sec], SZ[sec], { fit: "inside" }).webp({ quality: 72 }).toBuffer()).toString("base64") }; } catch (e) {}
      }
      return { contents: JSON.stringify(out), loader: "json" };
    });
  } }],
});
let html = fs.readFileSync(path.join(root, "dev.html"), "utf8").replace("<title>TCC TV (dev)</title>", "<title>TCC TV</title>");
const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
html = html.replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\n/g, "")
  .replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + css + "</style>")
  .replace('<script type="module" src="js/app.js"></script>', () => "<script>\n" + r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script") + "</script>");
if (process.argv[3] === "--artifact") {
  // la plateforme ajoute elle-même doctype/html/head/body
  html = html.replace(/<!doctype html>\s*/i, "").replace(/<\/?html[^>]*>\s*/g, "").replace(/<\/?head>\s*/g, "").replace(/<\/?body>\s*/g, "")
    .replace(/<meta charset="utf-8">\s*/, "").replace(/<meta name="viewport"[^>]*>\s*/, "");
  html = html.replace("<title>TCC TV</title>", "<title>TCC TV</title>");
  html = html.replace(/^/, "");
}
fs.writeFileSync(out, html);
console.log("ok", out, (html.length / 1024).toFixed(0) + " Ko");
})();
