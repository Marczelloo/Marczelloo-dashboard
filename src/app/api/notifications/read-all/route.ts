import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/lib/auth";
import { setSetting } from "@/server/atlashub/settings";

const READ_NOTIFICATIONS_KEY = "notifications_last_read_at";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Store the current timestamp as the last read time
    const lastReadAt = new Date().toISOString();
    await setSetting(READ_NOTIFICATIONS_KEY, lastReadAt);

    return NextResponse.json({ success: true, lastReadAt });
  } catch (error) {
    console.error("POST /api/notifications/read-all error:", error);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
