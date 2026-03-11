/**
 * Thin adapter over @ai-cd/sealos-skills.
 *
 * All Kubernetes interactions now go through the Skills SDK.
 * This file only re-exports the helpers IntelliDeploy needs.
 */

import {
  SealosSkills,
  createK8sClientFromString,
  type DeployContainerParams,
  type CreateDatabaseParams,
  type SkillResult
} from "@ai-cd/sealos-skills";

export type { DeployContainerParams, CreateDatabaseParams, SkillResult };

/**
 * Create a `SealosSkills` instance bound to a particular user's kubeconfig.
 * Every HTTP request should create its own instance — no global singleton.
 */
export function createSkillsForUser(kubeconfigString: string) {
  return new SealosSkills({ kubeconfigString });
}

/**
 * Validate that a kubeconfig string can be loaded and a namespace extracted.
 * Returns the namespace on success, or throws on failure.
 */
export function validateKubeconfig(kubeconfigString: string): string {
  const client = createK8sClientFromString(kubeconfigString);
  return client.getNamespace();
}
