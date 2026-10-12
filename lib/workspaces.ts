import { promises as fs, existsSync, realpathSync } from "fs";
import { homedir } from "os";
import { isAbsolute, join, resolve } from "path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { Workspace, WorkspacesResponse } from "./types";

// ============================================================================
// Workspaces file I/O
//
// File layout: ~/.pi/agent/workspaces.json
//   {
//     "version": 1,
//     "activeWorkspaceId": "ws-...",
//     "workspaces": [ { id, name, path, created, lastOpened }, ... ]
//   }
//
// Writes are atomic (temp file + rename) to survive concurrent requests.
// If the file is missing, we return an empty document — no auto-migration.
// ============================================================================

const FILE_VERSION = 1;

function workspacesFilePath(): string {
  return join(getAgentDir(), "workspaces.json");
}

/**
 * Expand a user-supplied path: strip surrounding quotes, expand `~` to the
 * home directory, and resolve relative paths against cwd. Returns an absolute
 * path with no trailing separator.
 */
export function expandWorkspacePath(input: string): string {
  let trimmed = input.trim().replace(/^["']|["']$/g, "");
  if (trimmed.startsWith("~/") || trimmed === "~") {
    trimmed = join(homedir(), trimmed.slice(1).replace(/^[\\/]/, ""));
  }
  return isAbsolute(trimmed) ? trimmed : resolve(trimmed);
}

function emptyFile(): WorkspacesResponse {
  return { version: FILE_VERSION, activeWorkspaceId: null, workspaces: [] };
}

function isValidWorkspace(value: unknown): value is Workspace {
  if (typeof value !== "object" || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    typeof w.id === "string" && w.id.length > 0 &&
    typeof w.name === "string" && w.name.length > 0 &&
    typeof w.path === "string" && w.path.length > 0 &&
    typeof w.created === "string" &&
    typeof w.lastOpened === "string"
  );
}

export async function readWorkspaces(): Promise<WorkspacesResponse> {
  let raw: string;
  try {
    raw = await fs.readFile(workspacesFilePath(), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyFile();
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt file — don't destroy it, just report empty. User can fix manually.
    return emptyFile();
  }

  if (typeof parsed !== "object" || parsed === null) return emptyFile();
  const p = parsed as Record<string, unknown>;

  const workspaces: Workspace[] = Array.isArray(p.workspaces)
    ? p.workspaces.filter(isValidWorkspace)
    : [];

  const activeWorkspaceId =
    typeof p.activeWorkspaceId === "string" &&
    workspaces.some((w) => w.id === p.activeWorkspaceId)
      ? p.activeWorkspaceId
      : workspaces[0]?.id ?? null;

  return { version: FILE_VERSION, activeWorkspaceId, workspaces };
}

async function writeWorkspaces(data: WorkspacesResponse): Promise<void> {
  const target = workspacesFilePath();
  await fs.mkdir(join(getAgentDir()), { recursive: true });
  // Atomic write: write to temp file in the same directory, then rename.
  // Same-directory rename is atomic on POSIX and Windows (NTFS).
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await fs.rename(tmp, target);
}

function generateId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `ws-${Date.now().toString(36)}-${rand}`;
}

/**
 * Normalize a filesystem path to its canonical form (symlinks resolved).
 * Falls back to the input if the path doesn't exist or realpath fails.
 */
function canonicalPath(input: string): string {
  if (!existsSync(input)) return input;
  try {
    return realpathSync(input);
  } catch {
    return input;
  }
}

// ============================================================================
// Public API
// ============================================================================

export async function listWorkspaces(): Promise<WorkspacesResponse> {
  const data = await readWorkspaces();
  // Enrich with existence check so the client can flag missing paths.
  const enriched = await Promise.all(
    data.workspaces.map(async (w) => ({
      ...w,
      exists: existsSync(w.path),
    })),
  );
  return { ...data, workspaces: enriched };
}

export async function createWorkspace(
  rawName: string,
  rawPath: string,
): Promise<Workspace> {
  const name = rawName.trim();
  if (!name) throw new Error("Workspace name is required");
  const expanded = expandWorkspacePath(rawPath);
  if (!existsSync(expanded)) {
    throw new Error(`Directory does not exist: ${expanded}`);
  }
  const path = canonicalPath(expanded);

  const file = await readWorkspaces();
  if (file.workspaces.some((w) => w.path === path)) {
    throw new Error(`A workspace already exists for this path: ${path}`);
  }

  const now = new Date().toISOString();
  const ws: Workspace = {
    id: generateId(),
    name,
    path,
    created: now,
    lastOpened: now,
  };

  file.workspaces.push(ws);
  // First workspace becomes active automatically.
  if (!file.activeWorkspaceId) file.activeWorkspaceId = ws.id;
  await writeWorkspaces(file);
  return ws;
}

export async function updateWorkspace(
  id: string,
  patch: { name?: string; path?: string; setActive?: boolean },
): Promise<Workspace | null> {
  const file = await readWorkspaces();
  const idx = file.workspaces.findIndex((w) => w.id === id);
  if (idx === -1) return null;

  const current = file.workspaces[idx];
  const next: Workspace = { ...current };

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error("Workspace name cannot be empty");
    next.name = trimmed;
  }

  if (patch.path !== undefined) {
    const expanded = expandWorkspacePath(patch.path);
    if (!existsSync(expanded)) {
      throw new Error(`Directory does not exist: ${expanded}`);
    }
    const path = canonicalPath(expanded);
    if (file.workspaces.some((w) => w.id !== id && w.path === path)) {
      throw new Error(`Another workspace already uses this path: ${path}`);
    }
    next.path = path;
  }

  if (patch.setActive) {
    next.lastOpened = new Date().toISOString();
    file.activeWorkspaceId = id;
  }

  file.workspaces[idx] = next;
  await writeWorkspaces(file);
  return next;
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  const file = await readWorkspaces();
  const before = file.workspaces.length;
  file.workspaces = file.workspaces.filter((w) => w.id !== id);
  if (file.workspaces.length === before) return false;

  // If the deleted workspace was active, fall back to the first remaining one.
  if (file.activeWorkspaceId === id) {
    file.activeWorkspaceId = file.workspaces[0]?.id ?? null;
  }
  await writeWorkspaces(file);
  return true;
}

export async function setActiveWorkspace(id: string | null): Promise<void> {
  const file = await readWorkspaces();
  if (id !== null && !file.workspaces.some((w) => w.id === id)) {
    throw new Error(`Workspace not found: ${id}`);
  }
  file.activeWorkspaceId = id;
  if (id) {
    const idx = file.workspaces.findIndex((w) => w.id === id);
    if (idx !== -1) file.workspaces[idx].lastOpened = new Date().toISOString();
  }
  await writeWorkspaces(file);
}

// ============================================================================
// Reorder
//
// Given a list of workspace ids in the desired display order, persist that
// order. Any id not present in the list keeps its relative position at the
// end (stable, so a partial reorder doesn't lose entries). Ids not in the
// current file are silently ignored.
// ============================================================================

export async function reorderWorkspaces(orderedIds: string[]): Promise<WorkspacesResponse> {
  const file = await readWorkspaces();
  const index = new Map<string, number>();
  orderedIds.forEach((id, i) => index.set(id, i));

  file.workspaces.sort((a, b) => {
    const ia = index.get(a.id);
    const ib = index.get(b.id);
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    // Neither in the list — keep insertion order stable.
    return 0;
  });

  await writeWorkspaces(file);
  return listWorkspaces();
}