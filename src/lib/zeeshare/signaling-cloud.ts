import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

import type { PeerInfo, Signaling, SignalingHandlers } from "./signaling";
import type { SharedFile } from "./types";

/** Fallback handshake relay used when Firebase config is absent (Lovable preview). */
export class CloudSignaling implements Signaling {
  private channel: RealtimeChannel | null = null;
  private files: SharedFile[] = [];

  constructor(
    private readonly room: string,
    readonly peerId: string,
  ) {}

  async start(handlers: SignalingHandlers) {
    const channel = supabase.channel(`zeeshare:${this.room}`, {
      config: { broadcast: { self: false }, presence: { key: this.peerId } },
    });
    this.channel = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ files?: SharedFile[] }>();
      const peers: PeerInfo[] = Object.entries(state).map(([peerId, entries]) => ({
        peerId,
        files: (entries[0]?.files ?? []) as SharedFile[],
      }));
      handlers.onPeers(peers);
    });

    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      const message = payload as { to: string; from: string; signal: unknown };
      if (message.to === this.peerId) handlers.onSignal(message.from, message.signal);
    });

    await new Promise<void>((resolve) => {
      channel.subscribe((state) => {
        if (state === "SUBSCRIBED") {
          handlers.onStatus("ready");
          void channel.track({ files: this.files });
          resolve();
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          handlers.onStatus("offline");
          resolve();
        }
      });
    });
  }

  publishFiles(files: SharedFile[]) {
    this.files = files;
    void this.channel?.track({ files });
  }

  sendSignal(to: string, signal: unknown) {
    void this.channel?.send({
      type: "broadcast",
      event: "signal",
      payload: { to, from: this.peerId, signal },
    });
  }

  async stop() {
    if (!this.channel) return;
    await supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
