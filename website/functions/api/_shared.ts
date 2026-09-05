import type { D1Database } from "@cloudflare/workers-types";

export type Env = Partial<Cloudflare.Env> & { ABUSE_HASH_SALT?: string };
export type PagesFunction<E> = (context: { request: Request; env: E }) => Response | Promise<Response>;

export const json = (data: unknown, status = 200): Response => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

export const text = (value: unknown, max: number): string => String(value ?? "").trim().slice(0, max);

export const abuseHash = async (request: Request, secret: string, endpoint: string, windowStart: number): Promise<string> => {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${endpoint}:${windowStart}:${ip}`));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const rateLimited = async (db: D1Database, request: Request, secret: string, endpoint: string, limit: number): Promise<boolean> => {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % 3600);
  const hash = await abuseHash(request, secret, endpoint, windowStart);
  await db.prepare("DELETE FROM abuse_windows WHERE window_start < ?").bind(now - 86400).run();
  const row = await db.prepare("INSERT INTO abuse_windows(visitor_hash,endpoint,window_start,attempts) VALUES(?,?,?,1) ON CONFLICT(visitor_hash,endpoint,window_start) DO UPDATE SET attempts=attempts+1 RETURNING attempts").bind(hash, endpoint, windowStart).first<{ attempts: number }>();
  return (row?.attempts ?? 1) > limit;
};

// Enforce a byte limit even with missing/forged Content-Length or chunked bodies.
export const readObject = async (request: Request, limit: number): Promise<Record<string, unknown> | null> => {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return body !== null && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch { return null; } finally { reader.releaseLock(); }
};
