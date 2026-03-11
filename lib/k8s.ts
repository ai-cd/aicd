import fs from "node:fs";
import path from "node:path";
import {
  KubeConfig,
  KubernetesObjectApi,
  KubernetesObject,
  HttpError
} from "@kubernetes/client-node";

export function getKubeClient(kubeconfigString?: string) {
  const kc = new KubeConfig();
  if (kubeconfigString) {
    kc.loadFromString(kubeconfigString);
  } else {
    const kubePath = path.join(process.cwd(), ".secret/kubeconfig");
    if (fs.existsSync(kubePath)) {
      kc.loadFromFile(kubePath);
    } else {
      kc.loadFromDefault();
    }
  }
  return KubernetesObjectApi.makeApiClient(kc);
}

export async function applyManifests(manifests: KubernetesObject[], kubeconfigString?: string) {
  const client = getKubeClient(kubeconfigString);
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
    } catch (error: any) {
      const httpError = error as HttpError & { body?: any };
      if (httpError?.statusCode === 409) {
        try {
          // You could also add logging here for replace if needed
          await client.replace(manifest);
          results.push({
            kind: manifest.kind,
            name: manifest.metadata?.name,
            status: "replaced"
          });
        } catch (replaceErr: any) {
          console.error(`Failed to replace ${manifest.kind}/${manifest.metadata?.name}:`, replaceErr);
          if (replaceErr.body) {
            console.error("K8s API Replace Error Body:", JSON.stringify(replaceErr.body, null, 2));
          }
          results.push({
            kind: manifest.kind,
            name: manifest.metadata?.name,
            status: "failed"
          });
        }
      } else {
        console.error(`Failed to create ${manifest.kind}/${manifest.metadata?.name}:`, error);
        if (httpError?.body) {
          console.error("K8s API Create Error Body:", JSON.stringify(httpError.body, null, 2));
        }
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
