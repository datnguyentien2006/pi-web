# Workspaces

Named project folders you can switch between with a single click. Each
workspace points at a directory on disk; switching to it makes that directory
the effective cwd for new chat sessions and filters the sidebar's session
list to that project.

## What is a workspace

- **Definition**: a `{ id, name, path }` triple stored in
  `~/.pi/agent/workspaces.json`.
- **Scope**: the path is the project root (or a worktree/subdirectory — see
  *Worktrees and subdirectories* below).
- **Active**: at most one workspace is active at a time. The active workspace
  is visually marked with an accent dot and bold name.
- **Not auto-created**: on first run the file is missing and the sidebar shows
  an empty state. Add your first workspace via the "Add workspace" button.

## User guide

### Add a workspace

1. Click **Add workspace** at the bottom of the Workspaces section.
2. Enter a **Name** (shown in the list) and **Path** (directory on disk).
3. Optionally use **Browse** (desktop app only) to pick a folder via the OS
   dialog.
4. Click **Add workspace**. The first workspace added becomes active
   automatically.

Paths are canonicalized server-side (symlinks resolved, `~` expanded). The
same path can only appear once.

### Switch workspaces

- **Click** a workspace row in the list.
- Or press **Ctrl/Cmd + 1..9** to jump to the Nth workspace.

Switching is blocked while any agent session is running. Cancel the running
session or wait for it to finish, then switch. A yellow notice explains this
if you try.

### Edit or remove

Hover a row, click the **⋯** button, then choose:

- **Rename / Edit path** — opens the same modal in edit mode.
- **Copy path** — copies the absolute path to the clipboard.
- **Reveal in file manager** — opens the OS file manager (desktop app only).
- **Remove workspace** — removes the entry. Does **not** delete any files.

### Reorder

Drag a workspace row up or down. An accent line shows the insert position.
The new order persists to `workspaces.json` immediately.

### Missing paths

If a workspace's directory no longer exists on disk, the row shows a red
**missing** badge. Click it to remove the workspace entry (with a confirm
dialog). Files are never touched.

## Data file

Location: `~/.pi/agent/workspaces.json`

Format:

```json
{
  "version": 1,
  "activeWorkspaceId": "ws-mv5dvlvi-gygxla",
  "workspaces": [
    {
      "id": "ws-mv5dvlvi-gygxla",
      "name": "pi-web",
      "path": "/home/user/pi-web",
      "created": "2026-10-12T15:05:03.102Z",
      "lastOpened": "2026-10-12T15:06:47.134Z"
    }
  ]
}