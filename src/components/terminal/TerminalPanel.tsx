"use client";

import "@xterm/xterm/css/xterm.css";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { Icon } from "@/components/ui/Icon";
import { bootContainer, shellCommand, syncWorkspace } from "@/lib/terminal/container";
import { useStore, useStoreApi, type AppStore } from "@/lib/workspace/store";

type Status = "booting" | "ready" | "error";

const DARK = {
  background: "#0e1216",
  foreground: "#e7eaed",
  cursor: "#e0a458",
  selectionBackground: "rgba(224, 164, 88, 0.28)",
  black: "#0e1216",
  red: "#e2725b",
  green: "#7fc8a9",
  yellow: "#d6b25e",
  blue: "#6aa9dd",
  magenta: "#b195c9",
  cyan: "#7ab8ad",
  white: "#e7eaed",
  brightBlack: "#6b7580",
  brightRed: "#ef8f7a",
  brightGreen: "#9fdcbf",
  brightYellow: "#eeb974",
  brightBlue: "#8cc2ec",
  brightMagenta: "#c9b1de",
  brightCyan: "#9ad2c7",
  brightWhite: "#f6f8fa",
};

const LIGHT = {
  background: "#fbfbf9",
  foreground: "#171b1f",
  cursor: "#9a5b1e",
  selectionBackground: "rgba(154, 91, 30, 0.2)",
  black: "#171b1f",
  red: "#b3442e",
  green: "#2f7a5d",
  yellow: "#8a6a1c",
  blue: "#2d6fa3",
  magenta: "#6d4f89",
  cyan: "#2f6f65",
  white: "#3c454e",
  brightBlack: "#7e8892",
  brightRed: "#c95a41",
  brightGreen: "#3f9a76",
  brightYellow: "#a8822a",
  brightBlue: "#3d87c2",
  brightMagenta: "#8666a5",
  brightCyan: "#3d8a7e",
  brightWhite: "#171b1f",
};

const BANNER = [
  "\x1b[38;5;180mAlternateEditorDemo terminal\x1b[0m",
  "\x1b[90mxterm.js on StackBlitz WebContainer · real node, npm, tsc, vite\x1b[0m",
  "\x1b[90mWorkspace files are mirrored before each command. `lua file.lua` runs Lua locally.\x1b[0m",
  "",
].join("\r\n");

const LUA_USAGE = [
  "usage: lua [options] [script.lua [args]]",
  "",
  "  -e <code>    execute a chunk of Lua",
  "  -v           print the Lua version",
  "",
  "Luau files run on the same Lua 5.3 engine.",
].join("\r\n");

function splitArgs(line: string): string[] {
  const args: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null = pattern.exec(line);
  while (match) {
    args.push(match[1] ?? match[2] ?? match[3]);
    match = pattern.exec(line);
  }
  return args;
}

function luaErrorText(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (/ENOENT|no such file/i.test(message)) return "No such file or directory";
    return message;
  }
  return String(error);
}

function bootErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/SharedArrayBuffer|crossOriginIsolated|cross-origin/i.test(message)) {
    return "This page is not cross-origin isolated, so WebContainer cannot start. Serve it with COOP/COEP headers.";
  }
  if (/fetch|network|Failed to load|offline|ERR_/i.test(message)) {
    return "Could not reach the WebContainer service. Check the network connection, then retry.";
  }
  return message;
}

export function TerminalPanel({ hidden, onClose }: { hidden?: boolean; onClose: () => void }) {
  const store = useStoreApi();
  const theme = useStore((state) => state.settings.theme);
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<WebContainer | null>(null);
  const processRef = useRef<WebContainerProcess | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef<string[]>([]);
  const liveRef = useRef(false);
  const shellTokenRef = useRef(0);
  const bannerRef = useRef(false);
  const lineRef = useRef("");
  const luaRunRef = useRef(false);
  const storeRef = useRef<AppStore>(store);
  const [status, setStatus] = useState<Status>("booting");
  const [detail, setDetail] = useState("Booting WebContainer…");

  const write = useCallback((text: string) => {
    termRef.current?.write(text);
  }, []);

  const runLuaCommand = useCallback(
    async (line: string) => {
      const container = containerRef.current;
      const writer = writerRef.current;
      const echo = line.trim().replace(/\s+/g, " ");
      const args = splitArgs(line).slice(1);
      luaRunRef.current = true;
      try {
        if (writer) await writer.write("\x15").catch(() => undefined);
        await new Promise((resolve) => window.setTimeout(resolve, 90));
        write(`${echo}\r\n`);
        if (!container) {
          write("\x1b[31mlua: the container is not ready yet\x1b[0m\r\n");
          return;
        }
        const { runLua, luaVersion } = await import("@/lib/terminal/lua");
        if (!args.length) {
          write(`\x1b[90m${LUA_USAGE}\x1b[0m\r\n`);
          return;
        }
        if (args[0] === "-v" || args[0] === "--version") {
          write(`${await luaVersion()}\r\n`);
          return;
        }
        let source = "";
        let chunkName = "=stdin";
        if (args[0] === "-e" || args[0] === "--execute") {
          source = args.slice(1).join(" ");
          chunkName = "=(command line)";
          if (!source) {
            write("\x1b[31mlua: '-e' needs a chunk of code\x1b[0m\r\n");
            return;
          }
        } else if (args[0].startsWith("-")) {
          write(`\x1b[31mlua: unrecognized option '${args[0]}'\x1b[0m\r\n\x1b[90m${LUA_USAGE}\x1b[0m\r\n`);
          return;
        } else {
          chunkName = `@${args[0]}`;
          try {
            source = await container.fs.readFile(args[0], "utf8");
          } catch (error) {
            write(`\x1b[31mlua: cannot open ${args[0]}: ${luaErrorText(error)}\x1b[0m\r\n`);
            return;
          }
        }
        const result = await runLua(source, chunkName.replace(/^@|^=/, ""));
        for (const row of result.output) write(`${row}\r\n`);
        if (result.error) write(`\x1b[31m${result.error}\x1b[0m\r\n`);
      } catch (error) {
        write(`\x1b[31mlua: ${bootErrorText(error)}\x1b[0m\r\n`);
      } finally {
        luaRunRef.current = false;
        if (writer) await writer.write("\r").catch(() => undefined);
      }
    },
    [write],
  );

  const syncNow = useCallback(
    async (announce: boolean) => {
      const container = containerRef.current;
      if (!container) return;
      const state = storeRef.current.getState();
      try {
        const result = await syncWorkspace(container, state.tree, state.contents);
        if (announce) {
          write(`\r\n\x1b[90m[sync] ${result.written} written · ${result.removed} removed\x1b[0m\r\n`);
        }
      } catch (error) {
        write(`\r\n\x1b[31m[sync] ${bootErrorText(error)}\x1b[0m\r\n`);
      }
    },
    [write],
  );

  const startShell = useCallback(async (container: WebContainer) => {
    const term = termRef.current;
    if (!term) return;
    const token = shellTokenRef.current + 1;
    shellTokenRef.current = token;
    processRef.current?.kill();
    processRef.current = null;
    writerRef.current = null;
    liveRef.current = false;
    const process = await container.spawn(shellCommand(), {
      terminal: { cols: term.cols, rows: term.rows },
      env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
    });
    if (token !== shellTokenRef.current || !termRef.current) {
      process.kill();
      return;
    }
    processRef.current = process;
    writerRef.current = process.input.getWriter();
    liveRef.current = false;
    void process.output.pipeTo(
      new WritableStream<string>({
        write: (chunk) => {
          if (!liveRef.current) {
            liveRef.current = true;
            const buffered = pendingRef.current;
            pendingRef.current = [];
            window.setTimeout(() => {
              for (const item of buffered) void writerRef.current?.write(item).catch(() => undefined);
            }, 180);
          }
          term.write(chunk);
        },
      }),
    );
    void process.exit.then((code) => {
      if (processRef.current !== process) return;
      writerRef.current = null;
      term.write(`\r\n\x1b[90m[shell exited · ${code}]\x1b[0m\r\n`);
    });
  }, []);

  const boot = useCallback(async () => {
    setStatus("booting");
    setDetail("Booting WebContainer…");
    write("\x1b[90mStarting the shell…\x1b[0m\r\n");
    try {
      const container = await bootContainer();
      containerRef.current = container;
      container.on("server-ready", (port, url) => {
        write(`\r\n\x1b[38;5;180m[preview] localhost:${port} → ${url}\x1b[0m\r\n`);
      });
      container.on("error", (event) => {
        write(`\r\n\x1b[31m[container] ${event.message}\x1b[0m\r\n`);
      });
      setDetail("Copying workspace files…");
      await syncNow(true);
      await startShell(container);
      setStatus("ready");
      setDetail("WebContainer online");
      if (!bannerRef.current) {
        bannerRef.current = true;
        write(BANNER);
      }
    } catch (error) {
      setStatus("error");
      setDetail("WebContainer unavailable");
      write(`\x1b[31m${bootErrorText(error)}\x1b[0m\r\n`);
      write("\x1b[90mThe rest of the editor keeps working without it.\x1b[0m\r\n");
    }
  }, [startShell, syncNow, write]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      scrollback: 4000,
      theme: DARK,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;
    try {
      fit.fit();
    } catch {}

    const typing = term.onData((data) => {
      if (data === "\r") {
        const line = lineRef.current;
        lineRef.current = "";
        if (luaRunRef.current) return;
        const isLua = /^\s*(lua|luau)(\s|$)/.test(line);
        queueRef.current = queueRef.current.then(async () => {
          await syncNow(false);
          if (isLua) {
            await runLuaCommand(line);
            return;
          }
          const writer = writerRef.current;
          if (!writer || !liveRef.current) {
            pendingRef.current.push(data);
            return;
          }
          try {
            await writer.write(data);
          } catch {}
        });
        return;
      }
      if (data === "\x7f") lineRef.current = lineRef.current.slice(0, -1);
      else if (data === "\x15" || data === "\x03" || data === "\x0c") lineRef.current = "";
      else if (data.startsWith("\x1b")) lineRef.current = "";
      else if (/^[\x20-\x7e]+$/.test(data)) lineRef.current += data;
      queueRef.current = queueRef.current.then(async () => {
        const writer = writerRef.current;
        if (!writer || !liveRef.current) {
          pendingRef.current.push(data);
          return;
        }
        try {
          await writer.write(data);
        } catch {}
      });
    });

    let touchY = 0;
    let touchRemainder = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
      touchRemainder = 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? 0;
      touchRemainder += touchY - y;
      touchY = y;
      const step = 14;
      const lines = Math.trunc(touchRemainder / step);
      if (lines !== 0) {
        term.scrollLines(lines);
        touchRemainder -= lines * step;
      }
    };
    host.addEventListener("touchstart", onTouchStart, { passive: true });
    host.addEventListener("touchmove", onTouchMove, { passive: true });

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {}
      const process = processRef.current;
      if (process) process.resize({ cols: term.cols, rows: term.rows });
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      host.removeEventListener("touchstart", onTouchStart);
      host.removeEventListener("touchmove", onTouchMove);
      typing.dispose();
      processRef.current?.kill();
      processRef.current = null;
      writerRef.current = null;
      term.dispose();
      termRef.current = null;
    };
  }, [runLuaCommand, syncNow]);

  useEffect(() => {
    storeRef.current = store;
    let timer: number | undefined;
    const unsubscribe = store.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void syncNow(false);
      }, 600);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [store, syncNow]);

  useEffect(() => {
    const term = termRef.current;
    if (term) term.options.theme = theme === "light" ? LIGHT : DARK;
  }, [theme]);

  useEffect(() => {
    if (hidden) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
      } catch {}
      termRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hidden]);

  useEffect(() => {
    void boot();
    void document.fonts?.ready.then(() => {
      try {
        fitRef.current?.fit();
      } catch {}
    });
  }, [boot]);

  const restart = () => {
    const container = containerRef.current;
    if (!container) return;
    write("\r\n\x1b[90mRestarting shell…\x1b[0m\r\n");
    void syncNow(false).then(() => startShell(container));
    termRef.current?.focus();
  };

  return (
    <section
      className={`terminal-panel${hidden ? " is-hidden" : ""}`}
      aria-label="Terminal"
      aria-hidden={hidden || undefined}
    >
      <header className="terminal-head">
        <div className="terminal-title">
          <Icon name="terminal" size={15} />
          <h2>Terminal</h2>
          <span className={`terminal-mode mode-${status}`} title={detail}>
            <span className="status-dot" aria-hidden="true" />
            {status === "ready" ? "webcontainer" : status === "booting" ? "booting" : "offline"}
          </span>
        </div>
        <div className="terminal-actions">
          {status === "error" ? (
            <button type="button" className="btn btn-quiet btn-small" onClick={() => void boot()}>
              Retry
            </button>
          ) : null}
          <button
            type="button"
            className="btn-icon btn-ghost btn-small"
            aria-label="Sync workspace into the container"
            title="Sync files"
            disabled={status !== "ready"}
            onClick={() => {
              void syncNow(true);
              termRef.current?.focus();
            }}
          >
            <Icon name="refresh" size={14} />
          </button>
          <button
            type="button"
            className="btn-icon btn-ghost btn-small"
            aria-label="Restart the shell"
            title="Restart shell"
            disabled={status !== "ready"}
            onClick={restart}
          >
            <Icon name="power" size={14} />
          </button>
          <button
            type="button"
            className="btn-icon btn-ghost btn-small"
            aria-label="Clear terminal"
            title="Clear"
            onClick={() => {
              termRef.current?.clear();
              termRef.current?.focus();
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

      <div
        className="terminal-host"
        ref={hostRef}
        aria-label="Interactive terminal"
        onPointerDown={() => termRef.current?.focus()}
      />
    </section>
  );
}
