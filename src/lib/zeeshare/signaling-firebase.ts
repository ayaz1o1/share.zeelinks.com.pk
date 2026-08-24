import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  update,
  remove,
  onValue,
  onChildAdded,
  push,
  onDisconnect,
  serverTimestamp,
  type Database,
  type Unsubscribe,
} from "firebase/database";

import type { PeerInfo, Signaling, SignalingHandlers } from "./signaling";
import type { SharedFile } from "./types";

function firebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp({
    apiKey: import.meta.env["VITE_FIREBASE_API_KEY"],
    authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"],
    databaseURL: import.meta.env["VITE_FIREBASE_DATABASE_URL"],
    projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"],
    appId: import.meta.env["VITE_FIREBASE_APP_ID"],
  });
}

/**
 * Firebase Realtime Database handshake relay.
 *
 * Stores only: which devices are currently on this network, the names/sizes of
 * files they are offering, and short-lived WebRTC connection descriptions.
 * File contents never pass through it, so hosting stays on the free tier.
 */
export class FirebaseSignaling implements Signaling {
  private db: Database;
  private unsubscribes: Unsubscribe[] = [];
  private files: SharedFile[] = [];

  constructor(
    private readonly room: string,
    readonly peerId: string,
  ) {
    this.db = getDatabase(firebaseApp());
  }

  private get peersPath() {
    return `zeeshare/${this.room}/peers`;
  }

  private get inboxPath() {
    return `zeeshare/${this.room}/inbox/${this.peerId}`;
  }

  async start(handlers: SignalingHandlers) {
    const selfRef = ref(this.db, `${this.peersPath}/${this.peerId}`);

    try {
      await set(selfRef, { files: this.files, joinedAt: serverTimestamp() });
      await onDisconnect(selfRef).remove();
      await onDisconnect(ref(this.db, this.inboxPath)).remove();
      handlers.onStatus("ready");
    } catch {
      handlers.onStatus("offline");
      return;
    }

    this.unsubscribes.push(
      onValue(ref(this.db, this.peersPath), (snapshot) => {
        const value = (snapshot.val() ?? {}) as Record<string, { files?: SharedFile[] }>;
        const peers: PeerInfo[] = Object.entries(value).map(([peerId, entry]) => ({
          peerId,
          files: entry?.files ?? [],
        }));
        handlers.onPeers(peers);
      }),
    );

    this.unsubscribes.push(
      onChildAdded(ref(this.db, this.inboxPath), (snapshot) => {
        const value = snapshot.val() as { from?: string; signal?: unknown } | null;
        if (value?.from && value.signal) handlers.onSignal(value.from, value.signal);
        void remove(snapshot.ref);
      }),
    );
  }

  publishFiles(files: SharedFile[]) {
    this.files = files;
    void update(ref(this.db, `${this.peersPath}/${this.peerId}`), { files });
  }

  sendSignal(to: string, signal: unknown) {
    void push(ref(this.db, `zeeshare/${this.room}/inbox/${to}`), {
      from: this.peerId,
      signal,
      at: serverTimestamp(),
    });
  }

  async stop() {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
    await remove(ref(this.db, `${this.peersPath}/${this.peerId}`)).catch(() => {});
    await remove(ref(this.db, this.inboxPath)).catch(() => {});
  }
}
