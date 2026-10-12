import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, join } from "path";
import { promisify } from "util";
import { fileURLToPath, pathToFileURL } from "url";
import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { resolveSessionPath } from "@/lib/session-reader";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PiCodingAgentModule = {
  getPackageDir: () => string;
};

type ExportHtmlModule = {
  exportFromFile: (inputPath: string, outputPath: string) => Promise<string>;
};

async function getPiPackageDir(): Promise<string | null> {
  try {
    const { getPackageDir } = (await import(
      "@earendil-works/pi-coding-agent"
    )) as PiCodingAgentModule;
    return getPackageDir();
  } catch {
    return null;
  }
}

async function getPiCliPath(): Promise<string | null> {
  const candidates = new Set<string>();
  const packageDir = await getPiPackageDir();

  if (packageDir) {
    candidates.add(join(packageDir, "dist", "cli.js"));
  }

  try {
    const resolver = (
      import.meta as ImportMeta & {
        resolve?: (specifier: string) => string | Promise<string>;
      }
    ).resolve;
    if (typeof resolver === "function") {
      const indexUrl = await resolver("@earendil-works/pi-coding-agent");
      candidates.add(join(dirname(fileURLToPath(indexUrl)), "cli.js"));
    }
  } catch {
    // Next.js production bundles can strip import.meta.resolve.
  }

  candidates.add(
    join(
      process.cwd(),
      "node_modules",
      "@earendil-works",
      "pi-coding-agent",
      "dist",
      "cli.js"
    )
  );

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Patch recursive helpers in the exported HTML into iterative equivalents.
 * See app/api/sessions/[id]/export/route.ts for the full rationale.
 * Duplicated here so batch export stays independent of the single-export route.
 */
function patchExportHtml(html: string): string {
  const n = (s: string) => s.replace(/\r\n/g, "\n");
  html = n(html);

  const replaceRequired = (
    source: string,
    name: string,
    search: string,
    replacement: string
  ) => {
    const normalizedSearch = n(search);
    const normalizedReplacement = n(replacement);
    const matches = source.split(normalizedSearch).length - 1;
    if (matches !== 1) {
      throw new Error(
        `Failed to patch exported HTML: ${name} expected 1 match, found ${matches}`
      );
    }
    return source.replace(normalizedSearch, normalizedReplacement);
  };

  html = replaceRequired(
    html,
    "sortChildren",
    `        function sortChildren(node) {
          node.children.sort((a, b) =>
            new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime()
          );
          node.children.forEach(sortChildren);
        }`,
    `        function sortChildren(root) {
          const stack = [root];
          while (stack.length) {
            const node = stack.pop();
            node.children.sort((a, b) =>
              new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime()
            );
            for (let i = node.children.length - 1; i >= 0; i--) {
              stack.push(node.children[i]);
            }
          }
        }`
  );

  html = replaceRequired(
    html,
    "mapNodes",
    `          function mapNodes(node) {
            treeNodeMap.set(node.entry.id, node);
            node.children.forEach(mapNodes);
          }
          tree.forEach(mapNodes);`,
    `          const stack = [...tree].reverse();
          while (stack.length) {
            const node = stack.pop();
            treeNodeMap.set(node.entry.id, node);
            for (let i = node.children.length - 1; i >= 0; i--) {
              stack.push(node.children[i]);
            }
          }`
  );

  html = replaceRequired(
    html,
    "markActive",
    `        function markActive(node) {
          let has = activePathIds.has(node.entry.id);
          for (const child of node.children) {
            if (markActive(child)) has = true;
          }
          containsActive.set(node, has);
          return has;
        }`,
    `        function markActive(root) {
          // Post-order traversal using two stacks
          const stack1 = [root];
          const stack2 = [];
          while (stack1.length) {
            const node = stack1.pop();
            stack2.push(node);
            for (const child of node.children) {
              stack1.push(child);
            }
          }
          while (stack2.length) {
            const node = stack2.pop();
            let has = activePathIds.has(node.entry.id);
            for (const child of node.children) {
              if (containsActive.get(child)) has = true;
            }
            containsActive.set(node, has);
          }
        }`
  );

  return html;
}

async function exportSessionToFile(
  filePath: string,
  outputPath: string
): Promise<void> {
  const cliPath = await getPiCliPath();
  if (cliPath) {
    await execFileAsync(
      process.execPath,
      [cliPath, "--export", filePath, outputPath],
      {
        cwd: process.cwd(),
        timeout: 30_000,
        env: {
          ...process.env,
          PI_OFFLINE: "1",
          PI_SKIP_VERSION_CHECK: "1",
        },
        maxBuffer: 1024 * 1024,
      }
    );
    return;
  }

  const packageDir = await getPiPackageDir();
  if (!packageDir) throw new Error("pi CLI not found");

  const exporterUrl = pathToFileURL(
    join(packageDir, "dist", "core", "export-html", "index.js")
  ).href;
  const { exportFromFile } = (await import(exporterUrl)) as ExportHtmlModule;
  await exportFromFile(filePath, outputPath);
}

interface BatchExportBody {
  sessionIds?: unknown;
}

export async function POST(req: Request) {
  let body: BatchExportBody;
  try {
    body = (await req.json()) as BatchExportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray(body.sessionIds)
    ? body.sessionIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "sessionIds is required and must be a non-empty array" },
      { status: 400 }
    );
  }

  if (ids.length > 100) {
    return NextResponse.json(
      { error: "Cannot export more than 100 sessions at once" },
      { status: 400 }
    );
  }

  const tempDir = join(tmpdir(), `pi-web-export-batch-${randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    const zip = new AdmZip();
    const errors: string[] = [];
    let exportedCount = 0;

    for (const id of ids) {
      try {
        const sessionPath = await resolveSessionPath(id);
        if (!sessionPath) {
          errors.push(`${id}: session not found`);
          continue;
        }

        const sessionBase = basename(sessionPath, ".jsonl");
        const outputFile = join(tempDir, `${sessionBase}.html`);
        await exportSessionToFile(sessionPath, outputFile);

        const html = readFileSync(outputFile, "utf8");
        const patched = patchExportHtml(html);
        zip.addFile(`${sessionBase}.html`, Buffer.from(patched, "utf8"));
        exportedCount++;
      } catch (e) {
        errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (exportedCount === 0) {
      return NextResponse.json(
        {
          error: "No sessions could be exported",
          details: errors,
        },
        { status: 500 }
      );
    }

    const zipBuffer = zip.toBuffer();
    const fileName = `pi-sessions-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}