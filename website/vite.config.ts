import { readFileSync } from "node:fs";

// Exercise the actual production security headers in Playwright's static
// preview. Otherwise inline scripts can pass locally while CSP blocks them live.
const globalBlock = readFileSync(new URL("./public/_headers", import.meta.url), "utf8").split(/\r?\n\r?\n/)[0] ?? "";
const headers = Object.fromEntries(globalBlock.split(/\r?\n/).slice(1).map((line) => {
  const colon = line.indexOf(":");
  return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
}));

export default { preview: { headers } };
