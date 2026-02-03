/**
 * Notification Service - Discord webhooks and email alerts
 */

import "server-only";

// ========================================
// Types
// ========================================

interface NotificationPayload {
  title: string;
  message: string;
  color?: "success" | "warning" | "danger" | "info";
  fields?: { name: string; value: string; inline?: boolean }[];
  url?: string;
}

// ========================================
// Discord
// ========================================

const DISCORD_COLORS = {
  success: 0x22c55e, // green-500
  warning: 0xeab308, // yellow-500
  danger: 0xef4444, // red-500
  info: 0x3b82f6, // blue-500
} as const;

export async function sendDiscordNotification(payload: NotificationPayload): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("DISCORD_WEBHOOK_URL not configured, skipping notification");
    return false;
  }

  try {
    const embed = {
      title: payload.title,
      description: payload.message,
      color: DISCORD_COLORS[payload.color || "info"],
      fields: payload.fields?.map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline ?? false,
      })),
      url: payload.url,
      timestamp: new Date().toISOString(),
      footer: {
        text: "Marczelloo Dashboard",
      },
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to send Discord notification:", error);
    return false;
  }
}

// ========================================
// Email (SMTP)
// ========================================

export async function sendEmailNotification(to: string, payload: NotificationPayload): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("SMTP not configured, skipping email notification");
    return false;
  }

  // Note: For actual SMTP, you'd use a library like nodemailer
  // This is a placeholder for the architecture
  console.log("Email notification would be sent to:", to, payload);

  // TODO: Implement actual SMTP sending with nodemailer
  // For now, return true to indicate the intent
  return true;
}

// ========================================
// Alert Functions
// ========================================

export async function notifyServiceDown(serviceName: string, serviceUrl: string, error: string): Promise<void> {
  await sendDiscordNotification({
    title: "🔴 Service Down",
    message: `**${serviceName}** is not responding.`,
    color: "danger",
    fields: [
      { name: "URL", value: serviceUrl, inline: true },
      { name: "Error", value: error, inline: true },
    ],
  });
}

export async function notifyServiceRecovered(
  serviceName: string,
  serviceUrl: string,
  downtimeMinutes: number
): Promise<void> {
  await sendDiscordNotification({
    title: "🟢 Service Recovered",
    message: `**${serviceName}** is back online.`,
    color: "success",
    fields: [
      { name: "URL", value: serviceUrl, inline: true },
      { name: "Downtime", value: `${downtimeMinutes} minutes`, inline: true },
    ],
  });
}

export async function notifyContainerUnhealthy(containerName: string, status: string): Promise<void> {
  await sendDiscordNotification({
    title: "⚠️ Container Unhealthy",
    message: `Container **${containerName}** is unhealthy.`,
    color: "warning",
    fields: [{ name: "Status", value: status }],
  });
}

export async function notifyDeployStarted(serviceName: string, triggeredBy: string): Promise<void> {
  await sendDiscordNotification({
    title: "🚀 Deploy Started",
    message: `Deployment for **${serviceName}** has started.`,
    color: "info",
    fields: [{ name: "Triggered by", value: triggeredBy }],
  });
}

export async function notifyDeploySuccess(serviceName: string, commitSha?: string, duration?: number): Promise<void> {
  const fields = [];
  if (commitSha) {
    fields.push({ name: "Commit", value: commitSha.substring(0, 7), inline: true });
  }
  if (duration) {
    fields.push({ name: "Duration", value: `${Math.round(duration / 1000)}s`, inline: true });
  }

  await sendDiscordNotification({
    title: "✅ Deploy Successful",
    message: `Deployment for **${serviceName}** completed successfully.`,
    color: "success",
    fields,
  });
}

export async function notifyDeployFailed(serviceName: string, error: string): Promise<void> {
  await sendDiscordNotification({
    title: "❌ Deploy Failed",
    message: `Deployment for **${serviceName}** failed.`,
    color: "danger",
    fields: [{ name: "Error", value: error }],
  });
}

export async function notifySslExpiring(serviceName: string, serviceUrl: string, daysLeft: number): Promise<void> {
  await sendDiscordNotification({
    title: "⚠️ SSL Certificate Expiring",
    message: `SSL certificate for **${serviceName}** expires in ${daysLeft} days.`,
    color: "warning",
    fields: [{ name: "URL", value: serviceUrl }],
  });
}
