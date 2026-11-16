import type { NodeKind, TreeNode, TreeState } from "./types";

export type WorkspaceErrorCode =
  | "empty-name"
  | "invalid-name"
  | "duplicate"
  | "not-found"
  | "root-protected"
  | "wrong-parent";

export class WorkspaceError extends Error {
  code: WorkspaceErrorCode;

  constructor(code: WorkspaceErrorCode, message: string) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

let idCounter = 0;

export function createId(prefix = "n"): string {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}${random}`;
}

const INVALID_CHARS = /[/\\:*?"<>|\u0000-\u001f]/;

export function cleanEntryName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function validateEntryName(name: string): string | null {
  if (!name) return "Enter a name.";
  if (name.length > 80) return "Keep names under 80 characters.";
  if (name === "." || name === "..") return "That name is reserved.";
  if (name.startsWith(".")) {
    if (name === ".env" || name === ".gitignore" || name === ".npmrc") return null;
    return "Names can't start with a dot.";
  }
  if (INVALID_CHARS.test(name)) {
    return 'Names can\'t contain / \\ : * ? " < > |';
  }
  if (name.endsWith(".")) return "Names can't end with a dot.";
  return null;
}

export function childrenOf(tree: TreeState, parentId: string): TreeNode[] {
  return Object.values(tree.nodes)
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
}

export function nodePath(tree: TreeState, id: string): string {
  const parts: string[] = [];
  let current: TreeNode | undefined = tree.nodes[id];
  let guard = 0;
  while (current && current.id !== tree.rootId && guard < 64) {
    parts.unshift(current.name);
    current = current.parentId ? tree.nodes[current.parentId] : undefined;
    guard += 1;
  }
  return parts.join("/");
}

export function findNodeByPath(tree: TreeState, path: string): TreeNode | null {
  const segments = path.split("/").filter(Boolean);
  let parentId = tree.rootId;
  let found: TreeNode | null = tree.nodes[tree.rootId] ?? null;
  for (const segment of segments) {
    const next = childrenOf(tree, parentId).find((node) => node.name === segment);
    if (!next) return null;
    found = next;
    parentId = next.id;
  }
  return found;
}

export function descendantIds(tree: TreeState, id: string): string[] {
  const out: string[] = [];
  const walk = (parentId: string) => {
    for (const child of Object.values(tree.nodes)) {
      if (child.parentId === parentId) {
        out.push(child.id);
        if (child.kind === "folder") walk(child.id);
      }
    }
  };
  walk(id);
  return out;
}

export function siblingNameExists(
  tree: TreeState,
  parentId: string,
  name: string,
  excludeId?: string,
): boolean {
  const target = name.toLowerCase();
  return childrenOf(tree, parentId).some(
    (node) => node.id !== excludeId && node.name.toLowerCase() === target,
  );
}

export function ensureValidName(
  tree: TreeState,
  parentId: string,
  rawName: string,
  excludeId?: string,
): string {
  const name = cleanEntryName(rawName);
  const problem = validateEntryName(name);
  if (problem) {
    throw new WorkspaceError(
      name.length === 0 ? "empty-name" : "invalid-name",
      problem,
    );
  }
  if (!tree.nodes[parentId] || tree.nodes[parentId].kind !== "folder") {
    throw new WorkspaceError("not-found", "That folder no longer exists.");
  }
  if (siblingNameExists(tree, parentId, name, excludeId)) {
    throw new WorkspaceError("duplicate", `"${name}" already exists here.`);
  }
  return name;
}

export interface CreateEntryResult {
  tree: TreeState;
  node: TreeNode;
}

export function createEntry(
  tree: TreeState,
  parentId: string,
  kind: NodeKind,
  rawName: string,
): CreateEntryResult {
  const name = ensureValidName(tree, parentId, rawName);
  const node: TreeNode = {
    id: createId(kind === "folder" ? "f" : "file"),
    name,
    kind,
    parentId,
  };
  return {
    tree: {
      ...tree,
      nodes: { ...tree.nodes, [node.id]: node },
      expanded:
        kind === "folder"
          ? { ...tree.expanded, [parentId]: true }
          : { ...tree.expanded, [parentId]: true },
    },
    node,
  };
}

export function renameEntry(tree: TreeState, id: string, rawName: string): TreeState {
  const node = tree.nodes[id];
  if (!node) throw new WorkspaceError("not-found", "That item no longer exists.");
  if (id === tree.rootId) {
    throw new WorkspaceError("root-protected", "The workspace root can't be renamed.");
  }
  if (!node.parentId) {
    throw new WorkspaceError("root-protected", "The workspace root can't be renamed.");
  }
  const name = ensureValidName(tree, node.parentId, rawName, id);
  if (name === node.name) return tree;
  return { ...tree, nodes: { ...tree.nodes, [id]: { ...node, name } } };
}

export interface DeleteEntryResult {
  tree: TreeState;
  removedIds: string[];
  parentId: string;
}

export function deleteEntry(tree: TreeState, id: string): DeleteEntryResult {
  const node = tree.nodes[id];
  if (!node) throw new WorkspaceError("not-found", "That item no longer exists.");
  if (id === tree.rootId) {
    throw new WorkspaceError("root-protected", "The workspace root can't be deleted.");
  }
  const removedIds = [id, ...descendantIds(tree, id)];
  const nodes = { ...tree.nodes };
  const expanded = { ...tree.expanded };
  for (const removed of removedIds) {
    delete nodes[removed];
    delete expanded[removed];
  }
  return {
    tree: { ...tree, nodes, expanded },
    removedIds,
    parentId: node.parentId ?? tree.rootId,
  };
}

export function expandAncestors(tree: TreeState, id: string): TreeState {
  const expanded = { ...tree.expanded };
  let current = tree.nodes[id];
  let guard = 0;
  while (current?.parentId && guard < 64) {
    expanded[current.parentId] = true;
    current = tree.nodes[current.parentId];
    guard += 1;
  }
  return expanded === tree.expanded ? tree : { ...tree, expanded };
}

export function countTree(tree: TreeState): { files: number; folders: number } {
  let files = 0;
  let folders = 0;
  for (const node of Object.values(tree.nodes)) {
    if (node.id === tree.rootId) continue;
    if (node.kind === "file") files += 1;
    else folders += 1;
  }
  return { files, folders };
}

export function isDescendant(tree: TreeState, id: string, potentialAncestorId: string): boolean {
  let current = tree.nodes[id];
  let guard = 0;
  while (current?.parentId && guard < 64) {
    if (current.parentId === potentialAncestorId) return true;
    current = tree.nodes[current.parentId];
    guard += 1;
  }
  return false;
}
