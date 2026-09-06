/* Builds the ported Next.js app as one self-contained HTML page.
 *
 * Same components, same store, same compiled stylesheet as `npm run dev` — the
 * only substitution is next/navigation, aliased to a hash router, because a
 * single file has no server to route with. Everything else is the real app.
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { getThemeScript } from "../lib/theme-script.js";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "lipidlog-app-"));
const cssPath = join(out, "app.css");

// 1. Compile Tailwind against the real components, so the utilities in the
//    output are exactly the ones the app uses.
execFileSync("npx", ["@tailwindcss/cli", "-i", "app/globals.css", "-o", cssPath, "--minify"],
  { stdio: "pipe" });

// 2. Tailwind emits the font subsets as relative URLs, which cannot resolve in
//    a single file. Drop them all and inline only latin — 48KB, one weight axis,
//    every weight the app uses.
let css = readFileSync(cssPath, "utf8").replace(/@font-face\s*\{[^}]*\}/g, "");
const woff2 = readFileSync(
  "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
).toString("base64");
css =
  `@font-face{font-family:'Inter Variable';font-style:normal;font-display:swap;` +
  `font-weight:100 900;src:url(data:font/woff2;base64,${woff2}) format('woff2-variations');}` +
  css;

// 3. Bundle the app itself.
await build({
  entryPoints: ["preview/app-preview.tsx"],
  bundle: true, minify: true, format: "iife",
  jsx: "automatic",
  tsconfig: "tsconfig.json",          // resolves the @/* import alias
  alias: { "next/navigation": "./preview/next-nav-shim.js",
           "next/link": "./preview/next-link-shim.jsx" },
  define: { "process.env.NODE_ENV": '"production"',
            "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
            "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""' },
  outfile: join(out, "app.js"), logLevel: "warning",
});

const js = readFileSync(join(out, "app.js"), "utf8");
const html = `<title>LipidLog Web</title>
<script>${getThemeScript()}</script>
<style>
${css}
html,body{background:var(--color-canvas);}
body{margin:0;overscroll-behavior:none;-webkit-tap-highlight-color:transparent;}
#root{min-height:100vh;}
</style>

<div id="root"></div>

<script>
${js}
</script>
`;
const dest = process.argv[2] ?? "/tmp/lipidlog-app.html";
writeFileSync(dest, html);
console.log(`${dest} — ${(html.length / 1024).toFixed(0)} KB`);
