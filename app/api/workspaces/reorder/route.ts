import { NextResponse } from "next/server";
import { reorderWorkspaces } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

// POST /api/workspaces/reorder  body: { ids: string[] }
// Persists the given order (any not-listed workspaces keep their relative
// position at the end). Returns the updated full list.
export async function POST(req: Request) {
  try {
    const body = await req.json() as { ids?: unknown };
    if (!Array.isArray(body.ids) || !body.ids.every((id): id is string => typeof id === "string")) {
      return NextResponse.json({ error: "ids must be a string array" }, { status: 400 });
    }
    const data = await reorderWorkspaces(body.ids);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}