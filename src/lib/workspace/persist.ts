import { DEFAULT_SETTINGS, type PersistedWorkspace } from "./types";
import type { TreeState } from "./types";

const DB_NAME = "quarry";
const DB_VERSION = 1;
const STORE_NAME = "workspace";
const KEY = "current";
const FALLBACK_KEY = "quarry.workspace.v1";

let memoryFallback: PersistedWorkspace | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
    request.onblocked = () => reject(new Error("Local storage is blocked by another tab."));
  });
}

function readFallback(): PersistedWorkspace | null {
  if (memoryFallback) return memoryFallback;
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedWorkspace;
  } catch {
    return null;
  }
}

function writeFallback(value: PersistedWorkspace): boolean {
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(value));
    return true;
  } catch {
    memoryFallback = value;
    return false;
  }
}

export function validatePersisted(value: unknown): value is PersistedWorkspace {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedWorkspace>;
  if (candidate.version !== 1) return false;
  if (typeof candidate.tree !== "object" || candidate.tree === null) return false;
  if (typeof candidate.contents !== "object" || candidate.contents === null) return false;
  if (typeof candidate.savedContents !== "object" || candidate.savedContents === null) return false;
  if (!Array.isArray(candidate.openFiles)) return false;
  const tree = candidate.tree as TreeState;
  if (!tree.rootId || !tree.nodes || !tree.nodes[tree.rootId]) return false;
  return true;
}

export async function loadPersisted(): Promise<PersistedWorkspace | null> {
  let raw: unknown = null;
  try {
    const db = await openDatabase();
    raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error("Read failed."));
    });
    db.close();
  } catch {
    raw = readFallback();
  }
  if (!raw) raw = readFallback();
  return validatePersisted(raw) ? raw : null;
}

export async function savePersisted(value: PersistedWorkspace): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Write failed."));
      tx.onabort = () => reject(tx.error ?? new Error("Write aborted."));
    });
    db.close();
    writeFallback(value);
  } catch (error) {
    memoryFallback = value;
    const ok = writeFallback(value);
    if (!ok) {
      throw error instanceof Error ? error : new Error("Could not save the workspace.");
    }
  }
}

export async function clearPersisted(): Promise<void> {
  memoryFallback = null;
  try {
    window.localStorage.removeItem(FALLBACK_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // Nothing else to clear.
  }
}

export const STORAGE_DEFAULTS = DEFAULT_SETTINGS;
