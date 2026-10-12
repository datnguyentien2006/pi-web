"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal xác nhận đơn giản, có sẵn animation + escape key + click backdrop.
 * Dùng cho delete nhiều session, xoá worktree, v.v.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Đóng bằng Escape (chỉ khi không busy)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const accent = variant === "danger" ? "#ef4444" : "var(--accent)";
  const accentHover = variant === "danger" ? "#dc2626" : "var(--accent-hover)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!busy) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(31, 30, 29, 0.45)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "pi-confirm-fade-in 0.14s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          maxWidth: 420,
          width: "100%",
          padding: "20px 20px 16px",
          animation: "pi-confirm-pop-in 0.18s ease-out",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 650,
            color: "var(--text)",
            marginBottom: description ? 8 : 16,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.55,
              marginBottom: 16,
            }}
          >
            {description}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              height: 34,
              padding: "0 14px",
              background: "var(--bg-hover)",
              border: "1px solid var(--border)",
              borderRadius: 7,
              color: "var(--text-muted)",
              fontSize: 13,
              fontWeight: 500,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.5 : 1,
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              e.currentTarget.style.background = "var(--bg-selected)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              height: 34,
              padding: "0 14px",
              background: accent,
              border: "none",
              borderRadius: 7,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              e.currentTarget.style.background = accentHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = accent;
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>

      {/* Keyframes cục bộ — inject 1 lần, tên có tiền tố pi- để tránh trùng */}
      <style>{`
        @keyframes pi-confirm-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pi-confirm-pop-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}