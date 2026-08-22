import { createSignaling, type Signaling } from "./signaling";
import type { ConnectionStatus, SharedFile, TransferState } from "./types";

const CHUNK_SIZE = 256 * 1024;
const BUFFER_HIGH = 8 * 1024 * 1024;
const BUFFER_LOW = 1 * 1024 * 1024;

type Signal =
  | { kind: "offer"; sdp: string; transferId: string; fileId: string }
  | { kind: "answer"; sdp: string; transferId: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit; transferId: string };

type Snapshot = {
  status: ConnectionStatus;
  devices: number;
  files: SharedFile[];
  transfers: TransferState[];
};

/**
 * ZeeShare transfer engine.
 *
 * - Discovery: devices on the same network appear automatically.
 * - Handshake: tiny connection descriptions via the signaling relay.
 * - Transfer: WebRTC data channels with NO STUN/TURN servers, so only local
 *   host candidates exist. Connections therefore form only between devices on
 *   the same network, file bytes never touch a server, nothing is stored, and
 *   there is no size limit.
 */
export class ShareEngine {
  private signaling: Signaling | null = null;
  private listeners = new Set<() => void>();
  private localFiles = new Map<string, { meta: SharedFile; file: File }>();
  private remoteFiles = new Map<string, SharedFile>();
  private transfers = new Map<string, TransferState>();
  private connections = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private status: ConnectionStatus = "starting";
  private devices = 1;
  private peerId = "";
  private snapshot: Snapshot = { status: "starting", devices: 1, files: [], transfers: [] };

  constructor(private readonly room: string) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): Snapshot => this.snapshot;

  async start() {
    this.peerId = crypto.randomUUID();
    this.signaling = await createSignaling(this.room, this.peerId);
    await this.signaling.start({
      onStatus: (status) => {
        this.status = status;
        this.rebuild();
      },
      onPeers: (peers) => {
        this.devices = Math.max(peers.length, 1);
        this.remoteFiles.clear();
        for (const peer of peers) {
          if (peer.peerId === this.peerId) continue;
          for (const file of peer.files ?? []) {
            this.remoteFiles.set(file.id, { ...file, ownerId: peer.peerId, mine: false });
          }
        }
        this.rebuild();
      },
      onSignal: (from, signal) => {
        void this.handleSignal(from, signal as Signal);
      },
    });
    this.rebuild();
  }

  async stop() {
    for (const connection of this.connections.values()) connection.close();
    this.connections.clear();
    await this.signaling?.stop();
    this.signaling = null;
  }

  addFiles(files: File[]) {
    for (const file of files) {
      const id = crypto.randomUUID();
      this.localFiles.set(id, {
        file,
        meta: {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          ownerId: this.peerId,
          mine: true,
        },
      });
    }
    this.rebuild();
    this.signaling?.publishFiles(this.myFileList());
  }

  removeFile(id: string) {
    if (!this.localFiles.delete(id)) return;
    this.rebuild();
    this.signaling?.publishFiles(this.myFileList());
  }

  // ---------------------------------------------------------------- receiving

  async download(fileId: string) {
    const meta = this.remoteFiles.get(fileId);
    if (!meta || !this.signaling) return;

    const transferId = crypto.randomUUID();
    this.setTransfer({
      id: transferId,
      name: meta.name,
      size: meta.size,
      transferred: 0,
      direction: "in",
      status: "connecting",
    });

    const connection = new RTCPeerConnection({ iceServers: [] });
    this.connections.set(transferId, connection);
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling?.sendSignal(meta.ownerId, {
          kind: "ice",
          candidate: event.candidate.toJSON(),
          transferId,
        } satisfies Signal);
      }
    };

    const channel = connection.createDataChannel("file", { ordered: true });
    channel.binaryType = "arraybuffer";
    this.receiveOn(channel, transferId, meta);

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    this.signaling.sendSignal(meta.ownerId, {
      kind: "offer",
      sdp: offer.sdp ?? "",
      transferId,
      fileId,
    } satisfies Signal);

    // If the two devices cannot reach each other directly (different networks,
    // a guest network, or client isolation) nothing will ever open. Surface that
    // instead of leaving the progress bar at 0%.
    window.setTimeout(() => {
      const current = this.transfers.get(transferId);
      if (current?.status !== "connecting") return;
      connection.close();
      this.connections.delete(transferId);
      this.patchTransfer(transferId, {
        status: "failed",
        error: "Could not reach that device. Make sure both devices are on the same Wi-Fi network.",
      });
    }, 25_000);
  }

  private receiveOn(channel: RTCDataChannel, transferId: string, meta: SharedFile) {
    const parts: BlobPart[] = [];
    let received = 0;

    channel.onopen = () => this.patchTransfer(transferId, { status: "active" });
    channel.onerror = () =>
      this.patchTransfer(transferId, { status: "failed", error: "Connection interrupted" });

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        if (event.data === "eof") {
          saveBlob(new Blob(parts, { type: meta.type || "application/octet-stream" }), meta.name);
          this.patchTransfer(transferId, { status: "done", transferred: meta.size });
          channel.close();
          this.connections.get(transferId)?.close();
          this.connections.delete(transferId);
        }
        return;
      }
      const chunk = event.data as ArrayBuffer;
      parts.push(chunk);
      received += chunk.byteLength;
      this.patchTransfer(transferId, { transferred: received });
    };
  }

  // ------------------------------------------------------------------ sending

  private async handleSignal(from: string, signal: Signal) {
    if (signal.kind === "offer") {
      const entry = this.localFiles.get(signal.fileId);
      if (!entry) return;

      const connection = new RTCPeerConnection({ iceServers: [] });
      this.connections.set(signal.transferId, connection);
      connection.onicecandidate = (event) => {
        if (event.candidate) {
          this.signaling?.sendSignal(from, {
            kind: "ice",
            candidate: event.candidate.toJSON(),
            transferId: signal.transferId,
          } satisfies Signal);
        }
      };
      connection.ondatachannel = (event) => {
        void this.sendFile(event.channel, signal.transferId, entry.file);
      };

      await connection.setRemoteDescription({ type: "offer", sdp: signal.sdp });
      await this.flushIce(signal.transferId, connection);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      this.signaling?.sendSignal(from, {
        kind: "answer",
        sdp: answer.sdp ?? "",
        transferId: signal.transferId,
      } satisfies Signal);
      return;
    }

    const connection = this.connections.get(signal.transferId);
    if (!connection) return;

    if (signal.kind === "answer") {
      await connection.setRemoteDescription({ type: "answer", sdp: signal.sdp });
      await this.flushIce(signal.transferId, connection);
      return;
    }

    if (connection.remoteDescription) {
      await connection.addIceCandidate(signal.candidate).catch(() => {});
    } else {
      const queue = this.pendingIce.get(signal.transferId) ?? [];
      queue.push(signal.candidate);
      this.pendingIce.set(signal.transferId, queue);
    }
  }

  private async flushIce(transferId: string, connection: RTCPeerConnection) {
    const queue = this.pendingIce.get(transferId);
    if (!queue) return;
    this.pendingIce.delete(transferId);
    for (const candidate of queue) {
      await connection.addIceCandidate(candidate).catch(() => {});
    }
  }

  private async sendFile(channel: RTCDataChannel, transferId: string, file: File) {
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = BUFFER_LOW;

    this.setTransfer({
      id: transferId,
      name: file.name,
      size: file.size,
      transferred: 0,
      direction: "out",
      status: "connecting",
    });

    await new Promise<void>((resolve) => {
      if (channel.readyState === "open") return resolve();
      channel.onopen = () => resolve();
    });
    this.patchTransfer(transferId, { status: "active" });

    const drain = () =>
      new Promise<void>((resolve) => {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null;
          resolve();
        };
      });

    try {
      let offset = 0;
      // Only one chunk is in memory at a time, so memory stays flat and file
      // size is limited only by the receiving device's own storage.
      while (offset < file.size) {
        if (channel.readyState !== "open") throw new Error("Connection closed");
        if (channel.bufferedAmount > BUFFER_HIGH) await drain();
        const buffer = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
        channel.send(buffer);
        offset += buffer.byteLength;
        this.patchTransfer(transferId, { transferred: offset });
      }
      channel.send("eof");
      this.patchTransfer(transferId, { status: "done", transferred: file.size });
    } catch (error) {
      this.patchTransfer(transferId, {
        status: "failed",
        error: error instanceof Error ? error.message : "Transfer failed",
      });
    }
  }

  // ------------------------------------------------------------------- shared

  private myFileList(): SharedFile[] {
    return [...this.localFiles.values()].map((entry) => entry.meta);
  }

  private setTransfer(transfer: TransferState) {
    this.transfers.set(transfer.id, transfer);
    this.rebuild();
  }

  private patchTransfer(id: string, patch: Partial<TransferState>) {
    const current = this.transfers.get(id);
    if (!current) return;
    this.transfers.set(id, { ...current, ...patch });
    this.rebuild();
  }

  private rebuild() {
    this.snapshot = {
      status: this.status,
      devices: this.devices,
      files: [...this.myFileList(), ...this.remoteFiles.values()],
      transfers: [...this.transfers.values()],
    };
    for (const listener of this.listeners) listener();
  }
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
