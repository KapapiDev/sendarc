// Shared by the browser and API: never use URLs, addresses or free text as
// campaign labels. Labels identify a campaign, not an individual visitor.
export const campaignLabel = (value: unknown): string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : "";

const PATHS = new Set(["/", "/affixa-alternative/", "/download/", "/docs/", "/privacy/", "/terms/", "/licenses/", "/security/", "/support/"]);
const EVENTS = new Set(["landing_view", "affixa_view", "download_cta", "business_beta_cta", "release_download"]);

export const validEvent = (event: unknown, pathname: unknown): boolean => {
  if (typeof event !== "string" || typeof pathname !== "string" || !EVENTS.has(event) || !PATHS.has(pathname)) return false;
  if (event === "landing_view") return pathname === "/";
  if (event === "affixa_view") return pathname === "/affixa-alternative/";
  if (event === "release_download") return pathname === "/download/";
  return true;
};

export const referrerHost = (value: unknown): string => {
  if (typeof value !== "string" || value.length > 120) return "";
  // Host only; reject full URLs, paths, query strings, credentials and IPs.
  return /^(?=.{1,120}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value) ? value.toLowerCase() : "";
};

export const referrerFromURL = (value: string): string => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? referrerHost(url.hostname) : "";
  } catch { return ""; }
};
