"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { getFileIcon, FolderIcon } from "./FileIcons";
import { encodeFilePathForApi, getRelativeFilePath, joinFilePath } from "@/lib/file-paths";

interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
  modified: string;
}

interface FileNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  size: number;
  children?: FileNode[];
  loaded?: boolean;
}

interface Props {
  cwd: string;
  onOpenFile: (filePath: string, fileName: string) => void;
  refreshKey?: number;
  onAtMention?: (relativePath: string, isDir: boolean) => void;
  /** Full path of the file currently open in the preview (highlighted in the tree). */
  selectedPath?: string | null;
}

// ── Layout constants ─────────────────────────────────────────────────────
const INDENT = 16;        // px per nesting level (was 14)
const BASE_PAD = 10;      // left padding of depth 0 (was 8)
const ROW_HEIGHT = 28;    // row height in px (was 24)
const ICON_SIZE = 16;     // file/folder icon size (was 14)
const CHEVRON_SIZE = 12;  // chevron size (was 10)
const GAP = 6;            // gap between icon and text (was 4)

function normPath(p?: string | null): string {
  return (p ?? "").replace(/\\/g, "/");
}

async function fetchEntries(dirPath: string): Promise<FileNode[]> {
  const encoded = encodeFilePathForApi(dirPath);
  const res = await fetch(`/api/files/${encoded}?type=list`);
  if (!res.ok) {
    let message = `Failed to load files (HTTP ${res.status})`;
    try {
      const data = await res.json() as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  const data = await res.json() as { entries?: FileEntry[] };
  const sorted = [...(data.entries ?? [])].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; // folders first
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
  return sorted.map((e) => ({
    name: e.name,
    fullPath: joinFilePath(dirPath, e.name),
    isDir: e.isDir,
    size: e.size,
    children: e.isDir ? [] : undefined,
    loaded: !e.isDir,
  }));
}

function TreeNode({
  node,
  depth,
  cwd,
  onOpenFile,
  onAtMention,
  expandedPaths,
  onToggleExpanded,
  refreshKey,
  selectedPath,
}: {
  node: FileNode;
  depth: number;
  cwd: string;
  onOpenFile: (filePath: string, fileName: string) => void;
  onAtMention?: (relativePath: string, isDir: boolean) => void;
  expandedPaths: Set<string>;
  onToggleExpanded: (fullPath: string, open: boolean) => void;
  refreshKey?: number;
  selectedPath?: string | null;
}) {
  const open = expandedPaths.has(node.fullPath);
  const selected = !node.isDir && !!selectedPath && normPath(selectedPath) === normPath(node.fullPath);
  const [children, setChildren] = useState<FileNode[]>(node.children ?? []);
  const [loaded, setLoaded] = useState(node.loaded ?? false);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  const loadChildren = useCallback(async (force = false) => {
    if (loaded && !force) return;
    setLoading(true);
    try {
      const entries = await fetchEntries(node.fullPath);
      setChildren(entries);
      setLoaded(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loaded, node.fullPath]);

  // When refreshKey causes a re-render with the same node identity, reload open dirs
  const prevLoadedRef = useRef(loaded);
  useEffect(() => {
    prevLoadedRef.current = loaded;
  });

  useEffect(() => {
    if (open && loaded) {
      loadChildren(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleClick = useCallback(() => {
    if (node.isDir) {
      const next = !open;
      onToggleExpanded(node.fullPath, next);
      if (next && !loaded) loadChildren();
    } else {
      onOpenFile(node.fullPath, node.name);
    }
  }, [node.isDir, node.fullPath, node.name, loaded, open, loadChildren, onOpenFile, onToggleExpanded]);

  return (
    <div>
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: GAP,
          paddingLeft: BASE_PAD + depth * INDENT,
          paddingRight: 8,
          height: ROW_HEIGHT,
          cursor: "pointer",
          background: selected
            ? "var(--bg-selected, rgba(59,130,246,0.14))"
            : hovered ? "var(--bg-hover)" : "transparent",
          boxShadow: selected ? "inset 2px 0 0 var(--accent)" : "none",
          borderRadius: 5,
          userSelect: "none",
          transition: "background 0.1s ease",
        }}
      >
        {/* Vertical indent guides — mid-chevron position */}
        {Array.from({ length: depth }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              left: BASE_PAD + i * INDENT + 6,
              top: 0,
              bottom: 0,
              width: 1,
              background: "var(--border)",
              opacity: 0.7,
              pointerEvents: "none",
            }}
          />
        ))}

        {/* Chevron (only for directories) */}
        {node.isDir ? (
          <svg
            width={CHEVRON_SIZE}
            height={CHEVRON_SIZE}
            viewBox="0 0 12 12"
            fill="none"
            stroke={hovered || open ? "var(--text)" : "var(--text-muted)"}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              flexShrink: 0,
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform 0.15s ease, stroke 0.1s ease",
            }}
          >
            <polyline points="4 3 9 6 4 9" />
          </svg>
        ) : (
          <span style={{ width: CHEVRON_SIZE, flexShrink: 0 }} />
        )}

        {/* File / folder icon */}
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          {node.isDir ? <FolderIcon size={ICON_SIZE} open={open} /> : getFileIcon(node.name, ICON_SIZE)}
        </span>

        {/* Name */}
        <span
          style={{
            fontSize: 13.5,
            color: "var(--text)",
            fontWeight: selected ? 500 : 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            letterSpacing: "-0.005em",
          }}
          title={node.fullPath}
        >
          {node.name}
        </span>

        {loading && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
          </svg>
        )}

        {onAtMention && hovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAtMention(getRelativeFilePath(node.fullPath, cwd), node.isDir);
            }}
            title="Insert path into chat"
            style={{
              position: "absolute",
              right: !node.isDir ? 28 : 4,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "0 8px",
              height: 20,
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
            </svg>
            Mention
          </button>
        )}

        {hovered && !node.isDir && (
          <a
            href={`/api/files/${encodeFilePathForApi(node.fullPath)}?type=download`}
            download
            onClick={(e) => e.stopPropagation()}
            title="Download file"
            style={{
              position: "absolute",
              right: 4,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "0 5px",
              height: 20,
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </a>
        )}
      </div>

      {node.isDir && open && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              cwd={cwd}
              onOpenFile={onOpenFile}
              onAtMention={onAtMention}
              expandedPaths={expandedPaths}
              onToggleExpanded={onToggleExpanded}
              refreshKey={refreshKey}
              selectedPath={selectedPath}
            />
          ))}
          {children.length === 0 && loaded && (
            <div
              style={{
                paddingLeft: BASE_PAD + (depth + 1) * INDENT + CHEVRON_SIZE + GAP,
                fontSize: 12,
                color: "var(--text-dim)",
                height: ROW_HEIGHT,
                display: "flex",
                alignItems: "center",
                fontStyle: "italic",
              }}
            >
              Empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FileExplorer({ cwd, onOpenFile, refreshKey, onAtMention, selectedPath }: Props) {
  const [roots, setRoots] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const prevCwdRef = useRef<string | null>(null);

  const handleToggleExpanded = useCallback((fullPath: string, open: boolean) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (open) next.add(fullPath); else next.delete(fullPath);
      return next;
    });
  }, []);

  useEffect(() => {
    const cwdChanged = prevCwdRef.current !== cwd;
    prevCwdRef.current = cwd;

    if (cwdChanged) setExpandedPaths(new Set());

    setLoading(cwdChanged);
    setError(null);
    fetchEntries(cwd)
      .then((entries) => setRoots(entries))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [cwd, refreshKey]);

  if (loading) {
    return (
      <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)" }}>
        Loading files…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "10px 14px", fontSize: 12, color: "#f87171" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 6px" }}>
      {roots.map((node) => (
        <TreeNode
          key={node.fullPath}
          node={node}
          depth={0}
          cwd={cwd}
          onOpenFile={onOpenFile}
          onAtMention={onAtMention}
          expandedPaths={expandedPaths}
          onToggleExpanded={handleToggleExpanded}
          refreshKey={refreshKey}
          selectedPath={selectedPath}
        />
      ))}
      {roots.length === 0 && (
        <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-dim)" }}>
          No files found
        </div>
      )}
    </div>
  );
}