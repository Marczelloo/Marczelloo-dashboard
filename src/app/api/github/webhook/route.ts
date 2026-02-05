/**
 * API Route: /api/github/webhook
 * Handle incoming GitHub webhooks for auto-deploy and notifications
 *
 * IMPORTANT: This endpoint must be excluded from Cloudflare Access protection
 * to allow GitHub to send webhooks. Configure this in Cloudflare dashboard:
 * Access > Applications > [Your App] > Policies > Add bypass rule for /api/github/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, parseGitHubUrl } from "@/server/github";
import { projects, auditLogs } from "@/server/atlashub";
import { internalDeployProject } from "@/app/actions/projects";
import { sendDiscordNotification } from "@/server/notifications";
import type { GitHubPushPayload, GitHubReleasePayload, GitHubDependabotAlertPayload } from "@/types/github";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow 60 seconds for deploy trigger

export async function POST(request: NextRequest) {
  console.log("[GitHub Webhook] Request received");

  try {
    const signature = request.headers.get("x-hub-signature-256") || "";
    const event = request.headers.get("x-github-event") || "";
    const deliveryId = request.headers.get("x-github-delivery") || "";
    const userAgent = request.headers.get("user-agent") || "";

    console.log(`[GitHub Webhook] Headers - Event: ${event}, Delivery: ${deliveryId}, UA: ${userAgent}`);

    // Verify it's actually from GitHub
    if (!userAgent.startsWith("GitHub-Hookshot/")) {
      console.warn("[GitHub Webhook] Request not from GitHub (user-agent check failed)");
      return NextResponse.json({ error: "Invalid source" }, { status: 403 });
    }

    // Get raw body for signature verification
    const body = await request.text();
    console.log(`[GitHub Webhook] Body length: ${body.length} bytes`);

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(body, signature);
    if (!isValid) {
      console.error("[GitHub Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);

    console.log(`[GitHub Webhook] Received ${event} event (delivery: ${deliveryId})`);

    // Handle different event types
    switch (event) {
      case "push":
        return handlePushEvent(payload as GitHubPushPayload, deliveryId);
      case "release":
        return handleReleaseEvent(payload as GitHubReleasePayload, deliveryId);
      case "dependabot_alert":
        return handleDependabotEvent(payload as GitHubDependabotAlertPayload, deliveryId);
      case "ping":
        console.log("[GitHub Webhook] Ping received successfully");
        return NextResponse.json({ message: "pong", deliveryId });
      default:
        console.log(`[GitHub Webhook] Unhandled event type: ${event}`);
        return NextResponse.json({ message: "Event not handled", event });
    }
  } catch (error) {
    console.error("[GitHub Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

/**
 * Handle push events - trigger auto-deploy if configured
 */
async function handlePushEvent(payload: GitHubPushPayload, deliveryId: string) {
  const { repository, ref, commits, head_commit, pusher, compare } = payload;
  const branch = ref.replace("refs/heads/", "");
  const repoFullName = repository.full_name;

  console.log(`[GitHub Webhook] Push to ${repoFullName}:${branch} by ${pusher.name}`);

  // Find projects linked to this repository
  const projectsWithGitHub = await findProjectsByGitHubUrl(repository.html_url);

  if (projectsWithGitHub.length === 0) {
    console.log(`[GitHub Webhook] No projects linked to ${repoFullName}`);
    return NextResponse.json({
      message: "No linked projects",
      repository: repoFullName,
    });
  }

  const results: Array<{
    projectId: string;
    projectName: string;
    deployed: boolean;
    reason?: string;
  }> = [];

  for (const project of projectsWithGitHub) {
    // Check if this branch should trigger deploy
    // For now, deploy on push to default branch (main/master)
    const shouldDeploy = branch === "main" || branch === "master";

    if (!shouldDeploy) {
      results.push({
        projectId: project.id,
        projectName: project.name,
        deployed: false,
        reason: `Branch ${branch} not configured for auto-deploy`,
      });
      continue;
    }

    try {
      // Log the webhook trigger
      await auditLogs.createAuditLog({
        actor_email: pusher.email || "github-webhook",
        action: "github_webhook_trigger",
        entity_type: "project",
        entity_id: project.id,
        meta_json: {
          event: "push",
          branch,
          commits: commits.length,
          headCommit: head_commit?.id.slice(0, 8),
          message: head_commit?.message.split("\n")[0],
          pusher: pusher.name,
          compare,
          deliveryId,
        },
      });

      // Trigger deploy using internal function (no PIN required after webhook signature verification)
      console.log(`[GitHub Webhook] Triggering deploy for ${project.name}`);
      const deployResult = await internalDeployProject(project.id, "github-webhook", { branch });

      // Log the deploy action
      await auditLogs.createAuditLog({
        actor_email: "github-webhook",
        action: "github_deploy",
        entity_type: "project",
        entity_id: project.id,
        meta_json: {
          triggeredBy: "push",
          branch,
          commit: head_commit?.id.slice(0, 8),
          success: deployResult.success,
          error: deployResult.error,
        },
      });

      // Send Discord notification
      if (deployResult.success) {
        await sendDiscordNotification({
          title: `🚀 Auto-Deploy Started: ${project.name}`,
          message: `Triggered by push to \`${branch}\``,
          color: "success",
          fields: [
            { name: "Commit", value: head_commit?.id.slice(0, 8) || "unknown" },
            { name: "Message", value: head_commit?.message.split("\n")[0] || "No message" },
            { name: "Author", value: pusher.name },
          ],
          url: compare,
        });
      }

      results.push({
        projectId: project.id,
        projectName: project.name,
        deployed: deployResult.success,
        reason: deployResult.error,
      });
    } catch (error) {
      console.error(`[GitHub Webhook] Deploy failed for ${project.name}:`, error);
      results.push({
        projectId: project.id,
        projectName: project.name,
        deployed: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    message: "Push event processed",
    repository: repoFullName,
    branch,
    results,
  });
}

/**
 * Handle release events - notify about new releases
 */
async function handleReleaseEvent(payload: GitHubReleasePayload, deliveryId: string) {
  const { action, release, repository } = payload;

  if (action !== "published") {
    return NextResponse.json({ message: "Release action not handled", action });
  }

  if (!repository) {
    return NextResponse.json({ message: "No repository in payload" });
  }

  console.log(`[GitHub Webhook] Release ${release.tag_name} published for ${repository.full_name}`);

  // Find linked projects
  const projectsWithGitHub = await findProjectsByGitHubUrl(repository.html_url);

  for (const project of projectsWithGitHub) {
    // Log the release event
    await auditLogs.createAuditLog({
      actor_email: "github-webhook",
      action: "github_webhook_trigger",
      entity_type: "project",
      entity_id: project.id,
      meta_json: {
        event: "release",
        tag: release.tag_name,
        name: release.name,
        prerelease: release.prerelease,
        author: release.author.login,
        deliveryId,
      },
    });

    // Send Discord notification about the release
    await sendDiscordNotification({
      title: `🏷️ New Release: ${project.name}`,
      message: release.name || release.tag_name,
      color: "info",
      fields: [
        { name: "Version", value: release.tag_name },
        { name: "Type", value: release.prerelease ? "Pre-release" : "Release" },
        { name: "Author", value: release.author.login },
      ],
      url: release.html_url,
    });
  }

  return NextResponse.json({
    message: "Release event processed",
    repository: repository.full_name,
    tag: release.tag_name,
    projectsNotified: projectsWithGitHub.length,
  });
}

/**
 * Handle Dependabot alert events - notify about security issues
 */
async function handleDependabotEvent(payload: GitHubDependabotAlertPayload, deliveryId: string) {
  const { action, alert, repository } = payload;

  if (action !== "created") {
    return NextResponse.json({ message: "Alert action not handled", action });
  }

  console.log(`[GitHub Webhook] Security alert for ${repository?.full_name}: ${alert.security_advisory.summary}`);

  // Find linked projects
  const projectsWithGitHub = repository ? await findProjectsByGitHubUrl(repository.html_url) : [];

  for (const project of projectsWithGitHub) {
    // Log the security alert
    await auditLogs.createAuditLog({
      actor_email: "github-webhook",
      action: "github_webhook_trigger",
      entity_type: "project",
      entity_id: project.id,
      meta_json: {
        event: "dependabot_alert",
        severity: alert.security_vulnerability.severity,
        package: alert.dependency.package.name,
        ecosystem: alert.dependency.package.ecosystem,
        ghsaId: alert.security_advisory.ghsa_id,
        deliveryId,
      },
    });

    // Send Discord notification about critical/high severity alerts
    if (alert.security_vulnerability.severity === "critical" || alert.security_vulnerability.severity === "high") {
      await sendDiscordNotification({
        title: `🔴 Security Alert: ${project.name}`,
        message: alert.security_advisory.summary,
        color: "danger",
        fields: [
          { name: "Severity", value: alert.security_vulnerability.severity.toUpperCase() },
          { name: "Package", value: `${alert.dependency.package.ecosystem}/${alert.dependency.package.name}` },
          { name: "GHSA ID", value: alert.security_advisory.ghsa_id },
        ],
        url: alert.html_url,
      });
    }
  }

  return NextResponse.json({
    message: "Dependabot alert processed",
    repository: repository?.full_name || "unknown",
    severity: alert.security_vulnerability.severity,
    projectsNotified: projectsWithGitHub.length,
  });
}

/**
 * Find projects that have a github_url matching the repository URL
 */
async function findProjectsByGitHubUrl(repoUrl: string) {
  try {
    // Get all projects and filter by github_url
    const allProjects = await projects.getProjects();

    // Parse the incoming repo URL
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) return [];

    const normalizedUrl = `${parsed.owner}/${parsed.repo}`.toLowerCase();

    return allProjects.filter((project) => {
      if (!project.github_url) return false;

      const projectParsed = parseGitHubUrl(project.github_url);
      if (!projectParsed) return false;

      const projectNormalized = `${projectParsed.owner}/${projectParsed.repo}`.toLowerCase();
      return projectNormalized === normalizedUrl;
    });
  } catch (error) {
    console.error("[GitHub Webhook] Failed to find projects:", error);
    return [];
  }
}
