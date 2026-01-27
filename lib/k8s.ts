import fs from "node:fs";
import path from "node:path";
import {
  KubeConfig,
  KubernetesObjectApi,
  KubernetesObject,
  HttpError
} from "@kubernetes/client-node";

export function getKubeClient() {
  const kc = new KubeConfig();
  const kubePath = path.join(process.cwd(), ".secret/kubeconfig");
  if (fs.existsSync(kubePath)) {
    kc.loadFromFile(kubePath);
  } else {
    kc.loadFromDefault();
  }
  return KubernetesObjectApi.makeApiClient(kc);
}

export async function applyManifests(manifests: KubernetesObject[]) {
  const client = getKubeClient();
  const results: Array<{ kind?: string; name?: string; status: string }> = [];

  for (const manifest of manifests) {
    if (!manifest || !manifest.kind || !manifest.metadata?.name) {
      continue;
    }

    try {
      await client.create(manifest);
      results.push({
        kind: manifest.kind,
        name: manifest.metadata?.name,
        status: "created"
      });
    } catch (error) {
      const httpError = error as HttpError;
      if (httpError?.statusCode === 409) {
        await client.replace(manifest);
        results.push({
          kind: manifest.kind,
          name: manifest.metadata?.name,
          status: "replaced"
        });
      } else {
        results.push({
          kind: manifest.kind,
          name: manifest.metadata?.name,
          status: "failed"
        });
      }
    }
  }

  return results;
}
