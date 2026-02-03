import { NextResponse } from "next/server";

export async function POST() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json({
      success: false,
      error: "DISCORD_WEBHOOK_URL not configured",
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [
          {
            title: "🔔 Test Notification",
            description: "This is a test notification from Marczelloo Dashboard.",
            color: 0xdc2626, // Red color
            timestamp: new Date().toISOString(),
            footer: {
              text: "Marczelloo Dashboard Dashboard",
            },
          },
        ],
      }),
    });

    if (response.ok || response.status === 204) {
      return NextResponse.json({ success: true });
    } else {
      const error = await response.text();
      return NextResponse.json({
        success: false,
        error: `Discord returned ${response.status}: ${error}`,
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to send notification",
    });
  }
}
