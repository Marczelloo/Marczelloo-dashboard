import { NextResponse } from "next/server";
import { isPinBypassAllowed } from "@/server/lib/auth-policy";

export async function GET() {
  return NextResponse.json({ devSkipPin: isPinBypassAllowed() });
}
