"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStore, useStoreApi } from "@/lib/workspace/store";
import { countMatches, searchWorkspace, type SearchMatch } from "@/lib/workspace/search";

function MatchPreview({ match, query }: { match: SearchMatch; query: string }) {
  const length = Math.min(match.length, match.preview.length - match.previewStart);
  const before = match.preview.slice(0, match.previewStart);
  const hit = match.preview.slice(match.previewStart, match.previewStart + Math.max(length, 0));
  const after = match.preview.slice(match.previewStart + Math.max(length, 0));
  return (
    <span className="search-preview mono">
      {before}
      <mark>{hit || query}</mark>
      {after}
    </span>
  );
}

export function SearchView({ onClose }: { onClose: () => void }) {
  const store = useStoreApi();
  const tree = useStore((state) => state.tree);
  const contents = useStore((state) => state.contents);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => searchWorkspace(tree, contents, deferredQuery, caseSensitive),
    [tree, contents, deferredQuery, caseSensitive],
  );
  const total = useMemo(() => countMatches(results), [results]);
  const trimmed = deferredQuery.trim();
  const pending = deferredQuery !== query;
  const first = results[0]?.matches[0];

  const openMatch = (fileId: string, match: SearchMatch) => {
    store.setReveal({ fileId, line: match.line, column: match.column, length: match.length });
    onClose();
  };

  return (
    <div className="side-view">
      <div className="explorer-brand view-brand">
        <span className="brand-name">Search</span>
        <button
          type="button"
          className="btn-icon btn-ghost explorer-close"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="side-view-body">
        <div className="search-body">
          <form
            className="search-form"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              if (first && results[0]) openMatch(results[0].fileId, first);
            }}
          >
            <div className="search-field">
              <Icon name="search" size={17} />
              <input
                type="text"
                className="search-input"
                placeholder="Search files"
                aria-label="Search workspace"
                value={query}
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") onClose();
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="btn-icon btn-ghost btn-small"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <Icon name="close" size={15} />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className={`btn btn-quiet btn-small case-toggle ${caseSensitive ? "is-on" : ""}`}
              aria-pressed={caseSensitive}
              title="Match case"
              onClick={() => setCaseSensitive((value) => !value)}
            >
              Aa
            </button>
          </form>

          <p className="search-summary mono" aria-live="polite">
            {!trimmed
              ? "Searches every file in this workspace."
              : pending
                ? "Searching…"
                : total === 0
                  ? "No matches."
                  : `${total} ${total === 1 ? "match" : "matches"} in ${results.length} ${
                      results.length === 1 ? "file" : "files"
                    }`}
          </p>

          <div className="search-results">
            {trimmed && total === 0 && !pending ? (
              <div className="search-empty">
                <p>Nothing found for "{deferredQuery.trim()}".</p>
                <p className="search-empty-hint">Try fewer characters, or turn off match case.</p>
              </div>
            ) : null}
            {results.map((file) => (
              <section className="search-file" key={file.fileId}>
                <header className="search-file-head">
                  <Icon name="file" size={14} />
                  <span className="search-file-path">{file.path}</span>
                  <span className="search-file-count mono">{file.matches.length}</span>
                </header>
                <ul className="search-hits">
                  {file.matches.map((match, index) => (
                    <li key={`${file.fileId}-${match.line}-${match.column}-${index}`}>
                      <button
                        type="button"
                        className="search-hit"
                        onClick={() => openMatch(file.fileId, match)}
                      >
                        <span className="search-line mono">{match.line}</span>
                        <MatchPreview match={match} query={deferredQuery} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
