import type { D1Database as PlatformDatabase } from "@cloudflare/workers-types";

// Only expose the binding type required by Wrangler's generated Env. Loading
// all Worker globals would collide with Astro's browser DOM Element types.
declare global { type D1Database = PlatformDatabase; }
