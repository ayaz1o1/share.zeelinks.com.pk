export type SharedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  ownerId: string;
  /** true when this device is the one offering the file */
  mine: boolean;
};

export type TransferState = {
  id: string;
  name: string;
  size: number;
  transferred: number;
  direction: "in" | "out";
  status: "connecting" | "active" | "done" | "failed";
  error?: string;
  /** True when the received bytes are ready for a user-initiated save/download. */
  readyToDownload?: boolean;
};

export type ConnectionStatus = "starting" | "ready" | "offline";

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : value < 10 ? 1 : 0)} ${units[i]}`;
}
