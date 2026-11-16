"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStore, useStoreApi } from "@/lib/workspace/store";

interface EditorTabsProps {
  onOpenSettings: () => void;
}

export function EditorTabs({ onOpenSettings }: EditorTabsProps) {
  const store = useStoreApi();
  const openFiles = useStore((state) => state.openFiles);
  const activeFileId = useStore((state) => state.activeFileId);
  const nodes = useStore((state) => state.tree.nodes);
  const dirty = useStore((state) => state.dirty);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeFileId) return;
    const element = stripRef.current?.querySelector<HTMLElement>(
      `[data-tab-id="${CSS.escape(activeFileId)}"]`,
    );
    element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeFileId, openFiles.length]);

  const activeDirty = activeFileId ? Boolean(dirty[activeFileId]) : false;

  return (
    <div className="tabstrip">
      <div className="tabs" role="tablist" aria-label="Open files" ref={stripRef}>
        {openFiles.length === 0 ? <span className="tabs-empty">No open files</span> : null}
        {openFiles.map((fileId) => {
          const node = nodes[fileId];
          if (!node) return null;
          const active = fileId === activeFileId;
          return (
            <div
              key={fileId}
              className={`tab ${active ? "is-active" : ""}`}
              data-tab-id={fileId}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                className="tab-main"
                title={node.name}
                onClick={() => store.setActiveFile(fileId)}
                onAuxClick={(event) => {
                  if (event.button === 1) store.closeFile(fileId);
                }}
              >
                <span className="tab-name">{node.name}</span>
                {dirty[fileId] ? (
                  <span className="tab-dirty" aria-label="Unsaved changes" />
                ) : null}
              </button>
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${node.name}`}
                onClick={() => store.closeFile(fileId)}
              >
                <Icon name="close" size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="tab-tools">
        <button
          type="button"
          className="btn-icon btn-ghost"
          aria-label="Save active file"
          title="Save (Ctrl+S)"
          onClick={() => store.saveActive()}
          disabled={!activeFileId}
        >
          <span className="save-glyph" data-dirty={activeDirty}>
            <Icon name="save" size={16} />
          </span>
        </button>
        <button
          type="button"
          className="btn-icon btn-ghost"
          aria-label="Open settings"
          title="Settings"
          onClick={onOpenSettings}
        >
          <Icon name="settings" size={17} />
        </button>
      </div>
    </div>
  );
}
