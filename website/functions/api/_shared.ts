export interface D1Result<T = unknown> { results?: T[]; success: boolean; meta?: Record<string, unknown> }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = unknown>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface D1Database { prepare(query: string): D1PreparedStatement }
export interface Env { SENDARC_DB?: D1Database; ABUSE_HASH_SALT?: string }
export type PagesFunction<E> = (context: { request: Request; env: E }) => Response | Promise<Response>;

export const json = (data: unknown, status = 200): Response => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

export const text = (value: unknown, max: number): string => String(value ?? "").trim().slice(0, max);

export const visitorHash = async (request: Request, salt = "sendarc-abuse-v1"): Promise<string> => {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const rateLimited = async (db: D1Database, hash: string, endpoint: string, limit: number): Promise<boolean> => {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % 3600);
  await db.prepare("DELETE FROM abuse_windows WHERE window_start < ?").bind(windowStart - 86400).run();
  await db.prepare("INSERT INTO abuse_windows(visitor_hash,endpoint,window_start,attempts) VALUES(?,?,?,1) ON CONFLICT(visitor_hash,endpoint,window_start) DO UPDATE SET attempts=attempts+1").bind(hash, endpoint, windowStart).run();
  const row = await db.prepare("SELECT attempts FROM abuse_windows WHERE visitor_hash=? AND endpoint=? AND window_start=?").bind(hash, endpoint, windowStart).first<{ attempts: number }>();
  return (row?.attempts ?? 1) > limit;
};
