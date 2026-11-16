"use client";

import { Icon } from "@/components/ui/Icon";
import { DropdownMenu, type MenuEntry } from "@/components/ui/DropdownMenu";
import { useStore, useStoreApi } from "@/lib/workspace/store";
import type { NodeKind } from "@/lib/workspace/types";

interface TopBarProps {
  onOpenExplorer: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onToggleTerminal: () => void;
  terminalOpen: boolean;
  onCreateRequest: (parentId: string, kind: NodeKind) => void;
  onRenameRequest: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}

export function TopBar({
  onOpenExplorer,
  onOpenSearch,
  onOpenSettings,
  onToggleTerminal,
  terminalOpen,
  onCreateRequest,
  onRenameRequest,
  onDeleteRequest,
}: TopBarProps) {
  const store = useStoreApi();
  const projectName = useStore((state) => state.tree.name);
  const activeFileId = useStore((state) => state.activeFileId);
  const activeNode = useStore((state) =>
    state.activeFileId ? state.tree.nodes[state.activeFileId] ?? null : null,
  );
  const parent = useStore((state) => {
    if (!state.activeFileId) return null;
    const node = state.tree.nodes[state.activeFileId];
    if (!node?.parentId) return null;
    const parentNode = state.tree.nodes[node.parentId];
    if (!parentNode || parentNode.id === state.tree.rootId) return null;
    return parentNode.name;
  });
  const dirty = useStore((state) =>
    state.activeFileId ? Boolean(state.dirty[state.activeFileId]) : false,
  );
  const rootId = useStore((state) => state.tree.rootId);

  const menuItems: MenuEntry[] = [
    {
      id: "new-file",
      label: "New file",
      icon: "file-plus",
      onSelect: () => onCreateRequest(rootId, "file"),
    },
    {
      id: "new-folder",
      label: "New folder",
      icon: "folder-plus",
      onSelect: () => onCreateRequest(rootId, "folder"),
    },
    { id: "sep-1", separator: true },
    {
      id: "save",
      label: "Save",
      icon: "save",
      shortcut: "Ctrl S",
      disabled: !activeFileId,
      onSelect: () => store.saveActive(),
    },
    {
      id: "rename",
      label: "Rename",
      icon: "pencil",
      disabled: !activeNode,
      onSelect: () => activeNode && onRenameRequest(activeNode.id),
    },
    {
      id: "delete",
      label: "Delete",
      icon: "trash",
      danger: true,
      disabled: !activeNode,
      onSelect: () => activeNode && onDeleteRequest(activeNode.id),
    },
    { id: "sep-2", separator: true },
    {
      id: "search",
      label: "Search workspace",
      icon: "search",
      shortcut: "Ctrl ⇧ F",
      onSelect: onOpenSearch,
    },
    {
      id: "terminal",
      label: terminalOpen ? "Hide terminal" : "Show terminal",
      icon: "terminal",
      onSelect: onToggleTerminal,
    },
    {
      id: "settings",
      label: "Settings",
      icon: "settings",
      onSelect: onOpenSettings,
    },
    { id: "sep-3", separator: true },
    {
      id: "push",
      label: "Push to server",
      icon: "arrow-up",
      onSelect: () => void store.pushToServer(),
    },
  ];

  return (
    <header className="topbar">
      <button
        type="button"
        className="btn-icon btn-ghost topbar-menu"
        aria-label="Open file explorer"
        onClick={onOpenExplorer}
      >
        <Icon name="panel-left" size={19} />
      </button>

      <button
        type="button"
        className="topbar-crumbs"
        onClick={onOpenExplorer}
        aria-label={`Open file explorer. Current file: ${activeNode?.name ?? "none"}`}
      >
        <span className="crumbs-project">{projectName}</span>
        {parent ? <span className="crumbs-sep">/</span> : null}
        {parent ? <span className="crumbs-dir">{parent}</span> : null}
        <span className="crumbs-file">
          {activeNode?.name ?? "No file open"}
          {dirty ? <span className="crumbs-dirty" aria-label="Unsaved changes" /> : null}
        </span>
      </button>

      <div className="topbar-actions">
        <button
          type="button"
          className="btn-icon btn-ghost"
          aria-label="Save active file"
          onClick={() => store.saveActive()}
          disabled={!activeFileId}
        >
          <Icon name="save" size={18} />
        </button>
        <DropdownMenu
          trigger={<Icon name="more-horizontal" size={19} />}
          ariaLabel="Workspace menu"
          items={menuItems}
        />
      </div>
    </header>
  );
}
