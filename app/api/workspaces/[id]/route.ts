import { NextResponse } from "next/server";
import { deleteWorkspace, updateWorkspace } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

// PATCH /api/workspaces/[id]  body: { name?, path?, setActive? }
// Allows renaming, changing the path (must exist), and/or activating the
// workspace. Setting setActive updates lastOpened for sorting.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      name?: string;
      path?: string;
      setActive?: boolean;
    };
    const updated = await updateWorkspace(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json({ workspace: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/workspaces/[id]
// Removes the workspace entry from the list. Does NOT touch the filesystem.
// If the deleted workspace was active, the next workspace (if any) becomes
// active automatically.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ok = await deleteWorkspace(id);
    if (!ok) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}