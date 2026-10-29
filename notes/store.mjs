import { createRecord, normalizeRecord, recordLimit } from "../app/note-core.mjs";

let databasePromise;

function database() {
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("Browser storage is unavailable. The draft can still be exported.")); return; }
    const request = indexedDB.open("pocketroute-notes-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("records", { keyPath: "id" });
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(new Error("Browser storage could not be opened. Keep or export your draft."));
    request.onblocked = () => reject(new Error("Close other versions of PocketRoute Notes before opening storage."));
  });
  return databasePromise;
}

async function transaction(mode, operation) {
  const connection = await database();
  return new Promise((resolve, reject) => {
    const tx = connection.transaction("records", mode);
    const store = tx.objectStore("records");
    let result;
    let failure;
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(failure || new Error(tx.error?.name === "QuotaExceededError" ? "Storage is full. Export a backup before removing records." : "Storage did not commit. Your draft has not been discarded."));
    operation(store, value => { result = value; }, error => { failure = error; tx.abort(); });
  });
}

export async function listRecords() {
  return transaction("readonly", (store, complete, fail) => {
    const request = store.getAll();
    request.onsuccess = () => {
      try { complete(request.result.map(normalizeRecord).sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))); }
      catch { fail(new Error("Stored data is not a supported record format. No data has been changed.")); }
    };
  });
}

export async function saveRecord(draft, previous = null) {
  const now = new Date().toISOString();
  const record = createRecord(draft, { id: previous?.id || crypto.randomUUID(), createdAt: previous?.createdAt || now, updatedAt: now, version: (previous?.version || 0) + 1 });
  return transaction("readwrite", (store, complete, fail) => {
    const lookup = store.get(record.id);
    lookup.onsuccess = () => {
      const current = lookup.result;
      if ((previous && current?.version !== previous.version) || (!previous && current)) { fail(new Error("This record changed in another tab. Export your draft or reopen the saved record before retrying.")); return; }
      const count = store.count();
      count.onsuccess = () => {
        if (!current && count.result >= recordLimit) { fail(new Error(`The ${recordLimit}-record limit is reached. Export a backup before deleting old records.`)); return; }
        store.put(record);
        complete(record);
      };
    };
  });
}

export async function deleteRecord(id, version) {
  return transaction("readwrite", (store, complete, fail) => {
    const lookup = store.get(id);
    lookup.onsuccess = () => {
      if (lookup.result?.version !== version) { fail(new Error("This record changed in another tab. Reopen it before deleting.")); return; }
      store.delete(id);
      complete(true);
    };
  });
}

export async function importRecords(records) {
  const clean = records.map(normalizeRecord);
  if (clean.length > recordLimit || new Set(clean.map(record => record.id)).size !== clean.length) throw new Error("Invalid backup record count or duplicate IDs.");
  return transaction("readwrite", (store, complete, fail) => {
    const lookup = store.getAllKeys();
    lookup.onsuccess = () => {
      const existing = new Set(lookup.result);
      const additions = clean.filter(record => !existing.has(record.id));
      if (existing.size + additions.length > recordLimit) { fail(new Error(`Import would exceed ${recordLimit} records. Nothing was imported.`)); return; }
      for (const record of additions) store.add(record);
      complete({ imported: additions.length, skipped: clean.length - additions.length });
    };
  });
}

export async function clearRecords() {
  return transaction("readwrite", (store, complete) => { store.clear(); complete(true); });
}