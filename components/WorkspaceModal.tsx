"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { isDesktop, pickDirectory } from "@/lib/desktop-bridge";
import type { Workspace } from "@/lib/types";

interface Props {
  open: boolean;
  /** Pass an existing workspace to switch to edit mode; null/undefined for add. */
  editing?: Workspace | null;
  onClose: () => void;
  onSaved: (workspace: Workspace, mode: "add" | "edit") => void;
}

/**
 * Create-or-edit modal for a workspace. Both modes post to the same endpoints;
 * edit mode PATCHes /api/workspaces/[id], add mode POSTs /api/workspaces.
 */
export function WorkspaceModal({ open, editing, onClose, onSaved }: Props) {
  const isEdit = Boolean(editing);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setPath(editing?.path ?? "");
    setError(null);
    setBusy(false);
    setPicking(false);
    setTimeout(() => nameRef.current?.focus(), 40);
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const handlePick = useCallback(async () => {
    setPicking(true);
    setError(null);
    try {
      const r = await pickDirectory();
      if (!r.ok) {
        if (!r.canceled) setError(r.error ?? "Could not pick directory");
        return;
      }
      if (r.path) setPath(r.path);
    } finally {
      setPicking(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedPath = path.trim();
    if (!trimmedName) { setError("Name is required"); return; }
    if (!trimmedPath) { setError("Path is required"); return; }

    setBusy(true);
    setError(null);
    try {
      const url = isEdit && editing
        ? `/api/workspaces/${encodeURIComponent(editing.id)}`
        : "/api/workspaces";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, path: trimmedPath }),
      });
      const data = await res.json().catch(() => ({})) as {
        workspace?: Workspace;
        error?: string;
      };
      if (!res.ok || !data.workspace) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      onSaved(data.workspace, isEdit ? "edit" : "add");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [name, path, isEdit, editing, onSaved, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => { if (!busy) onClose(); }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 400,
          background: "rgba(0,0,0,0.42)",
          backdropFilter: "blur(2px)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit workspace" : "Add workspace"}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 401,
          width: "min(460px, calc(100vw - 32px))",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 18px 4px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            {isEdit ? "Edit workspace" : "Add workspace"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
            {isEdit
              ? "Update the display name or path for this workspace."
              : "Workspaces are saved projects you can switch between quickly."}
          </div>
        </div>

        <div style={{ padding: "14px 18px 6px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              htmlFor="ws-name"
              style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 5, letterSpacing: "0.01em" }}
            >
              Name
            </label>
            <input
              id="ws-name"
              ref={nameRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="project-a"
              disabled={busy}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: 13,
                background: "var(--bg-hover)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                color: "var(--text)",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>

          <div>
            <label
              htmlFor="ws-path"
              style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 5, letterSpacing: "0.01em" }}
            >
              Path
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                id="ws-path"
                value={path}
                onChange={(e) => { setPath(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !busy) handleSubmit(); }}
                placeholder="/home/user/project-a"
                disabled={busy}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "8px 10px",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  background: "var(--bg-hover)",
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  color: "var(--text)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
              {isDesktop() && (
                <button
                  type="button"
                  onClick={handlePick}
                  disabled={busy || picking}
                  title="Browse local folder"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 38,
                    background: "var(--bg-hover)",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    color: "var(--text-muted)",
                    cursor: busy || picking ? "wait" : "pointer",
                    flexShrink: 0,
                    transition: "background 0.12s, color 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!busy && !picking) { e.currentTarget.style.background = "var(--bg-selected)"; e.currentTarget.style.color = "var(--accent)"; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 4a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V6" />
                    <path d="M2 6h12l-1.2 6.2a1 1 0 0 1-1 .8H3.2a1 1 0 0 1-1-.8L2 6Z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div
              style={{
                fontSize: 12,
                color: "#dc2626",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.22)",
                borderRadius: 6,
                padding: "7px 9px",
                lineHeight: 1.5,
                overflowWrap: "anywhere",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 18px 16px" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "7px 14px",
              background: "var(--bg-hover)",
              border: "1px solid var(--border)",
              borderRadius: 7,
              color: "var(--text-muted)",
              fontSize: 12,
              fontWeight: 500,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || !name.trim() || !path.trim()}
            style={{
              padding: "7px 16px",
              background: "var(--accent)",
              border: "none",
              borderRadius: 7,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: busy || !name.trim() || !path.trim() ? "not-allowed" : "pointer",
              opacity: busy || !name.trim() || !path.trim() ? 0.55 : 1,
              transition: "opacity 0.12s, background 0.12s",
            }}
            onMouseEnter={(e) => { if (!busy && name.trim() && path.trim()) e.currentTarget.style.background = "var(--accent-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
          >
            {busy ? "Saving…" : isEdit ? "Save" : "Add workspace"}
          </button>
        </div>
      </div>
    </>
  );
}