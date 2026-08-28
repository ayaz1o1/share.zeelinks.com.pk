import { createSignaling, type Signaling } from "./signaling";
import type { ConnectionStatus, SharedFile, TransferState } from "./types";
import { vaultList, vaultRemove, vaultSave } from "./vault";

/**
 * 64 KB is the largest data-channel message every current browser accepts
 * reliably. Bigger messages (e.g. 256 KB) are silently dropped or close the
 * channel on some builds, which is why larger files used to stall at 0%.
 * The real cap is read from the connection at send time and clamped to this.
 */
const MAX_CHUNK = 64 * 1024;
const BUFFER_HIGH = 4 * 1024 * 1024;
const BUFFER_LOW = 512 * 1024;
const CONNECT_TIMEOUT = 15_000;
const STALL_TIMEOUT = 20_000;

type Signal =
  | { kind: "offer"; sdp: string; transferId: string; fileId: string }
  | { kind: "answer"; sdp: string; transferId: string }
  | { kind: "ice"; candidate: RTCIceCandidateInit; transferId: string }
  | { kind: "error"; transferId: string; message: string };

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
  private completedBlobs = new Map<string, Blob>();
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

    // Bring back anything this device was already sharing before a refresh.
    await this.restoreVault();

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

    // Re-announce restored files under this session's peer id.
    if (this.localFiles.size) this.signaling.publishFiles(this.myFileList());
    this.rebuild();
  }

  async stop() {
    for (const connection of this.connections.values()) connection.close();
    this.connections.clear();
    await this.signaling?.stop();
    this.signaling = null;
  }

  private async restoreVault() {
    const entries = await vaultList();
    for (const entry of entries) {
      const file = new File([entry.blob], entry.name, { type: entry.type });
      this.localFiles.set(entry.id, {
        file,
        meta: {
          id: entry.id,
          name: entry.name,
          size: entry.size,
          type: entry.type,
          ownerId: this.peerId,
          mine: true,
        },
      });
    }
    this.rebuild();
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
      void vaultSave({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        blob: file,
        addedAt: Date.now(),
      });
    }
    this.rebuild();
    this.signaling?.publishFiles(this.myFileList());
  }

  removeFile(id: string) {
    if (!this.localFiles.delete(id)) return;
    void vaultRemove(id);
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
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") {
        this.failTransfer(
          transferId,
          "Could not reach that device. Make sure both devices are on the same Wi-Fi network (and that the network does not block device-to-device traffic).",
        );
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
      if (this.transfers.get(transferId)?.status !== "connecting") return;
      this.failTransfer(
        transferId,
        "Could not reach that device. Make sure both devices are on the same Wi-Fi network.",
      );
    }, CONNECT_TIMEOUT);
  }

  private receiveOn(channel: RTCDataChannel, transferId: string, meta: SharedFile) {
    const parts: BlobPart[] = [];
    let received = 0;
    let stallTimer = 0;

    const armStall = () => {
      window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(() => {
        if (this.transfers.get(transferId)?.status !== "active") return;
        this.failTransfer(transferId, "Transfer stopped responding. Please try again.");
      }, STALL_TIMEOUT);
    };

    channel.onopen = () => {
      this.patchTransfer(transferId, { status: "active" });
      armStall();
    };
    channel.onerror = () => this.failTransfer(transferId, "Connection interrupted");
    channel.onclose = () => {
      window.clearTimeout(stallTimer);
      if (this.transfers.get(transferId)?.status === "active") {
        this.failTransfer(transferId, "Connection closed before the file finished.");
      }
    };

    channel.onmessage = async (event) => {
      if (typeof event.data === "string") {
        if (event.data === "eof") {
          window.clearTimeout(stallTimer);
          if (received !== meta.size) {
            this.failTransfer(
              transferId,
              `Transfer incomplete: received ${received} of ${meta.size} bytes. Please try again.`,
            );
            return;
          }
          const blob = new Blob(parts, { type: meta.type || "application/octet-stream" });
          if (blob.size !== meta.size) {
            this.failTransfer(transferId, "The received file is incomplete. Please try again.");
            return;
          }
          this.completedBlobs.set(transferId, blob);
          this.patchTransfer(transferId, {
            status: "done",
            transferred: meta.size,
            readyToDownload: true,
          });
          channel.close();
          this.closeConnection(transferId);
        }
        return;
      }
      const chunk = await toArrayBuffer(event.data);
      parts.push(chunk);
      received += chunk.byteLength;
      this.patchTransfer(transferId, { transferred: received });
      armStall();
    };
  }

  // Save only after the transfer is complete. This user-initiated action is
  // more reliable on mobile browsers than trying to trigger a download from
  // an asynchronous WebRTC callback.
  saveTransfer(transferId: string) {
    const blob = this.completedBlobs.get(transferId);
    const transfer = this.transfers.get(transferId);
    if (!blob || !transfer || transfer.status !== "done") return false;
    saveBlob(blob, transfer.name);
    return true;
  }

  // ------------------------------------------------------------------ sending

  private async handleSignal(from: string, signal: Signal) {
    if (signal.kind === "offer") {
      const entry = this.localFiles.get(signal.fileId);
      if (!entry) {
        this.signaling?.sendSignal(from, {
          kind: "error",
          transferId: signal.transferId,
          message: "That file is no longer being shared.",
        } satisfies Signal);
        return;
      }

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
        void this.sendFile(event.channel, signal.transferId, entry.file, from);
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

    if (signal.kind === "error") {
      this.failTransfer(signal.transferId, signal.message);
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

  private async sendFile(
    channel: RTCDataChannel,
    transferId: string,
    file: File,
    receiverId: string,
  ) {
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

    // Never send a message larger than the negotiated SCTP limit — that is what
    // silently killed transfers of anything bigger than one chunk.
    const negotiated = this.connections.get(transferId)?.sctp?.maxMessageSize ?? MAX_CHUNK;
    const chunkSize = Math.max(16 * 1024, Math.min(MAX_CHUNK, negotiated));

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
        while (channel.bufferedAmount > BUFFER_HIGH) await drain();
        const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
        channel.send(buffer);
        offset += buffer.byteLength;
        this.patchTransfer(transferId, { transferred: offset });
      }
      // Wait for the send buffer to empty so "eof" cannot overtake data.
      while (channel.readyState === "open" && channel.bufferedAmount > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      channel.send("eof");
      this.patchTransfer(transferId, { status: "done", transferred: file.size });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transfer failed";
      this.patchTransfer(transferId, { status: "failed", error: message });
      this.signaling?.sendSignal(receiverId, {
        kind: "error",
        transferId,
        message,
      } satisfies Signal);
    }
  }

  // ------------------------------------------------------------------- shared

  private myFileList(): SharedFile[] {
    return [...this.localFiles.values()].map((entry) => ({ ...entry.meta, ownerId: this.peerId }));
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

  private failTransfer(id: string, message: string) {
    const current = this.transfers.get(id);
    if (!current || current.status === "done" || current.status === "failed") return;
    this.closeConnection(id);
    this.patchTransfer(id, { status: "failed", error: message });
  }

  private closeConnection(id: string) {
    this.connections.get(id)?.close();
    this.connections.delete(id);
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

async function toArrayBuffer(data: ArrayBuffer | Uint8Array | Blob): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Blob) return data.arrayBuffer();
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
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
