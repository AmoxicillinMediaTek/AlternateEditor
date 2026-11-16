"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { terminalSocketUrl } from "@/lib/backend";
import { runLocalCommand } from "@/lib/terminal/local-shell";
import { useStore, useStoreApi } from "@/lib/workspace/store";
import type { TerminalLine } from "@/lib/workspace/types";

type Mode = "local" | "connecting" | "remote";

interface ServerMessage {
  type?: string;
  data?: string;
}

export function TerminalPanel({ onClose }: { onClose: () => void }) {
  const store = useStoreApi();
  const lines = useStore((state) => state.terminal.lines);
  const history = useStore((state) => state.terminal.history);
  const [mode, setMode] = useState<Mode>("local");
  const [value, setValue] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyIndex = useRef<number | null>(null);
  const closedByUser = useRef(false);

  const addLines = useCallback(
    (entries: Omit<TerminalLine, "id">[]) => {
      store.addTerminalLines(entries);
    },
    [store],
  );

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return;
    setMode("connecting");
    addLines([{ kind: "system", text: "Connecting to the Rust server…" }]);
    let socket: WebSocket;
    try {
      socket = new WebSocket(terminalSocketUrl(store.getState().tree.name));
    } catch {
      setMode("local");
      addLines([{ kind: "error", text: "Could not open a WebSocket. Using the browser shell." }]);
      return;
    }
    socketRef.current = socket;
    socket.onopen = () => {
      setMode("remote");
      addLines([
        {
          kind: "system",
          text: "Connected. Commands run through the Rust sandbox (read-only workspace tools).",
        },
      ]);
    };
    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        addLines([{ kind: "output", text: String(event.data) }]);
        return;
      }
      const text = message.data ?? "";
      if (message.type === "error") addLines([{ kind: "error", text }]);
      else if (message.type === "system") addLines([{ kind: "system", text }]);
      else addLines([{ kind: "output", text }]);
    };
    socket.onerror = () => {
      addLines([{ kind: "error", text: "The server connection failed. Falling back to the browser shell." }]);
      setMode("local");
    };
    socket.onclose = () => {
      socketRef.current = null;
      setMode("local");
      if (!closedByUser.current) {
        addLines([
          {
            kind: "system",
            text: "Server disconnected. Commands now run in the browser shell.",
          },
        ]);
      }
    };
  }, [addLines, store]);

  useEffect(() => {
    if (store.getState().terminal.lines.length === 0) {
      addLines([
        { kind: "system", text: "AlternateEditorDemo terminal · browser shell" },
        { kind: "system", text: "Type help to see what runs here." },
      ]);
    }
    let cancelled = false;
    void store.checkBackend().then((online) => {
      if (!cancelled && online) connect();
    });
    return () => {
      cancelled = true;
      closedByUser.current = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [addLines, connect, store]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const command = value;
    const trimmed = command.trim();
    if (!trimmed) return;
    setValue("");
    historyIndex.current = null;
    store.pushTerminalHistory(trimmed);
    addLines([{ kind: "input", text: `$ ${trimmed}` }]);

    if (trimmed === "clear") {
      store.clearTerminal();
      return;
    }

    const socket = socketRef.current;
    if (mode === "remote" && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "command", command: trimmed }));
      return;
    }

    const result = runLocalCommand(trimmed, store);
    if (result === "clear") {
      store.clearTerminal();
      return;
    }
    if (result.length > 0) addLines(result);
  };

  const shiftHistory = (direction: -1 | 1) => {
    if (history.length === 0) return;
    const current = historyIndex.current;
    let next: number;
    if (current === null) next = direction === -1 ? history.length - 1 : history.length;
    else next = current + direction;
    if (next < 0) next = 0;
    if (next >= history.length) {
      historyIndex.current = null;
      setValue("");
      return;
    }
    historyIndex.current = next;
    setValue(history[next]);
  };

  const modeLabel = mode === "remote" ? "server" : mode === "connecting" ? "connecting" : "browser";

  return (
    <section className="terminal-panel" aria-label="Terminal">
      <header className="terminal-head">
        <div className="terminal-title">
          <Icon name="terminal" size={15} />
          <h2>Terminal</h2>
          <span className={`terminal-mode mode-${mode}`}>
            <span className="status-dot" aria-hidden="true" />
            {modeLabel}
          </span>
        </div>
        <div className="terminal-actions">
          {mode === "local" ? (
            <button type="button" className="btn btn-quiet btn-small" onClick={connect}>
              Connect
            </button>
          ) : null}
          <button
            type="button"
            className="btn-icon btn-ghost btn-small"
            aria-label="Clear terminal"
            title="Clear"
            onClick={() => {
              store.clearTerminal();
              inputRef.current?.focus();
            }}
          >
            <Icon name="trash" size={15} />
          </button>
          <button
            type="button"
            className="btn-icon btn-ghost btn-small"
            aria-label="Close terminal"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>

      <div className="terminal-log" ref={logRef} role="log" aria-live="polite">
        {lines.length === 0 ? <p className="terminal-blank">No output yet.</p> : null}
        {lines.map((line) => (
          <div key={line.id} className={`term-line term-${line.kind}`}>
            {line.text}
          </div>
        ))}
      </div>

      <form className="terminal-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="terminal-input">
          Terminal command
        </label>
        <span className="term-prompt" aria-hidden="true">
          $
        </span>
        <input
          id="terminal-input"
          ref={inputRef}
          className="terminal-input mono"
          value={value}
          placeholder={mode === "remote" ? "server command" : "browser command, try: help"}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              shiftHistory(-1);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              shiftHistory(1);
            }
          }}
        />
      </form>
    </section>
  );
}
