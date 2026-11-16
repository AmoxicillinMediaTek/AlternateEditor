import type { WebContainer } from "@webcontainer/api";
import type { TreeState } from "@/lib/workspace/types";
import { childrenOf } from "@/lib/workspace/tree";

const SHELL = "jsh";

let instance: WebContainer | null = null;
let booting: Promise<WebContainer> | null = null;
let synced: Map<string, string> = new Map();

export function bootContainer(): Promise<WebContainer> {
  if (instance) return Promise.resolve(instance);
  if (!booting) {
    booting = import("@webcontainer/api")
      .then(({ WebContainer }) =>
        WebContainer.boot({ coep: "require-corp", workdirName: "workspace" }),
      )
      .then((container) => {
        instance = container;
        return container;
      })
      .finally(() => {
        booting = null;
      });
  }
  return booting;
}

export function shellCommand(): string {
  return SHELL;
}

function listEntries(
  tree: TreeState,
  parentId: string,
  contents: Record<string, string>,
  prefix: string,
  files: Map<string, string>,
  folders: Set<string>,
): void {
  for (const child of childrenOf(tree, parentId)) {
    const path = prefix ? `${prefix}/${child.name}` : child.name;
    if (child.kind === "folder") {
      folders.add(path);
      listEntries(tree, child.id, contents, path, files, folders);
    } else {
      files.set(path, contents[child.id] ?? "");
    }
  }
}

export async function syncWorkspace(
  container: WebContainer,
  tree: TreeState,
  contents: Record<string, string>,
): Promise<{ written: number; removed: number }> {
  const files = new Map<string, string>();
  const folders = new Set<string>();
  listEntries(tree, tree.rootId, contents, "", files, folders);

  for (const folder of [...folders].sort((a, b) => a.length - b.length)) {
    await container.fs.mkdir(folder, { recursive: true }).catch(() => undefined);
  }

  let written = 0;
  for (const [path, content] of files) {
    if (synced.get(path) === content) continue;
    const parent = path.split("/").slice(0, -1).join("/");
    if (parent) await container.fs.mkdir(parent, { recursive: true }).catch(() => undefined);
    await container.fs.writeFile(path, content);
    written += 1;
  }

  let removed = 0;
  for (const path of [...synced.keys()]) {
    if (files.has(path)) continue;
    await container.fs.rm(path, { force: true, recursive: true }).catch(() => undefined);
    synced.delete(path);
    removed += 1;
  }

  synced = files;
  return { written, removed };
}

