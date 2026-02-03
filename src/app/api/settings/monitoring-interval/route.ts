import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Store interval in memory (in production, this would be in database or config file)
// We'll also update the scheduler when this changes
let currentInterval = parseInt(process.env.MONITORING_INTERVAL_MS || "300000", 10);

// GET - Get current monitoring interval
export async function GET() {
  return NextResponse.json({
    success: true,
    interval_ms: currentInterval,
    interval_minutes: Math.round(currentInterval / 60000),
  });
}

// PUT - Update monitoring interval
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const newInterval = body.interval_ms;

    if (!newInterval || typeof newInterval !== "number" || newInterval < 60000) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid interval. Minimum is 60000ms (1 minute)",
        },
        { status: 400 }
      );
    }

    if (newInterval > 3600000) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid interval. Maximum is 3600000ms (1 hour)",
        },
        { status: 400 }
      );
    }

    currentInterval = newInterval;

    // Note: To persist this, you would need to:
    // 1. Store in AtlasHub database (settings table)
    // 2. Or update environment variable and restart
    // For now, it only persists until server restart

    // Trigger revalidation of monitoring page
    revalidatePath("/monitoring");
    revalidatePath("/settings");

    return NextResponse.json({
      success: true,
      interval_ms: currentInterval,
      interval_minutes: Math.round(currentInterval / 60000),
      note: "Interval updated. Restart server for changes to take full effect.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update interval",
      },
      { status: 500 }
    );
  }
}
