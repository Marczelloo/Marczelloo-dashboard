import { NextRequest, NextResponse } from "next/server";

// GET - Get runner blocklist
export async function GET() {
  const runnerUrl = process.env.RUNNER_URL || "http://127.0.0.1:8787";
  const runnerToken = process.env.RUNNER_TOKEN;

  if (!runnerToken) {
    return NextResponse.json(
      {
        success: false,
        error: "RUNNER_TOKEN not configured",
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${runnerUrl}/blocklist`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${runnerToken}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ success: true, blocklist: data.blocklist, allowlist: data.blocklist }); // allowlist for backward compatibility
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Runner returned ${response.status}`,
        },
        { status: response.status }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 500 }
    );
  }
}

// PUT - Update runner blocklist
export async function PUT(request: NextRequest) {
  const runnerUrl = process.env.RUNNER_URL || "http://127.0.0.1:8787";
  const runnerToken = process.env.RUNNER_TOKEN;

  if (!runnerToken) {
    return NextResponse.json(
      {
        success: false,
        error: "RUNNER_TOKEN not configured",
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    const response = await fetch(`${runnerUrl}/blocklist`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${runnerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ blocklist: body.blocklist || body.allowlist }), // Support both for compatibility
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ success: true, blocklist: data.blocklist, allowlist: data.blocklist });
    } else {
      const error = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: error.error || `Runner returned ${response.status}`,
        },
        { status: response.status }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 500 }
    );
  }
}
