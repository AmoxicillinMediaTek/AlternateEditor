# AlternateEditorDemo

A mobile-first code editor for the browser. CodeMirror 6 handles editing, Next.js
serves the shell, and an optional Rust service keeps a copy of your workspace on
disk and answers terminal commands in a read-only sandbox.

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
**Push workspace**. Terminal commands then travel over a WebSocket to the server
instead of running in the browser.

## What is in the editor

- CodeMirror 6 with syntax highlighting for TypeScript, JavaScript, JSX/TSX, JSON,
  HTML, CSS, Markdown, Python, Rust, C/C++, Java, PHP, SQL, XML, and YAML.
- Line numbers, active-line highlight, bracket matching, code folding, autocomplete
  for words already in the file, undo/redo, and search.
- Per-file editor state: cursor, scroll, folds, and undo history survive switching
  tabs and reloading the page.
- Dirty markers compare against the last explicit save. Content saves continuously,
  so the dot means "not checkpointed", not "not stored".
- Explorer with nested folders, file-type icons, create, rename, delete, and an
  active-file highlight.
- Workspace search with line previews; picking a hit opens the file at the match.
- Settings for theme (dark/light), font size, tab size, word wrap, and active-line
  highlight. Settings persist.
- Terminal panel with local commands and a remote sandbox mode.
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

## Terminal commands

Browser shell: `ls`, `cat`, `open`, `pwd`, `theme`, `echo`, `whoami`, `clear`, `help`.

Rust sandbox: `ls`, `cat`, `pwd`, `echo`, `whoami`, `help`. It never spawns a
process, never writes files, and caps each session at 120 commands and each file
read at 64 KB. Push the workspace first so there is something to read.

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
    terminal/              Terminal UI and browser-shell commands
    ui/                    Dialog, menu, prompt, confirm, toasts, icons
  lib/
    backend.ts             Rust HTTP/WebSocket client
    workspace/             Store, tree operations, search, persistence, empty seed
    terminal/local-shell.ts
server/src/
  main.rs                  Axum router and state
  workspace.rs             Path validation, sync, file operations, tree
  terminal.rs              Read-only WebSocket sandbox
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
| `WS` | `/ws/terminal?workspace=...` | `{ type: "command", command }` in, `{ type, data }` out |

Every path is normalised and checked against the workspace root, so `..` and
absolute paths are rejected before touching disk. File writes are capped at 4 MB.

## Limits worth knowing

- One local workspace. The Rust service can hold many, but the UI manages one at
  a time and pushes it under a slug of the workspace name.
- The terminal is a command sandbox, not a shell. No compilers, package managers,
  or long-running processes.
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
