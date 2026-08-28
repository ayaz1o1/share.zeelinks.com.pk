/**
 * Devices behind the same router share one public address, so hashing it gives
 * a stable, private key for "this network". The raw address is never stored or
 * shown — only the hash is used, and it never leaves the handshake relay.
 *
 * The hash is cached in this browser for a few minutes so a refresh reconnects
 * instantly instead of waiting on a network lookup again.
 */

const CACHE_KEY = "zeeshare.room.v1";
const CACHE_TTL = 60 * 60 * 1000;
const LOOKUP_TIMEOUT = 2500;

export async function resolveRoom(): Promise<string> {
  const cached = readCache();
  if (cached) return cached;
  const address = await publicAddress();
  const room = await hash(`zeeshare-lan-v1:${address}`);
  writeCache(room);
  return room;
}

function readCache(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { room?: string; at?: number };
    if (!parsed.room || !parsed.at) return null;
    if (Date.now() - parsed.at > CACHE_TTL) return null;
    return parsed.room;
  } catch {
    return null;
  }
}

function writeCache(room: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ room, at: Date.now() }));
  } catch {
    // storage unavailable (private mode) — not fatal
  }
}

async function publicAddress(): Promise<string> {
  const endpoints = [
    "https://api.ipify.org?format=json",
    "https://api64.ipify.org?format=json",
    "https://ipapi.co/json/",
  ];
  // Resolve on the first successful lookup instead of waiting for every
  // endpoint. The old Promise.allSettled path waited for the slowest 2.5s
  // timeout, which made a normal refresh feel unnecessarily slow.
  try {
    return await Promise.any(endpoints.map((endpoint) => lookup(endpoint).then((value) => {
      if (!value) throw new Error("No address");
      return value;
    })));
  } catch {
    return "unknown-network";
  }
}

async function lookup(endpoint: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT);
  try {
    const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { ip?: string };
    return data.ip ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function hash(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
