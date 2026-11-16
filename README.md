# AlternateEditorDemo

A mobile-first code editor for the browser. CodeMirror 6 handles editing, Next.js
serves the shell, xterm.js plus StackBlitz WebContainer run a real Node shell, and
an optional Rust service keeps a copy of your workspace on disk.

Open it on a phone and it behaves like an app: drawer for files, icon rail for
search and settings, thumb-sized controls. Open it on a desktop and it fills the
window with an explorer, tabs, and a terminal panel.

## Quick start

```bash
npm install
npm run dev          # web on :3000 and the Rust server on :8080
npm run dev:web      # web only
```

The editor works on its own. Everything you type is stored in IndexedDB on the
device, so a refresh, a closed tab, or an offline spell does not lose work. If
Rust is not installed, `npm run dev` still starts the web app and prints why the
server did not start.

### Rust server

`npm run dev` already starts it. To run it alone:

```bash
cd server
cargo run            # http://127.0.0.1:8080
```

or from the project root:

```bash
npm run server
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `QUARRY_BIND` | `127.0.0.1:8080` | Address the server listens on |
| `QUARRY_DATA_DIR` | `data` | Folder where pushed workspaces are stored |
| `NEXT_PUBLIC_RUST_URL` | `http://127.0.0.1:8080` | Where the frontend looks for the server |

With the server running, the explorer footer shows `Server online` and offers
**Push workspace**. The terminal does not use the server: it runs in the browser
on WebContainer.

## What is in the editor

- CodeMirror 6 with syntax highlighting for TypeScript, JavaScript, JSX/TSX, JSON,
  HTML, CSS, Markdown, Python, Rust, C/C++, Java, PHP, SQL, XML, and YAML.
- Line numbers, active-line highlight, bracket matching, code folding, autocomplete
  for words already in the file, undo/redo, and search.
- Per-file editor state: cursor, scroll, folds, and undo history survive switching
  tabs and reloading the page.
- Dirty markers compare against the last checkpoint. Content is stored locally
  as you type; auto save can also checkpoint edits every 2 seconds.
- Explorer with nested folders, file-type icons, create, rename, delete, and an
  active-file highlight.
- Workspace search with line previews; picking a hit opens the file at the match.
- Settings for theme (dark/light), font size, tab size, word wrap, active-line
  highlight, and optional auto save every 2 seconds. Settings persist.
- xterm.js terminal backed by a StackBlitz WebContainer shell (`sh`, `node`, `npm`).
- Light theme, dark theme, focus styles, and screen-reader labels throughout.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + S` | Save checkpoint for the active file |
| `Ctrl/Cmd + B` | Toggle the file explorer |
| `Ctrl/Cmd + J` or `` Ctrl/Cmd + ` `` | Toggle the terminal |
| `Ctrl/Cmd + Shift + F` | Search the workspace |
| `Ctrl/Cmd + ,` | Open settings |
| `Ctrl/Cmd + F` | Find in the current file |
| `Esc` | Close drawer or menu |

The sidebar icon rail switches the panel between Files, Search, and Settings
without leaving the sidebar. The terminal is only reachable from the top-bar
`⋯` menu (or `Ctrl/Cmd + J`). The editor adds a quick-key row for Tab, undo,
redo, and find while the on-screen keyboard is up.

## Terminal

The panel is xterm.js driving a `jsh` shell inside a StackBlitz WebContainer, so
`node`, `npm`, `npx`, `tsc` and friends really run in the tab. Files in the
explorer are mirrored into the container at boot, shortly after any edit, before
every `Enter`, and whenever you press the sync button, so `python file.py` or
`node file.js` sees what you just typed. Touch screens scroll the terminal
buffer with a vertical drag instead of the page. Closing the terminal keeps the
panel mounted, so the buffer, scrollback and shell survive until you reopen it.

`lua file.lua`, `luau file.lua`, `lua -e "print(1 + 1)"` and `lua -v` run on a
bundled Lua 5.3 VM ([fengari](https://fengari.io/)) inside the tab, no install
needed. Lua and Luau files get their own explorer badge and syntax highlighting.

WebContainer needs cross-origin isolation. `next.config.ts` sends
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` on every route; the runtime boots
with `coep: "require-corp"`. Without those headers the panel reports that the
container is offline and the rest of the editor keeps working.

No npm install is required for the shell itself, but anything you `npm i` is
ephemeral: the container filesystem lives in memory for the life of the tab.

## Architecture

```
src/
  app/                     Next.js app router, global styles, tokens
  components/
    editor/                CodeMirror view, extensions, themes, tabs
    explorer/              File tree and file-type icons
    search/                Workspace search sidebar view
    settings/              Settings sidebar view
    shell/                 Layout, top bar, sidebar rail, shortcuts
    terminal/              xterm.js panel on WebContainer
    ui/                    Dialog, menu, prompt, confirm, toasts, icons
  lib/
    backend.ts             Rust HTTP client
    workspace/             Store, tree operations, search, persistence, empty seed
    terminal/container.ts  WebContainer boot and workspace mirroring
server/src/
  main.rs                  Axum router and state
  workspace.rs             Path validation, sync, file operations, tree
```

The store is a small external store read through `useSyncExternalStore`. File
contents live in their own map so typing does not re-render the whole tree. One
`EditorView` is created and re-attached to a per-file `EditorState` when the active
tab changes.

## Server API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service status |
| `GET` | `/api/v1/workspaces` | List pushed workspaces |
| `POST` | `/api/v1/workspaces/sync` | Write `{ name, files: [{ path, content }] }` |
| `DELETE` | `/api/v1/workspaces/{name}` | Remove a workspace |
| `GET` | `/api/v1/workspaces/{name}/tree` | Folder tree |
| `GET` | `/api/v1/workspaces/{name}/file?path=...` | Read a file |
| `PUT` | `/api/v1/workspaces/{name}/file` | Write `{ path, content }` |
| `POST` | `/api/v1/workspaces/{name}/dir` | Create `{ path }` |
| `POST` | `/api/v1/workspaces/{name}/rename` | `{ from, to }` |
| `DELETE` | `/api/v1/workspaces/{name}/entry?path=...` | Delete a file or folder |

Every path is normalised and checked against the workspace root, so `..` and
absolute paths are rejected before touching disk. File writes are capped at 4 MB.

## Limits worth knowing

- One local workspace. The Rust service can hold many, but the UI manages one at
  a time and pushes it under a slug of the workspace name.
- The terminal lives in the tab. Closing it or reloading the page resets the
  container filesystem; your workspace in the editor is unaffected.
- No minimap, no Git integration, no extensions.
- Persistence is per browser profile. Clearing site data clears the workspace.

## Scripts

```bash
npm run dev        # web + Rust server together
npm run dev:web    # web only
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run server     # Rust service alone
```
