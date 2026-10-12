import { NextResponse } from "next/server";
import { createWorkspace, listWorkspaces } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

// GET /api/workspaces
// Returns { version, activeWorkspaceId, workspaces: [...] }.
// No auto-migration: on first run, the file doesn't exist and this returns
// an empty list. The client shows an empty state and prompts the user to add
// their first workspace.
export async function GET() {
  try {
    const data = await listWorkspaces();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST /api/workspaces  body: { name: string; path: string }
// Validates the path exists, canonicalizes it, refuses duplicates, then
// persists. The first created workspace becomes active automatically.
export async function POST(req: Request) {
  try {
    const body = await req.json() as { name?: string; path?: string };
    if (typeof body.name !== "string" || typeof body.path !== "string") {
      return NextResponse.json(
        { error: "name and path are required" },
        { status: 400 },
      );
    }
    const ws = await createWorkspace(body.name, body.path);
    return NextResponse.json({ workspace: ws });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}