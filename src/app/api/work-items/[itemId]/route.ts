import { NextRequest, NextResponse } from "next/server";
import { workItems } from "@/server/atlashub";
import { getCurrentUser } from "@/server/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { itemId } = await params;
    const workItem = await workItems.getWorkItemById(itemId);

    if (!workItem) {
      return NextResponse.json({ error: "Work item not found" }, { status: 404 });
    }

    return NextResponse.json({ workItem });
  } catch (error) {
    console.error("GET /api/work-items/[itemId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
