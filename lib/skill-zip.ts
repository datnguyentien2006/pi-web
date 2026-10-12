import AdmZip from "adm-zip";
import path from "path";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

// Caps to defuse malicious / accidental zip bombs.
const MAX_TOTAL_UNCOMPRESSED = 50 * 1024 * 1024; // 50 MB across all entries
const MAX_ENTRIES = 2000;
const MAX_SINGLE_FILE = 10 * 1024 * 1024; // 10 MB per file

export interface ZipEntry {
  /** Zip-relative path, forward slashes, normalized (no leading slash). */
  entryPath: string;
  isDirectory: boolean;
  data: Buffer;
}

export interface ParseSkillZipResult {
  /** Name parsed from SKILL.md frontmatter (the skill folder name). */
  name: string;
  /** The SKILL.md zip-relative path. */
  skillMdPath: string;
  /**
   * Common prefix to strip when writing — the folder inside the zip that
   * directly contains SKILL.md. "" if SKILL.md is at the zip root.
   */
  rootPrefix: string;
  entries: ZipEntry[];
}

function normalizeEntryPath(p: string): string {
  // adm-zip returns backslash paths on some archives; normalize to "/".
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

// Reject path-traversal entries (absolute, drive-prefixed, or ../ segments)
// before they ever reach the filesystem. We check each path SEGMENT for ".."
// — path.normalize() would fold a leading "../" away, hiding it, so we cannot
// rely on the normalized result containing "..".
export function isTraversalEntry(entryPath: string): boolean {
  if (entryPath === "") return false;
  // Check drive / UNC / posix-absolute on the RAW path BEFORE normalizing —
  // normalizeEntryPath strips leading slashes, which would hide "//unc/...".
  if (/^[a-zA-Z]:[\\/]/.test(entryPath) || /^[\\/]{2}/.test(entryPath)) return true;
  const normalized = normalizeEntryPath(entryPath);
  // Any segment that is exactly ".." escapes the root.
  const segments = normalized.split("/");
  if (segments.some((seg) => seg === "..")) return true;
  return false;
}

// Read + sanitize a zip buffer into a validated entry list.
export function readZipEntries(buf: Buffer): ZipEntry[] {
  const zip = new AdmZip(buf);
  const rawEntries = zip.getEntries();
  if (rawEntries.length === 0) throw new Error("Archive is empty");
  if (rawEntries.length > MAX_ENTRIES) {
    throw new Error(`Too many entries in archive (${rawEntries.length}, limit ${MAX_ENTRIES})`);
  }

  let total = 0;
  const entries: ZipEntry[] = [];
  for (const e of rawEntries) {
    const entryPath = normalizeEntryPath(e.entryName);
    if (isTraversalEntry(entryPath)) {
      throw new Error(`Archive contains an unsafe path: ${entryPath}`);
    }
    const isDirectory = e.isDirectory || entryPath.endsWith("/");
    if (isDirectory) {
      entries.push({ entryPath: entryPath.replace(/\/+$/, ""), isDirectory: true, data: Buffer.alloc(0) });
      continue;
    }
    const data = e.getData();
    total += data.length;
    if (total > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error(`Total uncompressed size exceeds limit (${MAX_TOTAL_UNCOMPRESSED} bytes)`);
    }
    if (data.length > MAX_SINGLE_FILE) {
      throw new Error(`Single file too large: ${entryPath} (${data.length} bytes)`);
    }
    entries.push({ entryPath, isDirectory: false, data });
  }
  return entries;
}

const SKILL_MD = "SKILL.md";

// Locate SKILL.md: either at the zip root, or inside a single top-level
// subdirectory. Returns the parse result with the root prefix to strip.
export function parseSkillZip(entries: ZipEntry[]): ParseSkillZipResult {
  const files = entries.filter((e) => !e.isDirectory);
  if (files.length === 0) throw new Error("Archive contains no files");

  // Case A: SKILL.md at zip root.
  const rootSkill = files.find((f) => f.entryPath === SKILL_MD || f.entryPath.toUpperCase() === SKILL_MD);
  if (rootSkill) {
    const name = readSkillName(rootSkill.data);
    return { name, skillMdPath: rootSkill.entryPath, rootPrefix: "", entries };
  }

  // Case B: SKILL.md inside a single top-level dir. Collect distinct
  // top-level prefixes and require there to be exactly one (so we don't
  // silently grab one skill out of a multi-skill archive).
  const topLevel = new Set<string>();
  for (const f of files) {
    const idx = f.entryPath.indexOf("/");
    topLevel.add(idx === -1 ? f.entryPath : f.entryPath.slice(0, idx));
  }
  // A proper single-skill zip has exactly one top-level folder.
  if (topLevel.size !== 1) {
    throw new Error("SKILL.md not found: the archive must contain SKILL.md directly, or contain exactly one skill directory (with SKILL.md inside it)");
  }
  const rootPrefix = [...topLevel][0];
  const nested = files.find(
    (f) => f.entryPath === `${rootPrefix}/${SKILL_MD}` || f.entryPath.toUpperCase() === `${rootPrefix}/${SKILL_MD}`.toUpperCase(),
  );
  if (!nested) {
    throw new Error(`SKILL.md not found under ${rootPrefix}/`);
  }
  const name = readSkillName(nested.data) || rootPrefix;
  return { name, skillMdPath: nested.entryPath, rootPrefix, entries };
}

// Pull the `name` field out of SKILL.md frontmatter. parseFrontmatter comes
// from the pi SDK and returns { frontmatter, body }; fall back gracefully if
// the shape differs across SDK versions.
function readSkillName(skillMdData: Buffer): string {
  const text = skillMdData.toString("utf-8");
  try {
    const result = parseFrontmatter(text) as {
      frontmatter?: { name?: unknown };
      name?: unknown;
    };
    const fm = (result.frontmatter ?? result) as { name?: unknown };
    const name = typeof fm?.name === "string" ? fm.name.trim() : "";
    if (name) return name;
  } catch {
    // malformed frontmatter — let caller decide
  }
  throw new Error("SKILL.md is missing a valid name field (frontmatter must contain name)");
}

export { readSkillName };