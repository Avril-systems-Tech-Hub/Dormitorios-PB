"use client";

const DB_NAME = "dormitorios-expense-capture";
const DB_VERSION = 1;
const RECEIPTS_STORE = "receipts";
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type StoredReceipt = {
  submissionId: string;
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
  createdAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECEIPTS_STORE)) {
        database.createObjectStore(RECEIPTS_STORE, { keyPath: "submissionId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(RECEIPTS_STORE, mode);
      const request = operation(transaction.objectStore(RECEIPTS_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Falló el acceso al borrador."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Se canceló el borrador."));
    });
  } finally {
    database.close();
  }
}

export async function saveExpenseReceiptDraft(submissionId: string, file: File): Promise<void> {
  if (!submissionId || typeof indexedDB === "undefined") return;
  const stored: StoredReceipt = {
    submissionId,
    blob: file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    createdAt: Date.now(),
  };
  await runTransaction("readwrite", (store) => store.put(stored));
}

export async function loadExpenseReceiptDraft(submissionId: string): Promise<File | null> {
  if (!submissionId || typeof indexedDB === "undefined") return null;
  const stored = await runTransaction<StoredReceipt | undefined>("readonly", (store) =>
    store.get(submissionId),
  );
  if (!stored) return null;
  if (Date.now() - stored.createdAt > MAX_DRAFT_AGE_MS) {
    await deleteExpenseReceiptDraft(submissionId);
    return null;
  }
  return new File([stored.blob], stored.name, {
    type: stored.type,
    lastModified: stored.lastModified,
  });
}

export async function deleteExpenseReceiptDraft(submissionId: string): Promise<void> {
  if (!submissionId || typeof indexedDB === "undefined") return;
  await runTransaction("readwrite", (store) => store.delete(submissionId));
}

export async function pruneExpenseReceiptDrafts(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(RECEIPTS_STORE, "readwrite");
      const store = transaction.objectStore(RECEIPTS_STORE);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value as StoredReceipt;
        if (Date.now() - value.createdAt > MAX_DRAFT_AGE_MS) cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("No se pudieron depurar borradores."));
    });
  } finally {
    database.close();
  }
}
