import type { TreeState } from "./types";

export const SEED_TREE: TreeState = {
  id: "ws_seed",
  name: "Untitled",
  rootId: "root",
  nodes: {
    root: { id: "root", name: "Untitled", kind: "folder", parentId: null },
  },
  expanded: { root: true },
};

export const SEED_CONTENTS: Record<string, string> = {};
