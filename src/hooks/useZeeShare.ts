import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ShareEngine } from "@/lib/zeeshare/engine";
import { resolveRoom } from "@/lib/zeeshare/room";
import type { ConnectionStatus, SharedFile, TransferState } from "@/lib/zeeshare/types";

const emptySnapshot = {
  status: "starting" as ConnectionStatus,
  devices: 1,
  files: [] as SharedFile[],
  transfers: [] as TransferState[],
};

/** Starts the sharing engine for the current network and exposes its state. */
export function useZeeShare() {
  const [engine, setEngine] = useState<ShareEngine | null>(null);
  const engineRef = useRef<ShareEngine | null>(null);

  useEffect(() => {
    let cancelled = false;
    let active: ShareEngine | null = null;

    void (async () => {
      const room = await resolveRoom();
      if (cancelled) return;
      active = new ShareEngine(room);
      engineRef.current = active;
      setEngine(active);
      await active.start();
    })();

    return () => {
      cancelled = true;
      void active?.stop();
      engineRef.current = null;
    };
  }, []);

  const subscribe = useCallback(
    (listener: () => void) => (engine ? engine.subscribe(listener) : () => {}),
    [engine],
  );
  const getSnapshot = useCallback(
    () => (engine ? engine.getSnapshot() : emptySnapshot),
    [engine],
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => emptySnapshot);

  const addFiles = useCallback((files: File[]) => engineRef.current?.addFiles(files), []);
  const removeFile = useCallback((id: string) => engineRef.current?.removeFile(id), []);
  const download = useCallback((id: string) => void engineRef.current?.download(id), []);
  const saveTransfer = useCallback((id: string) => engineRef.current?.saveTransfer(id) ?? false, []);

  return { ...snapshot, addFiles, removeFile, download, saveTransfer };
}
