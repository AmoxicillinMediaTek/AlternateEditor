import type { TreeState } from "./types";
import { nodePath } from "./tree";

export interface SearchMatch {
  line: number;
  column: number;
  length: number;
  preview: string;
  previewStart: number;
}

export interface SearchFileResult {
  fileId: string;
  path: string;
  name: string;
  matches: SearchMatch[];
}

const MAX_MATCHES_PER_FILE = 20;
const MAX_FILES = 60;

export function searchWorkspace(
  tree: TreeState,
  contents: Record<string, string>,
  query: string,
  caseSensitive = false,
): SearchFileResult[] {
  const needle = query.trim();
  if (needle.length < 1) return [];
  const haystackNeedle = caseSensitive ? needle : needle.toLowerCase();
  const results: SearchFileResult[] = [];

  for (const node of Object.values(tree.nodes)) {
    if (node.kind !== "file") continue;
    const content = contents[node.id] ?? "";
    if (!content) continue;
    const lines = content.split("\n");
    const matches: SearchMatch[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const haystack = caseSensitive ? line : line.toLowerCase();
      let from = 0;
      let hit = haystack.indexOf(haystackNeedle, from);
      const trimmedStart = line.length - line.trimStart().length;
      const preview = line.trim().slice(0, 160);
      while (hit !== -1 && matches.length < MAX_MATCHES_PER_FILE) {
        matches.push({
          line: index + 1,
          column: hit,
          length: needle.length,
          preview,
          previewStart: Math.max(0, Math.min(preview.length, hit - trimmedStart)),
        });
        from = hit + Math.max(needle.length, 1);
        hit = haystack.indexOf(haystackNeedle, from);
      }
      if (matches.length >= MAX_MATCHES_PER_FILE) break;
    }
    if (matches.length > 0) {
      results.push({
        fileId: node.id,
        path: nodePath(tree, node.id),
        name: node.name,
        matches,
      });
    }
    if (results.length >= MAX_FILES) break;
  }

  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}

export function countMatches(results: SearchFileResult[]): number {
  return results.reduce((total, file) => total + file.matches.length, 0);
}
