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
  html = html.replace("<title>Catch TV</title>", "<title>Catch TV v3</title>");
  html = html.replace(/^/, "");
}
fs.writeFileSync(out, html);
console.log("ok", out, (html.length / 1024).toFixed(0) + " Ko");
})();
