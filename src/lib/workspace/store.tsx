"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createEntry,
  deleteEntry,
  expandAncestors,
  renameEntry,
  nodePath,
  WorkspaceError,
} from "./tree";
import { SEED_CONTENTS, SEED_TREE } from "./seed";
import { loadPersisted, savePersisted } from "./persist";
import {
  DEFAULT_SETTINGS,
  type BackendState,
  type NodeKind,
  type PersistedWorkspace,
  type RevealRequest,
  type Settings,
  type Toast,
  type ToastTone,
  type TreeState,
} from "./types";
import { createId } from "./tree";
import {
  describeBackendError,
  fetchHealth,
  pushWorkspace,
  slugifyWorkspace,
} from "@/lib/backend";

let revealToken = 0;

const AUTO_SAVE_INTERVAL_MS = 2000;

export interface AppState {
  hydrated: boolean;
  tree: TreeState;
  contents: Record<string, string>;
  savedContents: Record<string, string>;
  openFiles: string[];
  activeFileId: string | null;
  dirty: Record<string, boolean>;
  settings: Settings;
  toasts: Toast[];
  reveal: RevealRequest | null;
  backend: BackendState;
}

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

function initialState(): AppState {
  return {
    hydrated: false,
    tree: SEED_TREE,
    contents: { ...SEED_CONTENTS },
    savedContents: { ...SEED_CONTENTS },
    openFiles: [],
    activeFileId: null,
    dirty: {},
    settings: DEFAULT_SETTINGS,
    toasts: [],
    reveal: null,
    backend: { status: "unknown", version: null, checkedAt: null },
  };
}

const LEGACY_WORKSPACE_NAME = "quarry-demo";
const DEFAULT_WORKSPACE_NAME = "Untitled";

function renameLegacyWorkspace(tree: TreeState): TreeState {
  if (tree.name !== LEGACY_WORKSPACE_NAME) return tree;
  const root = tree.nodes[tree.rootId];
  if (!root) return { ...tree, name: DEFAULT_WORKSPACE_NAME };
  return {
    ...tree,
    name: DEFAULT_WORKSPACE_NAME,
    nodes: { ...tree.nodes, [tree.rootId]: { ...root, name: DEFAULT_WORKSPACE_NAME } },
  };
}

function sanitizeSettings(raw: Partial<Settings> | undefined): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  return {
    theme: merged.theme === "light" ? "light" : "dark",
    fontSize: Math.min(24, Math.max(11, Number(merged.fontSize) || DEFAULT_SETTINGS.fontSize)),
    tabSize: [2, 4, 8].includes(Number(merged.tabSize)) ? Number(merged.tabSize) : 2,
    wordWrap: Boolean(merged.wordWrap),
    highlightActiveLine: Boolean(merged.highlightActiveLine),
    autoSave: Boolean(merged.autoSave),
  };
}

export class AppStore {
  private state: AppState = initialState();
  private listeners = new Set<() => void>();

  getState = (): AppState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private patchTree(tree: TreeState) {
    this.set({ tree });
  }

  async hydrate(): Promise<void> {
    try {
      const persisted = await loadPersisted();
      if (!persisted) {
        this.set({ hydrated: true });
        return;
      }
      const tree = renameLegacyWorkspace(persisted.tree);
      const fileIds = new Set(
        Object.values(tree.nodes)
          .filter((node) => node.kind === "file")
          .map((node) => node.id),
      );
      const contents: Record<string, string> = {};
      const savedContents: Record<string, string> = {};
      const dirty: Record<string, boolean> = {};
      for (const id of fileIds) {
        const value = persisted.contents[id] ?? "";
        contents[id] = value;
        savedContents[id] = persisted.savedContents[id] ?? "";
        if (contents[id] !== savedContents[id]) dirty[id] = true;
      }
      const openFiles = persisted.openFiles.filter((id) => fileIds.has(id));
      const activeFileId =
        persisted.activeFileId && fileIds.has(persisted.activeFileId)
          ? persisted.activeFileId
          : openFiles[0] ?? null;
      this.set({
        hydrated: true,
        tree,
        contents,
        savedContents,
        openFiles,
        activeFileId,
        dirty,
        settings: sanitizeSettings(persisted.settings),
      });
    } catch (error) {
      this.set({ hydrated: true });
      this.toast(
        error instanceof Error
          ? `Stored workspace could not be read: ${error.message}`
          : "Stored workspace could not be read.",
        "error",
      );
    }
  }

  toPersisted(): PersistedWorkspace {
    const s = this.state;
    return {
      version: 1,
      savedAt: Date.now(),
      tree: s.tree,
      contents: s.contents,
      savedContents: s.savedContents,
      openFiles: s.openFiles,
      activeFileId: s.activeFileId,
      settings: s.settings,
    };
  }

  toast(message: string, tone: ToastTone = "info") {
    const toast: Toast = { id: createId("toast"), message, tone };
    this.set({ toasts: [...this.state.toasts.slice(-2), toast] });
  }

  dismissToast(id: string) {
    this.set({ toasts: this.state.toasts.filter((toast) => toast.id !== id) });
  }

  openFile(fileId: string) {
    const node = this.state.tree.nodes[fileId];
    if (!node || node.kind !== "file") return;
    const openFiles = this.state.openFiles.includes(fileId)
      ? this.state.openFiles
      : [...this.state.openFiles, fileId];
    this.set({
      openFiles,
      activeFileId: fileId,
      tree: { ...this.state.tree, expanded: expandAncestors(this.state.tree, fileId).expanded },
    });
  }

  setActiveFile(fileId: string) {
    if (this.state.activeFileId === fileId) return;
    if (!this.state.openFiles.includes(fileId)) {
      this.openFile(fileId);
      return;
    }
    this.set({ activeFileId: fileId });
  }

  closeFile(fileId: string) {
    const index = this.state.openFiles.indexOf(fileId);
    if (index === -1) return;
    const openFiles = this.state.openFiles.filter((id) => id !== fileId);
    let activeFileId = this.state.activeFileId;
    if (activeFileId === fileId) {
      activeFileId = openFiles[Math.min(index, openFiles.length - 1)] ?? null;
    }
    this.set({ openFiles, activeFileId });
  }

  closeOtherFiles(fileId: string) {
    if (!this.state.tree.nodes[fileId]) return;
    this.set({ openFiles: [fileId], activeFileId: fileId });
  }

  updateContent(fileId: string, content: string) {
    if (this.state.contents[fileId] === content) return;
    const contents = { ...this.state.contents, [fileId]: content };
    const isDirty = content !== (this.state.savedContents[fileId] ?? "");
    const dirty = { ...this.state.dirty };
    if (isDirty) dirty[fileId] = true;
    else delete dirty[fileId];
    this.set({ contents, dirty });
  }

  saveFile(fileId: string) {
    if (!this.state.tree.nodes[fileId]) return;
    const content = this.state.contents[fileId] ?? "";
    const savedContents = { ...this.state.savedContents, [fileId]: content };
    const dirty = { ...this.state.dirty };
    delete dirty[fileId];
    this.set({ savedContents, dirty });
  }

  saveDirtyFiles(): number {
    const dirtyIds = Object.keys(this.state.dirty).filter((id) => this.state.tree.nodes[id]);
    if (dirtyIds.length === 0) return 0;
    const savedContents = { ...this.state.savedContents };
    for (const id of dirtyIds) savedContents[id] = this.state.contents[id] ?? "";
    this.set({ savedContents, dirty: {} });
    return dirtyIds.length;
  }

  saveActive() {
    const id = this.state.activeFileId;
    if (!id) return;
    this.saveFile(id);
    this.toast(`Saved ${this.state.tree.nodes[id]?.name ?? "file"}.`, "success");
  }

  toggleFolder(folderId: string) {
    const node = this.state.tree.nodes[folderId];
    if (!node || node.kind !== "folder") return;
    const expanded = { ...this.state.tree.expanded };
    if (expanded[folderId]) delete expanded[folderId];
    else expanded[folderId] = true;
    this.patchTree({ ...this.state.tree, expanded });
  }

  createNode(parentId: string, kind: NodeKind, rawName: string): Result<string> {
    try {
      const parent = this.state.tree.nodes[parentId];
      if (!parent) return { ok: false, error: "That folder no longer exists." };
      if (kind === "file" && parent.kind !== "folder") {
        return { ok: false, error: "Files need a folder to live in." };
      }
      const { tree, node } = createEntry(this.state.tree, parentId, kind, rawName);
      const contents = { ...this.state.contents };
      const savedContents = { ...this.state.savedContents };
      const openFiles = [...this.state.openFiles];
      let activeFileId = this.state.activeFileId;
      if (kind === "file") {
        contents[node.id] = "";
        savedContents[node.id] = "";
        openFiles.push(node.id);
        activeFileId = node.id;
      }
      this.set({
        tree: { ...tree, expanded: { ...tree.expanded, [parentId]: true } },
        contents,
        savedContents,
        openFiles,
        activeFileId,
      });
      if (kind === "file") {
        this.setReveal({ fileId: node.id, line: 1, column: 0, length: 0 });
      }
      return { ok: true, value: node.id };
    } catch (error) {
      if (error instanceof WorkspaceError) return { ok: false, error: error.message };
      return { ok: false, error: "Could not create that item." };
    }
  }

  renameNode(id: string, rawName: string): Result {
    try {
      const tree = renameEntry(this.state.tree, id, rawName);
      this.patchTree(tree);
      return { ok: true, value: undefined };
    } catch (error) {
      if (error instanceof WorkspaceError) return { ok: false, error: error.message };
      return { ok: false, error: "Could not rename that item." };
    }
  }

  deleteNode(id: string): Result {
    try {
      const result = deleteEntry(this.state.tree, id);
      const removed = new Set(result.removedIds);
      const contents = { ...this.state.contents };
      const savedContents = { ...this.state.savedContents };
      const dirty = { ...this.state.dirty };
      for (const removedId of removed) {
        delete contents[removedId];
        delete savedContents[removedId];
        delete dirty[removedId];
      }
      const openFiles = this.state.openFiles.filter((fileId) => !removed.has(fileId));
      let activeFileId = this.state.activeFileId;
      if (activeFileId && removed.has(activeFileId)) {
        const index = this.state.openFiles.indexOf(activeFileId);
        const remaining = this.state.openFiles.filter((fileId) => !removed.has(fileId));
        activeFileId = remaining[Math.min(Math.max(index - 1, 0), remaining.length - 1)] ?? null;
      }
      this.set({
        tree: result.tree,
        contents,
        savedContents,
        dirty,
        openFiles,
        activeFileId,
        reveal: this.state.reveal && removed.has(this.state.reveal.fileId) ? null : this.state.reveal,
      });
      return { ok: true, value: undefined };
    } catch (error) {
      if (error instanceof WorkspaceError) return { ok: false, error: error.message };
      return { ok: false, error: "Could not delete that item." };
    }
  }

  setReveal(reveal: Omit<RevealRequest, "token">) {
    revealToken += 1;
    this.openFile(reveal.fileId);
    this.set({
      reveal: { ...reveal, token: revealToken },
      tree: { ...this.state.tree, expanded: expandAncestors(this.state.tree, reveal.fileId).expanded },
    });
  }

  clearReveal(token: number) {
    if (this.state.reveal?.token === token) this.set({ reveal: null });
  }

  updateSettings(patch: Partial<Settings>) {
    this.set({ settings: sanitizeSettings({ ...this.state.settings, ...patch }) });
  }

  async checkBackend(): Promise<boolean> {
    this.set({
      backend: { ...this.state.backend, status: "checking" },
    });
    try {
      const health = await fetchHealth();
      this.set({
        backend: { status: "online", version: health.version, checkedAt: Date.now() },
      });
      return true;
    } catch (error) {
      this.set({
        backend: { status: "offline", version: null, checkedAt: Date.now() },
      });
      void error;
      return false;
    }
  }

  async pushToServer(): Promise<boolean> {
    const s = this.state;
    const files = Object.values(s.tree.nodes)
      .filter((node) => node.kind === "file")
      .map((node) => ({
        path: nodePath(s.tree, node.id),
        content: s.contents[node.id] ?? "",
      }))
      .filter((file) => file.path.length > 0);
    try {
      const result = await pushWorkspace(slugifyWorkspace(s.tree.name), files);
      this.set({
        backend: { status: "online", version: this.state.backend.version, checkedAt: Date.now() },
      });
      this.toast(`Pushed ${result.written} files to the Rust server.`, "success");
      return true;
    } catch (error) {
      this.set({
        backend: { status: "offline", version: null, checkedAt: Date.now() },
      });
      this.toast(describeBackendError(error), "error");
      return false;
    }
  }
}

const StoreContext = createContext<AppStore | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new AppStore());

  useEffect(() => {
    let cancelled = false;
    void store.hydrate();
    void store.checkBackend();
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [store]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = store.getState().settings.theme;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    return store.subscribe(() => {
      const next = store.getState().settings.theme;
      if (root.dataset.theme !== next) {
        root.dataset.theme = next;
        root.style.colorScheme = next;
      }
    });
  }, [store]);

  // Auto save checkpoints unsaved buffers every 2 seconds while it is switched on.
  useEffect(() => {
    const interval = setInterval(() => {
      const state = store.getState();
      if (!state.hydrated || !state.settings.autoSave) return;
      store.saveDirtyFiles();
    }, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [store]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = store.getState();
    let lastFailure = 0;

    const write = () => {
      timer = null;
      const state = store.getState();
      if (!state.hydrated) return;
      void savePersisted(store.toPersisted()).catch((error: unknown) => {
        if (Date.now() - lastFailure < 15000) return;
        lastFailure = Date.now();
        store.toast(
          `Changes are not being saved: ${
            error instanceof Error ? error.message : "browser storage failed"
          }`,
          "error",
        );
      });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(write, 250);
    };

    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      if (!state.hydrated) return;
      if (
        state.tree === last.tree &&
        state.contents === last.contents &&
        state.savedContents === last.savedContents &&
        state.openFiles === last.openFiles &&
        state.activeFileId === last.activeFileId &&
        state.settings === last.settings
      ) {
        return;
      }
      last = state;
      schedule();
    });

    const flush = () => {
      if (timer) {
        clearTimeout(timer);
        write();
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);

    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      if (timer) clearTimeout(timer);
    };
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStoreApi(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStoreApi must be used inside WorkspaceProvider");
  return store;
}

export function useStore<T>(
  selector: (state: AppState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const store = useStoreApi();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;
  const cache = useRef<{ state: AppState; value: T } | null>(null);

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    const cached = cache.current;
    if (cached && cached.state === state) return cached.value;
    const next = selectorRef.current(state);
    if (cached && isEqualRef.current(cached.value, next)) {
      cache.current = { state, value: cached.value };
      return cached.value;
    }
    cache.current = { state, value: next };
    return next;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
