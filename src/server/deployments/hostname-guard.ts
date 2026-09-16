export interface HostnameOwner {
  projectId: string;
  projectName: string;
  hostname: string;
}

export interface HostnameGuardInput {
  projectId: string;
  hostname: string;
  /** Hostnames the project already publishes (its config and prod_url); re-saving them is not a takeover. */
  ownedHostnames: string[];
  owners: HostnameOwner[];
  routes: Array<{ hostname: string; service: string }>;
}

/** A project may not take a hostname that another project or a hand-made route already serves. */
export function hostnameConflict(input: HostnameGuardInput): string | null {
  const host = input.hostname.trim().toLowerCase();
  const owner = input.owners.find((candidate) => candidate.projectId !== input.projectId && candidate.hostname.toLowerCase() === host);
  if (owner) return `Domena ${host} należy już do projektu „${owner.projectName}”.`;
  if (input.ownedHostnames.some((owned) => owned.toLowerCase() === host)) return null;
  const route = input.routes.find((candidate) => candidate.hostname.toLowerCase() === host);
  return route ? `Domena ${host} jest już wystawiona w tunelu (${route.service}). Usuń tę trasę albo wybierz inną domenę.` : null;
}
