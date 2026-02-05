import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";

export async function GET() {
  return NextResponse.json({ demoMode: isDemoMode() });
}
