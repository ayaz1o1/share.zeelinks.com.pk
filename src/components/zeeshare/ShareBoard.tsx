import { useCallback, useRef, useState } from "react";
import { ArrowDownToLine, FileUp, Loader2, Trash2, UploadCloud, Wifi, WifiOff } from "lucide-react";

import { useZeeShare } from "@/hooks/useZeeShare";
import { formatBytes } from "@/lib/zeeshare/types";
import { cn } from "@/lib/utils";

export function ShareBoard() {
  const { status, devices, files, transfers, addFiles, removeFile, download } = useZeeShare();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const dropped = Array.from(event.dataTransfer.files);
      if (dropped.length) addFiles(dropped);
    },
    [addFiles],
  );

  const activeTransfers = transfers.filter((transfer) => transfer.status !== "done");

  return (
    <section aria-label="File sharing" className="mx-auto w-full max-w-3xl px-4">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "panel relative flex flex-col items-center justify-center gap-4 px-6 py-14 text-center transition-colors",
          dragging && "border-primary bg-surface-strong",
        )}
      >
        <div
          className={cn(
            "flex size-16 items-center justify-center rounded-full bg-brand-gradient text-primary-foreground transition-transform",
            dragging && "scale-110",
          )}
          aria-hidden
        >
          <UploadCloud className="size-8" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Drop files here</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Any file, any size. Files stay on your network.
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="focus-visible:focus-ring inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <FileUp className="size-4" aria-hidden />
          Select files
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Select files to share"
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            if (picked.length) addFiles(picked);
            event.target.value = "";
          }}
        />

        <p
          className="flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {status === "ready" ? (
            <>
              <Wifi className="size-3.5 text-success" aria-hidden />
              {devices > 1
                ? `${devices} devices on this network`
                : "Ready — open this page on another device to share"}
            </>
          ) : status === "starting" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Connecting to your network
            </>
          ) : (
            <>
              <WifiOff className="size-3.5 text-destructive" aria-hidden />
              Network unavailable
            </>
          )}

        </p>
      </div>

      {activeTransfers.length > 0 && (
        <ul className="mt-4 space-y-2">
          {activeTransfers.map((transfer) => {
            const percent = transfer.size
              ? Math.min(100, Math.round((transfer.transferred / transfer.size) * 100))
              : 0;
            return (
              <li key={transfer.id} className="panel px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{transfer.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {transfer.status === "failed" ? (transfer.error ?? "Failed") : `${percent}%`}
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${transfer.name} progress`}
                >
                  <div className="h-full bg-brand-gradient" style={{ width: `${percent}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Available files
        </h3>
        {files.length === 0 ? (
          <p className="panel mt-3 px-4 py-8 text-center text-sm text-muted-foreground">
            No files yet. Files shared from any device on this network appear here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {files.map((file) => (
              <li key={file.id} className="panel flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                    {file.mine ? " · shared by you" : ""}
                  </p>
                </div>
                {file.mine ? (
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    aria-label={`Stop sharing ${file.name}`}
                    className="focus-visible:focus-ring rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => download(file.id)}
                    className="focus-visible:focus-ring inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-surface-strong"
                  >
                    <ArrowDownToLine className="size-4" aria-hidden />
                    Download
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
