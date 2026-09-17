export interface PublishedPort {
  container: string;
  hostPort: number;
}

/**
 * First free candidate: the preferred port, then 3000–3999. A port published
 * by a container of the same Compose project is reusable on redeploy.
 */
export function pickDeploymentPort(preferredPort: number, published: PublishedPort[], ownContainers: string[]): number {
  const own = new Set(ownContainers);
  const taken = new Set(published.filter((binding) => !own.has(binding.container)).map((binding) => binding.hostPort));
  const candidates = [preferredPort, ...Array.from({ length: 1000 }, (_, index) => 3000 + index)];
  const port = candidates.find((candidate) => !taken.has(candidate));
  if (port === undefined) throw new Error("Nie znaleziono wolnego portu w zakresie 3000-3999.");
  return port;
}

export function portUsedByOthers(port: number, published: PublishedPort[], ownContainers: string[]): boolean {
  const own = new Set(ownContainers);
  return published.some((binding) => binding.hostPort === port && !own.has(binding.container));
}
