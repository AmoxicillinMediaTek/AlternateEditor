export type NodeKind = "file" | "folder";

export interface TreeNode {
  id: string;
  name: string;
  kind: NodeKind;
  parentId: string | null;
}

export interface TreeState {
  id: string;
  name: string;
  rootId: string;
  nodes: Record<string, TreeNode>;
  expanded: Record<string, boolean>;
}

export type ThemeName = "dark" | "light";

export interface Settings {
  theme: ThemeName;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  highlightActiveLine: boolean;
}

export interface RevealRequest {
  fileId: string;
  line: number;
  column: number;
  length: number;
  token: number;
}

export type BackendStatus = "unknown" | "checking" | "online" | "offline";

export interface BackendState {
  status: BackendStatus;
  version: string | null;
  checkedAt: number | null;
}

export type ToastTone = "info" | "error" | "success";

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface PersistedWorkspace {
  version: 1;
  savedAt: number;
  tree: TreeState;
  contents: Record<string, string>;
  savedContents: Record<string, string>;
  openFiles: string[];
  activeFileId: string | null;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  highlightActiveLine: true,
};
