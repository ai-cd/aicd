/**
 * Utility helpers for Sealos-related naming conventions.
 *
 * The heavy lifting (K8s manifests, deploy, DB creation) is now handled
 * by @ai-cd/sealos-skills — see lib/k8s.ts for the adapter.
 */

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}
