import type { AppStore } from "@/lib/workspace/store";
import { childrenOf, findNodeByPath, nodePath } from "@/lib/workspace/tree";
import type { TerminalLine } from "@/lib/workspace/types";

type Output = Omit<TerminalLine, "id">;

const HELP = [
  "Browser shell. Commands run against this workspace, nothing else.",
  "",
  "  ls [path]      list a folder",
  "  cat <file>     print a file",
  "  open <file>    open a file in the editor",
  "  pwd            print the workspace path",
  "  theme <dark|light>",
  "  echo <text>",
  "  clear          clear the screen",
  "",
  "Start the Rust server to run these in a sandbox instead.",
].join("\n");

function out(text: string): Output {
  return { kind: "output", text };
}

function err(text: string): Output {
  return { kind: "error", text };
}

function normalizePath(raw: string): string {
  return raw.trim().replace(/^\.\/+/, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function runLocalCommand(line: string, store: AppStore): Output[] | "clear" {
  const trimmed = line.trim();
  if (!trimmed) return [];
  const [command, ...rest] = trimmed.split(/\s+/);
  const argument = rest.join(" ");
  const state = store.getState();
  const tree = state.tree;

  switch (command) {
    case "help":
      return [out(HELP)];
    case "clear":
      return "clear";
    case "pwd":
      return [out(`/workspace/${tree.name}`)];
    case "whoami":
      return [out("you")];
    case "echo":
      return [out(argument)];
    case "theme": {
      if (argument !== "dark" && argument !== "light") {
        return [err("Usage: theme dark|light")];
      }
      store.updateSettings({ theme: argument });
      return [out(`Theme set to ${argument}.`)];
    }
    case "ls": {
      const path = normalizePath(argument);
      const node = path ? findNodeByPath(tree, path) : tree.nodes[tree.rootId];
      if (!node) return [err(`ls: ${path}: no such folder`)];
      if (node.kind !== "folder") return [err(`ls: ${path}: not a folder`)];
      const children = childrenOf(tree, node.id);
      if (children.length === 0) return [out("(empty)")];
      return [
        out(
          children
            .map((child) => (child.kind === "folder" ? `${child.name}/` : child.name))
            .join("  "),
        ),
      ];
    }
    case "cat": {
      const path = normalizePath(argument);
      if (!path) return [err("Usage: cat <file>")];
      const node = findNodeByPath(tree, path);
      if (!node) return [err(`cat: ${path}: no such file`)];
      if (node.kind !== "file") return [err(`cat: ${path}: is a folder`)];
      const content = state.contents[node.id] ?? "";
      const lines = content.split("\n");
      return [out(lines.slice(0, 400).join("\n"))];
    }
    case "open": {
      const path = normalizePath(argument);
      if (!path) return [err("Usage: open <file>")];
      const node = findNodeByPath(tree, path);
      if (!node) return [err(`open: ${path}: no such file`)];
      if (node.kind !== "file") return [err(`open: ${path}: is a folder`)];
      store.setReveal({ fileId: node.id, line: 1, column: 0, length: 0 });
      return [out(`Opened ${nodePath(tree, node.id)}`)];
    }
    case "cd":
      return [err("The browser shell has no working directory. Paths are relative to the workspace root.")];
    case "node":
    case "npm":
    case "tsc":
    case "cargo":
      return [err(`${command}: not available in the browser shell. Start the Rust server for sandboxed commands.`)];
    default:
      return [err(`${command}: unknown command. Type "help".`)];
  }
}
