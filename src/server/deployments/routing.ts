export function parseLocalPortFromService(service: string): number | null {
  const match = /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d{1,5})\/?$/i.exec(service.trim());
  if (!match) return null;
  const port = Number(match[1]);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

export function resolveAutoDeployBranch(
  pushBranch: string,
  configuredBranch: string | null
): { deploy: true; branch: string } | { deploy: false; reason: string } {
  if (configuredBranch) {
    return pushBranch === configuredBranch
      ? { deploy: true, branch: configuredBranch }
      : { deploy: false, reason: `Push to ${pushBranch}; only ${configuredBranch} deploys automatically.` };
  }

  return pushBranch === "main" || pushBranch === "master"
    ? { deploy: true, branch: pushBranch }
    : { deploy: false, reason: `Push to ${pushBranch}; a project without a branch set deploys main or master only.` };
}
