"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { EditorState, Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentMore, redo, undo } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import {
  createEditorState,
  languageCompartment,
  settingsCompartment,
  settingsExtensions,
} from "./extensions";
import { labelForFilename, loadLanguage } from "./languages";
import type { RevealRequest, Settings } from "@/lib/workspace/types";

interface CodeEditorProps {
  activeFileId: string | null;
  activeFileName: string | null;
  settings: Settings;
  reveal: RevealRequest | null;
  contentFor: (fileId: string) => string;
  onDocChange: (fileId: string, content: string) => void;
  onSave: () => void;
  onRevealHandled: (token: number) => void;
}

interface CursorInfo {
  line: number;
  column: number;
  selected: number;
}

const ZERO_CURSOR: CursorInfo = { line: 1, column: 1, selected: 0 };

function readCursor(state: EditorState): CursorInfo {
  const main = state.selection.main;
  const line = state.doc.lineAt(main.head);
  const selected = state.selection.ranges.reduce(
    (total, range) => total + (range.to - range.from),
    0,
  );
  return { line: line.number, column: main.head - line.from + 1, selected };
}

function CodeEditorInner({
  activeFileId,
  activeFileName,
  settings,
  reveal,
  contentFor,
  onDocChange,
  onSave,
  onRevealHandled,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const statesRef = useRef(new Map<string, EditorState>());
  const activeRef = useRef<string | null>(null);
  const loadedLanguages = useRef(new Map<string, string>());
  const runtimeExtensionsRef = useRef<Extension[]>([]);
  const propsRef = useRef({
    activeFileId,
    activeFileName,
    settings,
    contentFor,
    onDocChange,
    onSave,
  });
  propsRef.current = {
    activeFileId,
    activeFileName,
    settings,
    contentFor,
    onDocChange,
    onSave,
  };

  const [cursor, setCursor] = useState<CursorInfo>(ZERO_CURSOR);
  const [languageLabel, setLanguageLabel] = useState(() =>
    labelForFilename(activeFileName),
  );
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    const updateCursor = (state: EditorState) => {
      if (disposed) return;
      const next = readCursor(state);
      setCursor((current) =>
        current.line === next.line &&
        current.column === next.column &&
        current.selected === next.selected
          ? current
          : next,
      );
    };

    try {
      const initialId = propsRef.current.activeFileId;
      const initialSettings = propsRef.current.settings;

      const listener = EditorView.updateListener.of((update) => {
        const current = activeRef.current;
        if (current) statesRef.current.set(current, update.state);
        if (update.docChanged && current) {
          propsRef.current.onDocChange(current, update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          updateCursor(update.state);
        }
      });

      const saveKeys = keymap.of([
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            propsRef.current.onSave();
            return true;
          },
        },
      ]);

      const extras: Extension[] = [listener, saveKeys];
      runtimeExtensionsRef.current = extras;

      const initialState = initialId
        ? createEditorState(propsRef.current.contentFor(initialId), initialSettings, extras)
        : createEditorState("", initialSettings, extras);
      if (initialId) statesRef.current.set(initialId, initialState);

      const view = new EditorView({ state: initialState, parent: host });
      viewRef.current = view;
      activeRef.current = initialId;
      updateCursor(initialState);
      setInitError(null);

      return () => {
        disposed = true;
        if (activeRef.current) {
          statesRef.current.set(activeRef.current, view.state);
        }
        viewRef.current = null;
        statesRef.current.clear();
        view.destroy();
      };
    } catch (error) {
      setInitError(
        error instanceof Error ? error.message : "The editor could not start.",
      );
      return;
    }
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (activeFileId === activeRef.current) {
      setLanguageLabel(activeFileId ? labelForFilename(activeFileName) : "Plain text");
      return;
    }
    if (activeRef.current) {
      statesRef.current.set(activeRef.current, view.state);
    }
    activeRef.current = activeFileId;
    const nextState = activeFileId
      ? statesRef.current.get(activeFileId) ??
        createEditorState(
          propsRef.current.contentFor(activeFileId),
          propsRef.current.settings,
          runtimeExtensionsRef.current,
        )
      : createEditorState("", propsRef.current.settings, runtimeExtensionsRef.current);
    if (activeFileId) statesRef.current.set(activeFileId, nextState);
    view.setState(nextState);
    setLanguageLabel(activeFileId ? labelForFilename(activeFileName) : "Plain text");
    setCursor(readCursor(nextState));
  }, [activeFileId, activeFileName]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const effects = settingsCompartment.reconfigure(settingsExtensions(settings));
    for (const [id, state] of statesRef.current) {
      if (id === activeRef.current) continue;
      statesRef.current.set(id, state.update({ effects }).state);
    }
    view.dispatch({ effects });
  }, [settings]);

  useEffect(() => {
    if (!activeFileId) {
      setLanguageLabel("Plain text");
      return;
    }
    let cancelled = false;
    const fileId = activeFileId;
    void loadLanguage(activeFileName).then((language) => {
      if (cancelled) return;
      const view = viewRef.current;
      if (!view) return;
      const cacheKey = `${fileId}:${language.label}`;
      if (activeRef.current === fileId) {
        if (loadedLanguages.current.get(fileId) !== cacheKey) {
          view.dispatch({ effects: languageCompartment.reconfigure(language.extension) });
          loadedLanguages.current.set(fileId, cacheKey);
        }
        setLanguageLabel(language.label);
      } else {
        const state = statesRef.current.get(fileId);
        if (state && loadedLanguages.current.get(fileId) !== cacheKey) {
          statesRef.current.set(
            fileId,
            state.update({ effects: languageCompartment.reconfigure(language.extension) }).state,
          );
          loadedLanguages.current.set(fileId, cacheKey);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeFileId, activeFileName]);

  useEffect(() => {
    if (!reveal) return;
    const view = viewRef.current;
    if (!view || activeRef.current !== reveal.fileId) return;
    const state = view.state;
    const lineNumber = Math.min(Math.max(reveal.line, 1), state.doc.lines);
    const line = state.doc.line(lineNumber);
    const from = Math.min(line.from + Math.max(reveal.column, 0), line.to);
    const to = Math.min(from + Math.max(reveal.length, 0), line.to);
    view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: "center" }),
    });
    if (window.matchMedia("(pointer: fine)").matches) view.focus();
    onRevealHandled(reveal.token);
  }, [reveal, onRevealHandled]);

  const runCommand = (command: (view: EditorView) => boolean) => {
    const view = viewRef.current;
    if (!view) return;
    command(view);
    view.focus();
  };

  return (
    <div className="editor-stack">
      <div className="editor-host" ref={hostRef} inert={!activeFileId ? true : undefined} />
      {initError ? (
        <div className="editor-error" role="alert">
          <p>The editor could not start.</p>
          <p className="editor-error-detail">{initError}</p>
          <button type="button" className="btn btn-quiet" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      ) : null}
      <div className="editor-status">
        <div className="status-group mono">
          <span>Ln {cursor.line}</span>
          <span className="status-sep" aria-hidden="true" />
          <span>Col {cursor.column}</span>
          {cursor.selected > 0 ? (
            <>
              <span className="status-sep" aria-hidden="true" />
              <span>{cursor.selected} sel</span>
            </>
          ) : null}
        </div>
        <div className="status-group status-actions">
          <span className="status-lang">{languageLabel}</span>
          <span className="status-sep" aria-hidden="true" />
          <span className="mono status-spaces">{settings.tabSize} sp</span>
          <div className="quick-keys">
            <button
              type="button"
              className="quick-key"
              aria-label="Indent line"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => runCommand(indentMore)}
            >
              Tab
            </button>
            <button
              type="button"
              className="quick-key icon-only"
              aria-label="Undo"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => runCommand(undo)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16">
                <path d="M7 5 3 9l4 4" />
                <path d="M3 9h8a5 5 0 0 1 0 10h-1" />
              </svg>
            </button>
            <button
              type="button"
              className="quick-key icon-only"
              aria-label="Redo"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => runCommand(redo)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16">
                <path d="m13 5 4 4-4 4" />
                <path d="M17 9H9a5 5 0 0 0 0 10h1" />
              </svg>
            </button>
            <button
              type="button"
              className="quick-key icon-only"
              aria-label="Find in file"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => runCommand(openSearchPanel)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" width="16" height="16">
                <circle cx="9" cy="9" r="5" />
                <path d="m13 13 4 4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const CodeEditor = memo(CodeEditorInner);
