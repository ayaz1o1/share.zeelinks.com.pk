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
 * hundred bytes of connection info per pairing.
 *
 * Firebase Realtime Database is used when configured (production, on
 * zeelinks.com.pk). Otherwise the built-in Lovable Cloud channel is used so
 * the app works in preview with no setup.
 */
export async function createSignaling(room: string, peerId: string): Promise<Signaling> {
  if (hasFirebaseConfig()) {
    const { FirebaseSignaling } = await import("./signaling-firebase");
    return new FirebaseSignaling(room, peerId);
  }
  const { CloudSignaling } = await import("./signaling-cloud");
  return new CloudSignaling(room, peerId);
}
