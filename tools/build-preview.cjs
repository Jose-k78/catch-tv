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
  } }],
});
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
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
