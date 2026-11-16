"use client";

import { useMemo, type ReactNode } from "react";
import { FileTypeIcon } from "./FileTypeIcon";
import { DropdownMenu, type MenuEntry } from "@/components/ui/DropdownMenu";
import { Icon } from "@/components/ui/Icon";
import { useStore, useStoreApi } from "@/lib/workspace/store";
import { childrenOf, countTree } from "@/lib/workspace/tree";
import type { NodeKind, TreeNode } from "@/lib/workspace/types";

interface FileExplorerProps {
  onClose?: () => void;
  onCreateRequest: (parentId: string, kind: NodeKind) => void;
  onRenameRequest: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}

function TreeRow({
  node,
  depth,
  activeFileId,
  dirty,
  expanded,
  onCreateRequest,
  onRenameRequest,
  onDeleteRequest,
}: {
  node: TreeNode;
  depth: number;
  activeFileId: string | null;
  dirty: Record<string, boolean>;
  expanded: boolean;
  onCreateRequest: (parentId: string, kind: NodeKind) => void;
  onRenameRequest: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}) {
  const store = useStoreApi();
  const active = node.kind === "file" && node.id === activeFileId;

  const items: MenuEntry[] = [
    ...(node.kind === "folder"
      ? [
          {
            id: "new-file",
            label: "New file",
            icon: "file-plus" as const,
            onSelect: () => onCreateRequest(node.id, "file"),
          },
          {
            id: "new-folder",
            label: "New folder",
            icon: "folder-plus" as const,
            onSelect: () => onCreateRequest(node.id, "folder"),
          },
          { id: "sep-1", separator: true as const },
        ]
      : []),
    {
      id: "rename",
      label: "Rename",
      icon: "pencil",
      onSelect: () => onRenameRequest(node.id),
    },
    {
      id: "delete",
      label: "Delete",
      icon: "trash",
      danger: true,
      onSelect: () => onDeleteRequest(node.id),
    },
  ];

  const rowContent = (
    <>
      <span className="tree-chevron" aria-hidden="true">
        {node.kind === "folder" ? (
          <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} />
        ) : null}
      </span>
      <FileTypeIcon name={node.name} kind={node.kind} expanded={expanded} />
      <span className="tree-label">{node.name}</span>
      {dirty[node.id] ? (
        <span className="tree-dirty" title="Unsaved changes" aria-label="Unsaved changes" />
      ) : null}
    </>
  );

  return (
    <li role="none" className="tree-item">
      <div className={`tree-row-wrap ${active ? "is-active" : ""}`}>
        <button
          type="button"
          role="treeitem"
          aria-selected={node.kind === "file" ? active : undefined}
          aria-expanded={node.kind === "folder" ? expanded : undefined}
          aria-level={depth + 1}
          className="tree-row"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => {
            if (node.kind === "folder") store.toggleFolder(node.id);
            else store.openFile(node.id);
          }}
        >
          {rowContent}
        </button>
        <DropdownMenu
          trigger={<Icon name="more-horizontal" size={16} />}
          ariaLabel={`Actions for ${node.name}`}
          buttonClassName="tree-action btn-icon btn-ghost"
          items={items}
        />
      </div>
      {node.kind === "folder" && expanded ? (
        <TreeChildren
          parentId={node.id}
          depth={depth + 1}
          activeFileId={activeFileId}
          dirty={dirty}
          onCreateRequest={onCreateRequest}
          onRenameRequest={onRenameRequest}
          onDeleteRequest={onDeleteRequest}
        />
      ) : null}
    </li>
  );
}

function TreeChildren({
  parentId,
  depth,
  activeFileId,
  dirty,
  onCreateRequest,
  onRenameRequest,
  onDeleteRequest,
}: {
  parentId: string;
  depth: number;
  activeFileId: string | null;
  dirty: Record<string, boolean>;
  onCreateRequest: (parentId: string, kind: NodeKind) => void;
  onRenameRequest: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}) {
  const tree = useStore((state) => state.tree);
  const children = childrenOf(tree, parentId);

  if (children.length === 0) {
    return (
      <div className="tree-empty" style={{ paddingLeft: `${34 + depth * 14}px` }}>
        <span>Empty</span>
        <button
          type="button"
          className="link-button"
          onClick={() => onCreateRequest(parentId, "file")}
        >
          New file
        </button>
      </div>
    );
  }

  return (
    <ul role="group" className="tree-group">
      {children.map((child) => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth}
          activeFileId={activeFileId}
          dirty={dirty}
          expanded={Boolean(tree.expanded[child.id])}
          onCreateRequest={onCreateRequest}
          onRenameRequest={onRenameRequest}
          onDeleteRequest={onDeleteRequest}
        />
      ))}
    </ul>
  );
}

function ServerRow({ onClose }: { onClose?: () => void }): ReactNode {
  const store = useStoreApi();
  const backend = useStore((state) => state.backend);
  const statusText =
    backend.status === "online"
      ? `Server online${backend.version ? ` · v${backend.version}` : ""}`
      : backend.status === "checking"
        ? "Checking server…"
        : backend.status === "offline"
          ? "Server offline"
          : "Server not checked";

  return (
    <div className="explorer-footer">
      <div className="server-status" data-status={backend.status}>
        <span className="status-dot" aria-hidden="true" />
        <span className="server-label">{statusText}</span>
        <button
          type="button"
          className="btn-icon btn-ghost btn-small"
          aria-label="Check server connection"
          title="Check server"
          onClick={() => void store.checkBackend()}
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>
      <button
        type="button"
        className="btn btn-quiet btn-small server-push"
        onClick={() => void store.pushToServer()}
      >
        <Icon name="arrow-up" size={14} />
        Push workspace
      </button>
      {onClose ? (
        <span className="explorer-mobile-hint">Changes save to this device automatically.</span>
      ) : null}
    </div>
  );
}

export function FileExplorer({
  onClose,
  onCreateRequest,
  onRenameRequest,
  onDeleteRequest,
}: FileExplorerProps) {
  const tree = useStore((state) => state.tree);
  const activeFileId = useStore((state) => state.activeFileId);
  const dirty = useStore((state) => state.dirty);
  const root = tree.nodes[tree.rootId];
  const rootChildren = useMemo(() => childrenOf(tree, tree.rootId), [tree]);
  const counts = useMemo(() => countTree(tree), [tree]);

  const defaultParent = useMemo(() => {
    if (!activeFileId) return tree.rootId;
    const active = tree.nodes[activeFileId];
    return active?.parentId ?? tree.rootId;
  }, [activeFileId, tree]);

  return (
    <div className="explorer">
      <div className="explorer-brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">AlternateEditorDemo</span>
        {onClose ? (
          <button
            type="button"
            className="btn-icon btn-ghost explorer-close"
            onClick={onClose}
            aria-label="Close file explorer"
          >
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>

      <div className="explorer-head">
        <div className="explorer-title">
          <span>{root?.name ?? "workspace"}</span>
          <span className="explorer-count mono">
            {counts.files} {counts.files === 1 ? "file" : "files"}
          </span>
        </div>
        <div className="explorer-actions">
          <DropdownMenu
            trigger={
              <>
                <Icon name="plus" size={15} />
                <span>New</span>
              </>
            }
            ariaLabel="New file or folder"
            buttonClassName="btn btn-quiet btn-small explorer-new"
            items={[
              {
                id: "header-new-file",
                label: "New file",
                icon: "file-plus",
                onSelect: () => onCreateRequest(defaultParent, "file"),
              },
              {
                id: "header-new-folder",
                label: "New folder",
                icon: "folder-plus",
                onSelect: () => onCreateRequest(defaultParent, "folder"),
              },
            ]}
          />
        </div>
      </div>

      <div className="explorer-scroll">
        {rootChildren.length === 0 ? (
          <div className="explorer-empty">
            <Icon name="folder-plus" size={22} />
            <p>This workspace is empty.</p>
            <button
              type="button"
              className="btn btn-quiet btn-small"
              onClick={() => onCreateRequest(tree.rootId, "file")}
            >
              New file
            </button>
          </div>
        ) : (
          <ul role="tree" aria-label="Workspace files" className="tree-root">
            {rootChildren.map((child) => (
              <TreeRow
                key={child.id}
                node={child}
                depth={0}
                activeFileId={activeFileId}
                dirty={dirty}
                expanded={Boolean(tree.expanded[child.id])}
                onCreateRequest={onCreateRequest}
                onRenameRequest={onRenameRequest}
                onDeleteRequest={onDeleteRequest}
              />
            ))}
          </ul>
        )}
      </div>

      <ServerRow onClose={onClose} />
    </div>
  );
}
