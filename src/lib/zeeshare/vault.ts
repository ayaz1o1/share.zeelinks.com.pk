/**
 * Local file vault.
 *
 * Files a device offers are kept in the browser's own IndexedDB storage on that
 * device, so a page refresh (or an accidental tab reload) does not drop the
 * files it was sharing. Nothing is uploaded anywhere — this is the same device's
 * disk, and entries are removed when the user stops sharing a file.
 */

const DB_NAME = "zeeshare";
const STORE = "shared-files";
const DB_VERSION = 1;

export type VaultEntry = {
  id: string;
  name: string;
  size: number;
  type: string;
  blob: Blob;
  addedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function vaultSave(entry: VaultEntry): Promise<void> {
  await withStore("readwrite", (store) => store.put(entry) as IDBRequest<IDBValidKey>);
}

export async function vaultRemove(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
}

export async function vaultList(): Promise<VaultEntry[]> {
  const all = await withStore<VaultEntry[]>(
    "readonly",
    (store) => store.getAll() as IDBRequest<VaultEntry[]>,
  );
  return (all ?? []).sort((a, b) => a.addedAt - b.addedAt);
}

export async function vaultClear(): Promise<void> {
  await withStore("readwrite", (store) => store.clear() as IDBRequest<undefined>);
}
