/**
 * Devices behind the same router share one public address, so hashing it gives
 * a stable, private key for "this network". The raw address is never stored or
 * shown — only the hash is used, and it never leaves the handshake relay.
 */
export async function resolveRoom(): Promise<string> {
  const address = await publicAddress();
  return hash(`zeeshare-lan-v1:${address}`);
}

async function publicAddress(): Promise<string> {
  const endpoints = ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json"];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) continue;
      const data = (await response.json()) as { ip?: string };
      if (data.ip) return data.ip;
    } catch {
      // try the next endpoint
    }
  }
  return "unknown-network";
}

async function hash(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
