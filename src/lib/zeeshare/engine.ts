```typescript
import { createSignaling, type Signaling } from "./signaling";
import type { ConnectionStatus, SharedFile, TransferState } from "./types";
import { vaultList, vaultRemove, vaultSave } from "./vault";

/*
 * Keep the transport conservative.
 *
 * 64 KiB is deliberately used as the application chunk size. This avoids
 * relying on a browser-specific SCTP maximum message size.
 */
const MAX_CHUNK = 64 * 1024;

const BUFFER_HIGH = 4 * 1024 * 1024;
const BUFFER_LOW = 512 * 1024;

const CONNECT_TIMEOUT = 20_000;
const STALL_TIMEOUT = 20_000;

type Signal =
  | {
      kind: "offer";
      sdp: string;
      transferId: string;
      fileId: string;
    }
  | {
      kind: "answer";
      sdp: string;
      transferId: string;
    }
  | {
      kind: "ice";
      candidate: RTCIceCandidateInit;
      transferId: string;
    }
  | {
      kind: "error";
      transferId: string;
      message: string;
    };

type Snapshot = {
  status: ConnectionStatus;
  devices: number;
  files: SharedFile[];
  transfers: TransferState[];
};

type ConnectionContext = {
  connection: RTCPeerConnection;
  timeout: number;
};

export class ShareEngine {
  private signaling: Signaling | null = null;

  private listeners = new Set<() => void>();

  private localFiles = new Map<
    string,
    {
      meta: SharedFile;
      file: File;
    }
  >();

  private remoteFiles = new Map<string, SharedFile>();

  private transfers = new Map<string, TransferState>();

  private connections = new Map<string, ConnectionContext>();

  /*
   * IMPORTANT:
   *
   * ICE can arrive before the corresponding offer/answer.
   * Therefore ICE is queued by transferId even when there is no
   * RTCPeerConnection yet.
   */
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();

  private completedBlobs = new Map<string, Blob>();

  private status: ConnectionStatus = "starting";

  private devices = 1;

  private peerId = "";

  private snapshot: Snapshot = {
    status: "starting",
    devices: 1,
    files: [],
    transfers: [],
  };

  constructor(private readonly room: string) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): Snapshot => {
    return this.snapshot;
  };

  // -------------------------------------------------------------------------
  // START / STOP
  // -------------------------------------------------------------------------

  async start() {
    this.peerId = crypto.randomUUID();

    /*
     * Restore local files before joining the signaling room so that when
     * presence is published, the current device can immediately advertise
     * its existing files.
     */
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
            this.remoteFiles.set(file.id, {
              ...file,
              ownerId: peer.peerId,
              mine: false,
            });
          }
        }

        this.rebuild();
      },

      onSignal: (from, signal) => {
        void this.handleSignal(from, signal as Signal);
      },
    });

    /*
     * Re-publish files restored from IndexedDB under the new session ID.
     */
    if (this.localFiles.size) {
      this.signaling.publishFiles(this.myFileList());
    }

    this.rebuild();
  }

  async stop() {
    for (const [transferId, context] of this.connections) {
      window.clearTimeout(context.timeout);
      context.connection.close();
      this.connections.delete(transferId);
    }

    this.pendingIce.clear();

    await this.signaling?.stop();

    this.signaling = null;
  }

  // -------------------------------------------------------------------------
  // LOCAL VAULT
  // -------------------------------------------------------------------------

  private async restoreVault() {
    const entries = await vaultList();

    for (const entry of entries) {
      const file = new File([entry.blob], entry.name, {
        type: entry.type,
      });

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

  // -------------------------------------------------------------------------
  // DOWNLOAD / RECEIVE
  // -------------------------------------------------------------------------

  async download(fileId: string) {
    const meta = this.remoteFiles.get(fileId);

    if (!meta || !this.signaling) {
      return;
    }

    const transferId = crypto.randomUUID();

    this.setTransfer({
      id: transferId,
      name: meta.name,
      size: meta.size,
      transferred: 0,
      direction: "in",
      status: "connecting",
    });

    const connection = this.createConnection(transferId, meta.ownerId);

    /*
     * The receiver creates the DataChannel.
     * The sender will receive it through ondatachannel.
     */
    const channel = connection.createDataChannel("file", {
      ordered: true,
    });

    channel.binaryType = "arraybuffer";

    this.receiveOn(channel, transferId, meta);

    /*
     * IMPORTANT:
     *
     * ICE gathering begins when the local description is set.
     * We send the offer immediately and separately trickle ICE candidates
     * through Firebase.
     */
    const offer = await connection.createOffer();

    await connection.setLocalDescription(offer);

    this.signaling.sendSignal(
      meta.ownerId,
      {
        kind: "offer",
        sdp: offer.sdp ?? "",
        transferId,
        fileId,
      } satisfies Signal,
    );
  }

  private receiveOn(
    channel: RTCDataChannel,
    transferId: string,
    meta: SharedFile,
  ) {
    const parts: BlobPart[] = [];

    let received = 0;

    let stallTimer: number | undefined;

    const clearStall = () => {
      if (stallTimer !== undefined) {
        window.clearTimeout(stallTimer);
        stallTimer = undefined;
      }
    };

    const armStall = () => {
      clearStall();

      stallTimer = window.setTimeout(() => {
        const transfer = this.transfers.get(transferId);

        if (!transfer) return;

        if (transfer.status === "active") {
          this.failTransfer(
            transferId,
            "Transfer stopped responding. Please try again.",
          );
        }
      }, STALL_TIMEOUT);
    };

    channel.onopen = () => {
      this.patchTransfer(transferId, {
        status: "active",
      });

      armStall();
    };

    channel.onerror = () => {
      this.failTransfer(
        transferId,
        "The file connection was interrupted.",
      );
    };

    channel.onclose = () => {
      clearStall();

      const transfer = this.transfers.get(transferId);

      if (transfer?.status === "active") {
        this.failTransfer(
          transferId,
          "Connection closed before the file finished.",
        );
      }
    };

    channel.onmessage = async (event) => {
      armStall();

      if (typeof event.data === "string") {
        if (event.data === "eof") {
          clearStall();

          if (received !== meta.size) {
            this.failTransfer(
              transferId,
              `Transfer incomplete: received ${received} of ${meta.size} bytes. Please try again.`,
            );

            return;
          }

          const blob = new Blob(parts, {
            type: meta.type || "application/octet-stream",
          });

          if (blob.size !== meta.size) {
            this.failTransfer(
              transferId,
              "The received file is incomplete. Please try again.",
            );

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

          return;
        }

        return;
      }

      const chunk = await toArrayBuffer(event.data);

      parts.push(chunk);

      received += chunk.byteLength;

      this.patchTransfer(transferId, {
        transferred: received,
      });
    };
  }

  saveTransfer(transferId: string) {
    const blob = this.completedBlobs.get(transferId);

    const transfer = this.transfers.get(transferId);

    if (
      !blob ||
      !transfer ||
      transfer.status !== "done"
    ) {
      return false;
    }

    saveBlob(blob, transfer.name);

    return true;
  }

  // -------------------------------------------------------------------------
  // SIGNALING
  // -------------------------------------------------------------------------

  private async handleSignal(from: string, signal: Signal) {
    if (!signal || !signal.kind || !signal.transferId) {
      return;
    }

    /*
     * ---------------------------------------------------------------
     * ERROR
     * ---------------------------------------------------------------
     */

    if (signal.kind === "error") {
      this.failTransfer(
        signal.transferId,
        signal.message,
      );

      return;
    }

    /*
     * ---------------------------------------------------------------
     * ICE
     * ---------------------------------------------------------------
     *
     * IMPORTANT FIX:
     *
     * ICE may arrive BEFORE the offer or answer.
     *
     * The previous implementation discarded ICE when no connection
     * existed yet. That can make an otherwise valid LAN connection
     * fail.
     */

    if (signal.kind === "ice") {
      const connectionContext =
        this.connections.get(signal.transferId);

      if (!connectionContext) {
        const queue =
          this.pendingIce.get(signal.transferId) ?? [];

        queue.push(signal.candidate);

        this.pendingIce.set(
          signal.transferId,
          queue,
        );

        return;
      }

      const connection =
        connectionContext.connection;

      if (connection.remoteDescription) {
        await this.addIceCandidateSafely(
          connection,
          signal.candidate,
        );
      } else {
        const queue =
          this.pendingIce.get(signal.transferId) ?? [];

        queue.push(signal.candidate);

        this.pendingIce.set(
          signal.transferId,
          queue,
        );
      }

      return;
    }

    /*
     * ---------------------------------------------------------------
     * OFFER
     * ---------------------------------------------------------------
     */

    if (signal.kind === "offer") {
      const entry =
        this.localFiles.get(signal.fileId);

      if (!entry) {
        this.signaling?.sendSignal(
          from,
          {
            kind: "error",
            transferId: signal.transferId,
            message:
              "That file is no longer being shared.",
          } satisfies Signal,
        );

        return;
      }

      /*
       * If a duplicate offer somehow arrives for the same transfer,
       * don't create a second peer connection.
       */
      if (this.connections.has(signal.transferId)) {
        return;
      }

      const connection =
        this.createConnection(
          signal.transferId,
          from,
        );

      connection.ondatachannel = (event) => {
        void this.sendFile(
          event.channel,
          signal.transferId,
          entry.file,
          from,
        );
      };

      try {
        await connection.setRemoteDescription({
          type: "offer",
          sdp: signal.sdp,
        });

        /*
         * Now that the remote description exists, all ICE candidates
         * received before the offer can safely be added.
         */
        await this.flushIce(
          signal.transferId,
          connection,
        );

        const answer =
          await connection.createAnswer();

        await connection.setLocalDescription(
          answer,
        );

        this.signaling?.sendSignal(
          from,
          {
            kind: "answer",
            sdp: answer.sdp ?? "",
            transferId: signal.transferId,
          } satisfies Signal,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not create the WebRTC answer.";

        this.failTransfer(
          signal.transferId,
          `WebRTC negotiation failed: ${message}`,
        );

        this.signaling?.sendSignal(
          from,
          {
            kind: "error",
            transferId: signal.transferId,
            message,
          } satisfies Signal,
        );
      }

      return;
    }

    /*
     * ---------------------------------------------------------------
     * ANSWER
     * ---------------------------------------------------------------
     */

    if (signal.kind === "answer") {
      const connectionContext =
        this.connections.get(signal.transferId);

      if (!connectionContext) {
        /*
         * Extremely unusual ordering, but don't silently discard it.
         * Store it as a pending ICE-independent signal isn't useful,
         * so surface the failure instead.
         */
        return;
      }

      const connection =
        connectionContext.connection;

      try {
        await connection.setRemoteDescription({
          type: "answer",
          sdp: signal.sdp,
        });

        /*
         * Any ICE that arrived before the answer is now safe to add.
         */
        await this.flushIce(
          signal.transferId,
          connection,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not apply the WebRTC answer.";

        this.failTransfer(
          signal.transferId,
          `WebRTC negotiation failed: ${message}`,
        );
      }

      return;
    }
  }

  // -------------------------------------------------------------------------
  // CONNECTION CREATION
  // -------------------------------------------------------------------------

  private createConnection(
    transferId: string,
    remotePeerId: string,
  ) {
    /*
     * Deliberately NO STUN/TURN.
     *
     * This preserves ZeeShare's LAN-only architecture.
     */
    const connection =
      new RTCPeerConnection({
        iceServers: [],
      });

    const timeout =
      window.setTimeout(() => {
        const transfer =
          this.transfers.get(transferId);

        if (
          transfer &&
          transfer.status === "connecting"
        ) {
          this.failTransfer(
            transferId,
            "Could not reach that device. Make sure the devices can communicate directly on the local network.",
          );
        }
      }, CONNECT_TIMEOUT);

    this.connections.set(
      transferId,
      {
        connection,
        timeout,
      },
    );

    connection.onicecandidate = (event) => {
      /*
       * Every actual candidate must be delivered to the
       * remote peer through the signaling relay.
       */
      if (!event.candidate) {
        return;
      }

      this.signaling?.sendSignal(
        remotePeerId,
        {
          kind: "ice",
          candidate:
            event.candidate.toJSON(),
          transferId,
        } satisfies Signal,
      );
    };

    connection.onicecandidateerror = (event) => {
      console.warn(
        "[ZeeShare] ICE candidate error",
        {
          transferId,
          url: event.url,
          errorCode: event.errorCode,
          errorText: event.errorText,
        },
      );
    };

    connection.oniceconnectionstatechange =
      () => {
        console.log(
          "[ZeeShare] ICE state",
          transferId,
          connection.iceConnectionState,
        );

        if (
          connection.iceConnectionState ===
          "connected" ||
          connection.iceConnectionState ===
          "completed"
        ) {
          /*
           * ICE has found a usable path.
           *
           * Do not mark the file transfer active yet;
           * the DataChannel must actually open.
           */
          return;
        }

        if (
          connection.iceConnectionState ===
          "failed"
        ) {
          this.failTransfer(
            transferId,
            "A direct LAN connection could not be established. The network may be blocking device-to-device traffic.",
          );
        }
      };

    connection.onconnectionstatechange =
      () => {
        console.log(
          "[ZeeShare] connection state",
          transferId,
          connection.connectionState,
        );

        if (
          connection.connectionState ===
          "connected"
        ) {
          this.clearConnectionTimeout(
            transferId,
          );

          return;
        }

        if (
          connection.connectionState ===
            "failed" ||
          connection.connectionState ===
            "closed"
        ) {
          this.failTransfer(
            transferId,
            "The direct connection to that device failed.",
          );
        }
      };

    connection.onsignalingstatechange =
      () => {
        console.log(
          "[ZeeShare] signaling state",
          transferId,
          connection.signalingState,
        );
      };

    connection.onicegatheringstatechange =
      () => {
        console.log(
          "[ZeeShare] ICE gathering",
          transferId,
          connection.iceGatheringState,
        );
      };

    return connection;
  }

  private clearConnectionTimeout(
    transferId: string,
  ) {
    const context =
      this.connections.get(transferId);

    if (!context) return;

    window.clearTimeout(
      context.timeout,
    );
  }

  // -------------------------------------------------------------------------
  // ICE QUEUE
  // -------------------------------------------------------------------------

  private async flushIce(
    transferId: string,
    connection: RTCPeerConnection,
  ) {
    const queue =
      this.pendingIce.get(transferId);

    if (!queue?.length) {
      this.pendingIce.delete(transferId);
      return;
    }

    this.pendingIce.delete(
      transferId,
    );

    for (const candidate of queue) {
      await this.addIceCandidateSafely(
        connection,
        candidate,
      );
    }
  }

  private async addIceCandidateSafely(
    connection: RTCPeerConnection,
    candidate: RTCIceCandidateInit,
  ) {
    try {
      await connection.addIceCandidate(
        candidate,
      );
    } catch (error) {
      /*
       * A candidate can legitimately become unusable when a
       * connection is closing or an ICE generation changes.
       *
       * Log it rather than silently hiding every ICE error.
       */
      console.warn(
        "[ZeeShare] Failed to add remote ICE candidate",
        error,
        candidate,
      );
    }
  }

  // -------------------------------------------------------------------------
  // SENDING
  // -------------------------------------------------------------------------

  private async sendFile(
    channel: RTCDataChannel,
    transferId: string,
    file: File,
    receiverId: string,
  ) {
    channel.binaryType =
      "arraybuffer";

    channel.bufferedAmountLowThreshold =
      BUFFER_LOW;

    this.setTransfer({
      id: transferId,
      name: file.name,
      size: file.size,
      transferred: 0,
      direction: "out",
      status: "connecting",
    });

    try {
      /*
       * Wait for DataChannel OPEN.
       */
      await waitForDataChannelOpen(
        channel,
        CONNECT_TIMEOUT,
      );

      this.clearConnectionTimeout(
        transferId,
      );

      this.patchTransfer(
        transferId,
        {
          status: "active",
        },
      );

      /*
       * Keep the application chunk size conservative.
       *
       * We don't rely on sctp.maxMessageSize because browser
       * implementations differ and 64 KiB is already safe for
       * this application's transfer protocol.
       */
      const chunkSize =
        MAX_CHUNK;

      let offset = 0;

      while (offset < file.size) {
        if (
          channel.readyState !==
          "open"
        ) {
          throw new Error(
            "The data connection closed.",
          );
        }

        /*
         * Backpressure.
         *
         * Don't allow the browser's SCTP buffer to grow without
         * limit when transferring large files such as an 8 GB ISO.
         */
        if (
          channel.bufferedAmount >
          BUFFER_HIGH
        ) {
          await waitForBufferedAmount(
            channel,
            BUFFER_LOW,
            STALL_TIMEOUT,
          );
        }

        const next =
          Math.min(
            offset + chunkSize,
            file.size,
          );

        const buffer =
          await file
            .slice(
              offset,
              next,
            )
            .arrayBuffer();

        channel.send(buffer);

        offset +=
          buffer.byteLength;

        this.patchTransfer(
          transferId,
          {
            transferred:
              offset,
          },
        );
      }

      /*
       * Make sure every binary chunk has left the local
       * DataChannel buffer before sending EOF.
       */
      await waitForBufferedAmount(
        channel,
        0,
        STALL_TIMEOUT,
      );

      if (
        channel.readyState !==
        "open"
      ) {
        throw new Error(
          "The data connection closed before completion.",
        );
      }

      channel.send("eof");

      this.patchTransfer(
        transferId,
        {
          status: "done",
          transferred: file.size,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Transfer failed.";

      this.patchTransfer(
        transferId,
        {
          status: "failed",
          error: message,
        },
      );

      this.signaling?.sendSignal(
        receiverId,
        {
          kind: "error",
          transferId,
          message,
        } satisfies Signal,
      );

      this.closeConnection(
        transferId,
      );
    }
  }

  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------

  private myFileList(): SharedFile[] {
    return [
      ...this.localFiles.values(),
    ].map((entry) => ({
      ...entry.meta,
      ownerId: this.peerId,
    }));
  }

  private setTransfer(
    transfer: TransferState,
  ) {
    this.transfers.set(
      transfer.id,
      transfer,
    );

    this.rebuild();
  }

  private patchTransfer(
    id: string,
    patch: Partial<TransferState>,
  ) {
    const current =
      this.transfers.get(id);

    if (!current) return;

    this.transfers.set(
      id,
      {
        ...current,
        ...patch,
      },
    );

    this.rebuild();
  }

  private failTransfer(
    id: string,
    message: string,
  ) {
    const current =
      this.transfers.get(id);

    if (
      !current ||
      current.status === "done" ||
      current.status === "failed"
    ) {
      return;
    }

    this.closeConnection(id);

    this.patchTransfer(
      id,
      {
        status: "failed",
        error: message,
      },
    );
  }

  private closeConnection(
    id: string,
  ) {
    const context =
      this.connections.get(id);

    if (context) {
      window.clearTimeout(
        context.timeout,
      );

      context.connection.onicecandidate =
        null;

      context.connection.onicecandidateerror =
        null;

      context.connection.oniceconnectionstatechange =
        null;

      context.connection.onconnectionstatechange =
        null;

      context.connection.onsignalingstatechange =
        null;

      context.connection.onicegatheringstatechange =
        null;

      context.connection.ondatachannel =
        null;

      context.connection.close();

      this.connections.delete(id);
    }

    this.pendingIce.delete(id);
  }

  private rebuild() {
    this.snapshot = {
      status: this.status,
      devices: this.devices,
      files: [
        ...this.myFileList(),
        ...this.remoteFiles.values(),
      ],
      transfers: [
        ...this.transfers.values(),
      ],
    };

    for (const listener of this.listeners) {
      listener();
    }
  }
}

// ---------------------------------------------------------------------------
// DATA CHANNEL HELPERS
// ---------------------------------------------------------------------------

async function waitForDataChannelOpen(
  channel: RTCDataChannel,
  timeoutMs: number,
): Promise<void> {
  if (
    channel.readyState ===
    "open"
  ) {
    return;
  }

  if (
    channel.readyState ===
      "closed" ||
    channel.readyState ===
      "closing"
  ) {
    throw new Error(
      "The data connection closed before opening.",
    );
  }

  await new Promise<void>(
    (resolve, reject) => {
      let timer = 0;

      const cleanup = () => {
        window.clearTimeout(
          timer,
        );

        channel.onopen =
          null;

        channel.onerror =
          null;

        channel.onclose =
          null;
      };

      timer = window.setTimeout(
        () => {
          cleanup();

          reject(
            new Error(
              "The file data connection did not open in time.",
            ),
          );
        },
        timeoutMs,
      );

      channel.onopen = () => {
        cleanup();
        resolve();
      };

      channel.onerror = () => {
        cleanup();

        reject(
          new Error(
            "The file data connection failed to open.",
          ),
        );
      };

      channel.onclose = () => {
        cleanup();

        reject(
          new Error(
            "The file data connection closed before opening.",
          ),
        );
      };
    },
  );
}

async function waitForBufferedAmount(
  channel: RTCDataChannel,
  threshold: number,
  timeoutMs: number,
): Promise<void> {
  if (
    channel.readyState !==
    "open"
  ) {
    throw new Error(
      "The data connection is not open.",
    );
  }

  if (
    channel.bufferedAmount <=
    threshold
  ) {
    return;
  }

  await new Promise<void>(
    (resolve, reject) => {
      let timer = 0;

      const previous =
        channel.onbufferedamountlow;

      const cleanup = () => {
        window.clearTimeout(
          timer,
        );

        channel.onbufferedamountlow =
          previous;
      };

      timer = window.setTimeout(
        () => {
          cleanup();

          reject(
            new Error(
              "The file transfer buffer did not drain in time.",
            ),
          );
        },
        timeoutMs,
      );

      channel.onbufferedamountlow =
        () => {
          cleanup();
          resolve();
        };
    },
  );
}

async function toArrayBuffer(
  data:
    | ArrayBuffer
    | Uint8Array
    | Blob,
): Promise<ArrayBuffer> {
  if (
    data instanceof ArrayBuffer
  ) {
    return data;
  }

  if (
    data instanceof Blob
  ) {
    return data.arrayBuffer();
  }

  const copy =
    new Uint8Array(
      data.byteLength,
    );

  copy.set(data);

  return copy.buffer;
}

function saveBlob(
  blob: Blob,
  name: string,
) {
  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      "a",
    );

  anchor.href = url;

  anchor.download = name;

  document.body.appendChild(
    anchor,
  );

  anchor.click();

  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url,
      );
    },
    60_000,
  );
}
```
