"use client";

import { useCallback } from "react";
import { CodeEditor } from "./CodeEditor";
import { EditorTabs } from "./EditorTabs";
import { Icon } from "@/components/ui/Icon";
import { useStore, useStoreApi } from "@/lib/workspace/store";

interface EditorPaneProps {
  onOpenSettings: () => void;
  onOpenExplorer: () => void;
  onNewFile: () => void;
}

export function EditorPane({
  onOpenSettings,
  onOpenExplorer,
  onNewFile,
}: EditorPaneProps) {
  const store = useStoreApi();
  const activeFileId = useStore((state) => state.activeFileId);
  const activeFile = useStore((state) =>
    state.activeFileId ? state.tree.nodes[state.activeFileId] ?? null : null,
  );
  const settings = useStore((state) => state.settings);
  const reveal = useStore((state) => state.reveal);

  const contentFor = useCallback(
    (fileId: string) => store.getState().contents[fileId] ?? "",
    [store],
  );
  const onDocChange = useCallback(
    (fileId: string, content: string) => store.updateContent(fileId, content),
    [store],
  );
  const onSave = useCallback(() => store.saveActive(), [store]);
  const onRevealHandled = useCallback((token: number) => store.clearReveal(token), [store]);

  return (
    <section className="editor-pane" aria-label="Editor">
      <EditorTabs onOpenSettings={onOpenSettings} />
      <div className="editor-frame">
        <CodeEditor
          activeFileId={activeFileId}
          activeFileName={activeFile?.name ?? null}
          settings={settings}
          reveal={reveal}
          contentFor={contentFor}
          onDocChange={onDocChange}
          onSave={onSave}
          onRevealHandled={onRevealHandled}
        />
        {!activeFile ? (
          <div className="editor-empty">
            <div className="editor-empty-mark" aria-hidden="true">
              <Icon name="code" size={22} />
            </div>
            <h2>No file open</h2>
            <p>Choose a file from the explorer, or start a new one.</p>
            <div className="editor-empty-actions">
              <button type="button" className="btn btn-primary" onClick={onNewFile}>
                New file
              </button>
              <button type="button" className="btn btn-quiet" onClick={onOpenExplorer}>
                Browse files
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
