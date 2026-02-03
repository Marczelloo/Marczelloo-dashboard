import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    devSkipPin: process.env.DEV_SKIP_PIN === "true",
  });
}
