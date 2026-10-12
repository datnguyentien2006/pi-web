"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Workspace } from "@/lib/types";
import { copyText } from "@/lib/clipboard";
import { isDesktop, openFolderLocally } from "@/lib/desktop-bridge";

interface Props {
  workspaces: Workspace[];
  activePath: string | null;
  blocked: boolean;
  /** Map of workspace.path → number of sessions in that project. */
  sessionCountByPath: Map<string, number>;
  onSelect: (workspace: Workspace) => void;
  onEdit: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
  onReorder: (orderedIds: string[]) => void;
  onAdd: () => void;
}

/**
 * Workspace list with:
 *   - Per-item context menu (Rename/Copy/Reveal/Remove)
 *   - Missing-path badge with one-click removal
 *   - Session count badge
 *   - Drag-to-reorder (native HTML5 DnD)
 *   - Keyboard: Enter/Space on a focused row selects it
 *   - Focus-visible outline for a11y
 *
 * Drag semantics: the dragged item "floats"; a 2px accent line shows the
 * insert position. On drop the parent persists the new order via
 * onReorder(orderedIds).
 */
export function WorkspaceList({
  workspaces,
  activePath,
  blocked,
  sessionCountByPath,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
  onAdd,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmRemoveMissingId, setConfirmRemoveMissingId] = useState<string | null>(null);

  // Drag state: the id being dragged, and the index of the item currently
  // hovered for insertion. Both null when no drag is active.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Close menu on outside click / scroll / resize / Escape.
  useEffect(() => {
    if (!menuForId) return;
    const close = () => setMenuForId(null);
    const onMouse = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuForId]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const openMenu = useCallback((id: string) => {
    const trigger = triggerRefs.current.get(id);
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setMenuForId(id);
  }, []);

  const handleCopyPath = useCallback((ws: Workspace) => {
    void copyText(ws.path).then(() => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      setCopiedId(ws.id);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 1400);
    });
  }, []);

  const handleReveal = useCallback((ws: Workspace) => {
    void openFolderLocally(ws.path);
  }, []);

  // ── Drag & drop ───────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    if (blocked) {
      e.preventDefault();
      return;
    }
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Some browsers require setData for drag to initiate reliably.
    e.dataTransfer.setData("text/plain", id);
  }, [blocked]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Decide insert-before or insert-after based on pointer y.
    const target = rowRefs.current.get(workspaces[index].id);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const nextIndex = e.clientY < mid ? index : index + 1;
    if (nextIndex !== dropIndex) setDropIndex(nextIndex);
  }, [draggingId, dropIndex, workspaces]);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const fromId = draggingId;
    const toIndex = dropIndex;
    setDraggingId(null);
    setDropIndex(null);

    if (!fromId || toIndex === null) return;
    const fromIndex = workspaces.findIndex((w) => w.id === fromId);
    if (fromIndex === -1) return;

    // Compute the reordered array.
    const without = workspaces.filter((w) => w.id !== fromId);
    // toIndex was measured against the original array; when moving down we
    // need to decrement by 1 because the source is being removed first.
    const adjusted = toIndex > fromIndex ? toIndex - 1 : toIndex;
    const clamped = Math.max(0, Math.min(without.length, adjusted));
    const next = [
      ...without.slice(0, clamped),
      workspaces[fromIndex],
      ...without.slice(clamped),
    ];
    if (next.map((w) => w.id).join(",") === workspaces.map((w) => w.id).join(",")) return;
    onReorder(next.map((w) => w.id));
  }, [draggingId, dropIndex, workspaces, onReorder]);

  const menuItemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 9,
    width: "100%", padding: "7px 10px",
    background: "none", border: "none",
    borderBottom: "1px solid var(--border)",
    color: "var(--text-muted)",
    cursor: "pointer", textAlign: "left",
    fontSize: 12, whiteSpace: "nowrap",
    transition: "background 0.12s, color 0.12s",
  };

  const menuWorkspace = workspaces.find((w) => w.id === menuForId) ?? null;
  const confirmWorkspace = workspaces.find((w) => w.id === confirmRemoveMissingId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <style>{`
        .pi-ws-row:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        .pi-ws-menu-item:focus-visible {
          background: var(--bg-hover) !important;
          color: var(--text) !important;
          outline: none;
        }
        .pi-ws-drag-handle {
          user-select: none;
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 6px 6px",
        }}
      >
        <span
          title="Press Ctrl/Cmd+1..9 to switch workspaces"
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--text-dim)",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            cursor: "help",
          }}
        >
          Workspaces
        </span>
        {blocked && (
          <span
            title="Agent is running — stop it before switching workspaces"
            style={{ fontSize: 10, color: "var(--text-dim)" }}
          >
            locked
          </span>
        )}
      </div>

      {workspaces.length === 0 ? (
        <div
          style={{
            padding: "10px 10px 12px",
            margin: "2px 2px 4px",
            fontSize: 11.5,
            color: "var(--text-muted)",
            lineHeight: 1.55,
            background: "var(--bg-hover)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>No workspaces yet</span>
          </div>
          <div style={{ color: "var(--text-dim)" }}>
            Add a project folder to jump between codebases with one click.
          </div>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 1, position: "relative" }}
          onDragOver={(e) => { if (draggingId) e.preventDefault(); }}
          onDrop={handleDrop}
        >
          {/* Insertion indicator — absolute line at the drop position */}
          {draggingId && dropIndex !== null && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 4,
                right: 4,
                top: 0,
                pointerEvents: "none",
                transform: `translateY(${computeIndicatorOffset(dropIndex, workspaces, rowRefs)}px)`,
                height: 2,
                background: "var(--accent)",
                borderRadius: 1,
                transition: "transform 0.08s ease",
                zIndex: 3,
              }}
            />
          )}

          {workspaces.map((ws, index) => {
            const isActive = activePath !== null && ws.path === activePath;
            const isHovered = hoveredId === ws.id;
            const missing = ws.exists === false;
            const menuOpen = menuForId === ws.id;
            const isDragging = draggingId === ws.id;
            const count = sessionCountByPath.get(ws.path) ?? 0;
            return (
              <div
                key={ws.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(ws.id, el);
                  else rowRefs.current.delete(ws.id);
                }}
                className="pi-ws-row"
                tabIndex={blocked ? -1 : 0}
                role="button"
                aria-pressed={isActive}
                aria-label={`${ws.name}${missing ? " (missing)" : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!blocked && !isActive) onSelect(ws);
                  }
                }}
                draggable={!blocked}
                onDragStart={(e) => handleDragStart(e, ws.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onMouseEnter={() => setHoveredId(ws.id)}
                onMouseLeave={() => setHoveredId((cur) => (cur === ws.id ? null : cur))}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: isActive
                    ? "var(--bg-selected)"
                    : isHovered || menuOpen
                      ? "var(--bg-hover)"
                      : "transparent",
                  transition: "background 0.1s, opacity 0.1s",
                  cursor: blocked ? "not-allowed" : "pointer",
                  opacity: isDragging ? 0.4 : (blocked && !isActive ? 0.55 : 1),
                }}
                onClick={() => {
                  if (blocked || isActive || menuOpen) return;
                  onSelect(ws);
                }}
                title={blocked ? "Stop the running agent to switch workspaces" : ws.path}
              >
                {/* Drag handle — appears on hover, indicates draggability */}
                <span
                  aria-hidden
                  className="pi-ws-drag-handle"
                  style={{
                    flexShrink: 0,
                    width: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-dim)",
                    opacity: isHovered && !blocked ? 0.7 : 0,
                    transition: "opacity 0.12s",
                    cursor: blocked ? "not-allowed" : "grab",
                    marginLeft: -4,
                  }}
                >
                  <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                    <circle cx="2" cy="2" r="0.9" /><circle cx="6" cy="2" r="0.9" />
                    <circle cx="2" cy="6" r="0.9" /><circle cx="6" cy="6" r="0.9" />
                    <circle cx="2" cy="10" r="0.9" /><circle cx="6" cy="10" r="0.9" />
                  </svg>
                </span>

                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: missing
                      ? "#ef4444"
                      : isActive
                        ? "var(--accent)"
                        : "var(--border)",
                    transition: "background 0.12s",
                  }}
                />

                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--text)" : "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ws.name}
                </span>

                {missing ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (blocked) return;
                      setConfirmRemoveMissingId(ws.id);
                    }}
                    disabled={blocked}
                    title="Directory no longer exists on disk — click to remove this workspace"
                    style={{
                      flexShrink: 0,
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "1px 5px",
                      borderRadius: 3,
                      color: "#dc2626",
                      background: "rgba(239,68,68,0.10)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      letterSpacing: "0.02em",
                      cursor: blocked ? "not-allowed" : "pointer",
                    }}
                  >
                    missing
                  </button>
                ) : (
                  count > 0 && (
                    <span
                      title={`${count} session${count === 1 ? "" : "s"} in this workspace`}
                      style={{
                        flexShrink: 0,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "1px 5px",
                        minWidth: 16,
                        textAlign: "center",
                        borderRadius: 999,
                        color: isActive ? "var(--accent)" : "var(--text-dim)",
                        background: isActive
                          ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                          : "var(--bg-hover)",
                        border: "1px solid var(--border)",
                        fontFamily: "var(--font-mono)",
                        lineHeight: 1.4,
                      }}
                    >
                      {count}
                    </span>
                  )
                )}

                <button
                  ref={(el) => {
                    if (el) triggerRefs.current.set(ws.id, el);
                    else triggerRefs.current.delete(ws.id);
                  }}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (menuOpen) setMenuForId(null);
                    else openMenu(ws.id);
                  }}
                  title="More actions"
                  aria-label={`More actions for ${ws.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    padding: 0,
                    background: menuOpen ? "var(--bg-selected)" : "transparent",
                    border: "none",
                    borderRadius: 5,
                    color: menuOpen ? "var(--accent)" : "var(--text-dim)",
                    cursor: "pointer",
                    opacity: isHovered || menuOpen ? 1 : 0,
                    transition: "opacity 0.12s, background 0.12s, color 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!menuOpen) {
                      e.currentTarget.style.background = "var(--bg-hover)";
                      e.currentTarget.style.color = "var(--text)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!menuOpen) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-dim)";
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <circle cx="3" cy="8" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="13" cy="8" r="1.5" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "6px 8px",
          marginTop: 4,
          background: "none",
          border: "1px dashed var(--border)",
          borderRadius: 6,
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 11.5,
          fontWeight: 500,
          transition: "background 0.12s, color 0.12s, border-color 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-hover)";
          e.currentTarget.style.color = "var(--accent)";
          e.currentTarget.style.borderColor = "rgba(217,119,87,0.45)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "none";
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="6" y1="1" x2="6" y2="11" />
          <line x1="1" y1="6" x2="11" y2="6" />
        </svg>
        Add workspace
      </button>

      {menuForId && menuPos && menuWorkspace && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed",
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 500,
            minWidth: 168,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          <button
            role="menuitem"
            className="pi-ws-menu-item"
            onClick={() => { setMenuForId(null); onEdit(menuWorkspace); }}
            style={menuItemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            Rename / Edit path
          </button>
          <button
            role="menuitem"
            className="pi-ws-menu-item"
            onClick={() => { handleCopyPath(menuWorkspace); setMenuForId(null); }}
            style={menuItemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            {copiedId === menuWorkspace.id ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy path
              </>
            )}
          </button>
          {isDesktop() && (
            <button
              role="menuitem"
              className="pi-ws-menu-item"
              onClick={() => { handleReveal(menuWorkspace); setMenuForId(null); }}
              style={menuItemStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Reveal in file manager
            </button>
          )}
          <button
            role="menuitem"
            className="pi-ws-menu-item"
            onClick={() => { setMenuForId(null); onDelete(menuWorkspace); }}
            style={{ ...menuItemStyle, color: "#ef4444", borderBottom: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#ef4444"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Remove workspace
          </button>
        </div>
      )}

      {/* Confirm removal of a missing workspace */}
      {confirmWorkspace && (
        <ConfirmInline
          title={`Remove "${confirmWorkspace.name}"?`}
          message={`The directory ${confirmWorkspace.path} no longer exists. Remove this workspace entry?`}
          confirmLabel="Remove"
          onConfirm={() => {
            const ws = confirmWorkspace;
            setConfirmRemoveMissingId(null);
            onDelete(ws);
          }}
          onCancel={() => setConfirmRemoveMissingId(null)}
        />
      )}
    </div>
  );
}

// Helper: compute the pixel offset for the drag insertion indicator.
// Reads current row rects from the ref map; falls back to 0 if a row isn't
// measured yet.
function computeIndicatorOffset(
  dropIndex: number,
  workspaces: Workspace[],
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>,
): number {
  if (dropIndex <= 0) return 0;
  if (dropIndex >= workspaces.length) {
    const last = rowRefs.current.get(workspaces[workspaces.length - 1].id);
    return last ? last.offsetTop + last.offsetHeight + 1 : 0;
  }
  const target = rowRefs.current.get(workspaces[dropIndex].id);
  return target ? target.offsetTop - 1 : 0;
}

// Tiny inline confirm used for "remove missing workspace". Kept local to avoid
// pulling the full ConfirmDialog into a tight list row; the trigger is always
// a user click on the missing badge so we don't need a modal backdrop.
function ConfirmInline({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 400,
          background: "rgba(0,0,0,0.42)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 401,
          width: "min(380px, calc(100vw - 32px))",
          padding: "18px 20px 16px",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 6, overflowWrap: "anywhere" }}>
          {message}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "6px 12px",
              background: "var(--bg-hover)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-muted)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "6px 14px",
              background: "#ef4444",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}