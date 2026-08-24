import type { SharedFile } from "./types";

export type PeerInfo = { peerId: string; files: SharedFile[] };

export type SignalingHandlers = {
  onPeers: (peers: PeerInfo[]) => void;
  onSignal: (from: string, signal: unknown) => void;
  onStatus: (status: "ready" | "offline") => void;
};

export interface Signaling {
  readonly peerId: string;
  start(handlers: SignalingHandlers): Promise<void>;
  publishFiles(files: SharedFile[]): void;
  sendSignal(to: string, signal: unknown): void;
  stop(): Promise<void>;
}

export function hasFirebaseConfig(): boolean {
  return Boolean(
    import.meta.env["VITE_FIREBASE_API_KEY"] && import.meta.env["VITE_FIREBASE_DATABASE_URL"],
  );
}

/**
 * Handshake relay only. Never carries file data — just presence and a few
 * hundred bytes of connection info per pairing. Backed by Firebase Realtime
 * Database; configure the VITE_FIREBASE_* variables (see .env.example).
 */
export async function createSignaling(room: string, peerId: string): Promise<Signaling> {
  if (!hasFirebaseConfig()) {
    throw new Error(
      "Firebase is not configured. Copy .env.example to .env and fill in the VITE_FIREBASE_* values.",
    );
  }
  const { FirebaseSignaling } = await import("./signaling-firebase");
  return new FirebaseSignaling(room, peerId);
}
