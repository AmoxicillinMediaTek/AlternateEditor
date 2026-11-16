"use client";

import { useCallback, useEffect, useState } from "react";
import { SidebarRail, type SidebarView } from "./SidebarRail";
import { TopBar } from "./TopBar";
import { FileExplorer } from "@/components/explorer/FileExplorer";
import { EditorPane } from "@/components/editor/EditorPane";
import { SearchView } from "@/components/search/SearchView";
import { SettingsView } from "@/components/settings/SettingsView";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { Toasts } from "@/components/ui/Toasts";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useStore, useStoreApi } from "@/lib/workspace/store";
import { nodePath } from "@/lib/workspace/tree";
import type { NodeKind } from "@/lib/workspace/types";

type PromptState =
  | { mode: "create"; kind: NodeKind; parentId: string }
  | { mode: "rename"; id: string }
  | null;

export function AppShell() {
  const store = useStoreApi();
  const hydrated = useStore((state) => state.hydrated);
  const tree = useStore((state) => state.tree);
  const isMobile = useMediaQuery("(max-width: 899px)");

  const [explorerOpen, setExplorerOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>("files");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const promptNode = prompt?.mode === "rename" ? tree.nodes[prompt.id] ?? null : null;
  const promptParent = prompt?.mode === "create" ? tree.nodes[prompt.parentId] ?? null : null;
  const deleteNode = deleteId ? tree.nodes[deleteId] ?? null : null;

  const rootId = tree.rootId;

  const requestCreate = useCallback((parentId: string, kind: NodeKind) => {
    setPrompt({ mode: "create", kind, parentId });
  }, []);

  const requestRename = useCallback((id: string) => {
    setPrompt({ mode: "rename", id });
  }, []);

  const requestDelete = useCallback((id: string) => {
    setDeleteId(id);
  }, []);

  const openSearch = useCallback(() => {
    setSidebarView("search");
    setExplorerOpen(true);
  }, []);

  const openSettings = useCallback(() => {
    setSidebarView("settings");
    setExplorerOpen(true);
  }, []);

  const openFiles = useCallback(() => {
    setSidebarView("files");
    setExplorerOpen(true);
  }, []);

  useEffect(() => {
    if (!isMobile) setExplorerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) {
        if (event.key === "Escape") setExplorerOpen(false);
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        store.saveActive();
      } else if (key === "b") {
        event.preventDefault();
        setExplorerOpen((value) => !value);
      } else if (key === "j" || event.key === "`") {
        event.preventDefault();
        setTerminalMounted(true);
        setTerminalOpen((value) => !value);
      } else if (key === "f" && event.shiftKey) {
        event.preventDefault();
        openSearch();
      } else if (event.key === ",") {
        event.preventDefault();
        openSettings();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store, openSearch, openSettings]);

  const promptTitle =
    prompt?.mode === "rename"
      ? `Rename ${promptNode?.kind === "folder" ? "folder" : "file"}`
      : prompt?.mode === "create"
        ? prompt.kind === "folder"
          ? "New folder"
          : "New file"
        : "New file";

  const promptHint =
    prompt?.mode === "rename"
      ? promptNode
        ? nodePath(tree, promptNode.id)
        : undefined
      : prompt?.mode === "create"
        ? `Inside ${promptParent && promptParent.id !== rootId ? nodePath(tree, promptParent.id) : tree.name}`
        : undefined;

  return (
    <div className="app">
      <a className="skip-link" href="#main-editor">
        Skip to editor
      </a>

      {!hydrated ? (
        <div className="boot-screen">
          <span className="brand-mark boot-mark" aria-hidden="true" />
          <p className="boot-title mono">AlternateEditorDemo</p>
          <p className="boot-note">Loading your workspace…</p>
        </div>
      ) : (
        <div className="app-frame">
          <aside
            id="file-explorer"
            className={`sidebar ${explorerOpen ? "is-open" : ""}`}
            aria-label="Sidebar"
          >
            <SidebarRail
              view={sidebarView}
              onSelect={(view) => {
                setSidebarView(view);
                setExplorerOpen(true);
              }}
            />
            {sidebarView === "search" ? (
              <SearchView onClose={() => setExplorerOpen(false)} />
            ) : sidebarView === "settings" ? (
              <SettingsView onClose={() => setExplorerOpen(false)} />
            ) : (
              <FileExplorer
                onClose={isMobile ? () => setExplorerOpen(false) : undefined}
                onCreateRequest={requestCreate}
                onRenameRequest={requestRename}
                onDeleteRequest={requestDelete}
              />
            )}
          </aside>

          {explorerOpen ? (
            <div
              className="sidebar-scrim"
              role="presentation"
              onClick={() => setExplorerOpen(false)}
            />
          ) : null}

          <main className="workspace">
            <TopBar
              onOpenExplorer={openFiles}
              onOpenSearch={openSearch}
              onOpenSettings={openSettings}
              onToggleTerminal={() => {
                setTerminalMounted(true);
                setTerminalOpen((value) => !value);
              }}
              terminalOpen={terminalOpen}
              onCreateRequest={requestCreate}
              onRenameRequest={requestRename}
              onDeleteRequest={requestDelete}
            />
            <div className="workspace-body">
              <EditorPane
                onOpenSettings={openSettings}
                onOpenExplorer={openFiles}
                onNewFile={() => requestCreate(store.getState().tree.rootId, "file")}
              />
              {terminalMounted ? (
                <TerminalPanel
                  hidden={!terminalOpen}
                  onClose={() => setTerminalOpen(false)}
                />
              ) : null}
            </div>
          </main>
        </div>
      )}

      <PromptDialog
        open={prompt !== null}
        title={promptTitle}
        label="Name"
        initialValue={prompt?.mode === "rename" ? promptNode?.name ?? "" : ""}
        placeholder={prompt?.mode === "create" && prompt.kind === "folder" ? "utils" : "notes.md"}
        hint={promptHint}
        confirmLabel={
          prompt?.mode === "rename"
            ? "Rename"
            : prompt?.mode === "create" && prompt.kind === "folder"
              ? "Create folder"
              : "Create file"
        }
        onClose={() => setPrompt(null)}
        onSubmit={(value) => {
          if (!prompt) return { ok: false, error: "Nothing to create." };
          if (prompt.mode === "rename") {
            const result = store.renameNode(prompt.id, value);
            return result.ok ? { ok: true } : { ok: false, error: result.error };
          }
          const result = store.createNode(prompt.parentId, prompt.kind, value);
          if (result.ok) {
            if (prompt.kind === "file" && isMobile) setExplorerOpen(false);
            return { ok: true };
          }
          return { ok: false, error: result.error };
        }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title={`Delete ${deleteNode?.kind === "folder" ? "folder" : "file"}`}
        message={
          deleteNode
            ? deleteNode.kind === "folder"
              ? `Delete "${deleteNode.name}" and everything inside it? This can't be undone.`
              : `Delete "${deleteNode.name}"? This can't be undone.`
            : "This item no longer exists."
        }
        confirmLabel="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            const result = store.deleteNode(deleteId);
            if (!result.ok) store.toast(result.error, "error");
          }
        }}
      />

      <Toasts />
    </div>
  );
}
