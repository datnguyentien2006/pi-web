import type { Workspace, WorkspacesResponse } from "./types";

// ============================================================================
// Client-side helpers for the /api/workspaces endpoints.
// Thin wrappers around fetch that throw on non-2xx so callers can try/catch.
// ============================================================================

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchWorkspaces(): Promise<WorkspacesResponse> {
  const res = await fetch("/api/workspaces");
  return handleJson<WorkspacesResponse>(res);
}

export async function createWorkspace(name: string, path: string): Promise<Workspace> {
  const res = await fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, path }),
  });
  const data = await handleJson<{ workspace: Workspace }>(res);
  return data.workspace;
}

export async function renameWorkspace(id: string, name: string): Promise<Workspace> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await handleJson<{ workspace: Workspace }>(res);
  return data.workspace;
}

export async function setActiveWorkspace(id: string): Promise<Workspace> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setActive: true }),
  });
  const data = await handleJson<{ workspace: Workspace }>(res);
  return data.workspace;
}

export async function deleteWorkspace(id: string): Promise<void> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await handleJson<{ success: true }>(res);
}

export async function reorderWorkspaces(ids: string[]): Promise<WorkspacesResponse> {
  const res = await fetch("/api/workspaces/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  return handleJson<WorkspacesResponse>(res);
}