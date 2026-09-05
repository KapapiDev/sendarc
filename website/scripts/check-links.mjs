import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const dist = resolve("dist");
const htmlFiles = [];
const walk = async (dir) => {
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    if ((await stat(path)).isDirectory()) await walk(path);
    else if (name.endsWith(".html")) htmlFiles.push(path);
  }
};
await walk(dist);

const missing = [];
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/\shref=["']([^"']+)["']/g)) {
    const href = match[1];
    if (!href || href.startsWith("#") || /^(?:https?:|mailto:|tel:)/.test(href)) continue;
    const pathname = new URL(href, "https://sendarc.pages.dev/").pathname;
    const target = pathname.endsWith("/") ? join(dist, pathname, "index.html") : join(dist, pathname);
    try { await stat(target); } catch { missing.push(`${file}: ${href}`); }
  }
}
if (missing.length) {
  console.error(`Broken internal links:\n${missing.join("\n")}`);
  process.exit(1);
}
console.log(`Checked ${htmlFiles.length} HTML files: no broken internal links.`);
