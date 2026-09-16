const BUILD_CACHE_DEFAULT = "10GB";
const BUILD_CACHE_LIMIT = /^\d+(\.\d+)?(B|KB|MB|GB)$/i;

function repositoryOf(reference: string): string | null {
  const image = reference.trim();
  const lastSlash = image.lastIndexOf("/");
  const lastColon = image.lastIndexOf(":");
  if (!image || lastColon <= lastSlash) return null;
  const repository = image.slice(0, lastColon);
  const tag = image.slice(lastColon + 1);
  if (!repository || !tag || repository === "<none>" || tag === "<none>") return null;
  return repository;
}

export function collectableImages(input: { repositories: Iterable<string>; tags: Iterable<string>; kept: Iterable<string>; inUse: Iterable<string> }): string[] {
  const repositories = new Set([...input.repositories].map((repository) => repository.trim()).filter(Boolean));
  const kept = new Set([...input.kept].map((image) => image.trim()));
  const inUse = new Set([...input.inUse].map((image) => image.trim()));
  const collectable = new Set<string>();
  for (const tag of input.tags) {
    const image = tag.trim();
    if (repositories.has(repositoryOf(image) ?? "") && !kept.has(image) && !inUse.has(image)) collectable.add(image);
  }
  return [...collectable];
}

export function imageRepository(reference: string): string | null {
  return repositoryOf(reference);
}

export function buildCacheLimit(value: string | undefined): string {
  const limit = value?.trim();
  return limit && BUILD_CACHE_LIMIT.test(limit) ? limit : BUILD_CACHE_DEFAULT;
}
