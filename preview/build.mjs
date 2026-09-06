/* Builds the standalone preview page: bundles the app, inlines the self-hosted
   font CSS and the JS, and writes one self-contained HTML file. */
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "lipidlog-"));
await build({
  entryPoints: ["preview/main.jsx"],
  bundle: true, minify: true, format: "iife",
  loader: { ".jsx": "jsx", ".woff2": "dataurl" },
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  outdir: out, entryNames: "app", logLevel: "warning",
});

const css = readFileSync(join(out, "app.css"), "utf8");
const js  = readFileSync(join(out, "app.js"), "utf8");

const html = `<title>LipidLog</title>
<style>
${css}
/* The app owns its design system, reset, type and light/dark themes. This host
   page only gives it a ground to sit on, so the body background mirrors the
   app's own canvas tokens rather than inventing a palette that would fight it. */
:root { --ground: #F4F4F5; color-scheme: light; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --ground: #0C0C0D; color-scheme: dark; }
}
:root[data-theme="dark"]  { --ground: #0C0C0D; color-scheme: dark; }
:root[data-theme="light"] { --ground: #F4F4F5; color-scheme: light; }
html, body { background: var(--ground); }
body { margin: 0; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
#root { min-height: 100vh; }
</style>

<div id="root"></div>

<script>
${js}
</script>
`;
const dest = process.argv[2] ?? "/tmp/lipidlog-preview.html";
writeFileSync(dest, html);
console.log(`${dest} — ${(html.length / 1024).toFixed(0)} KB`);
