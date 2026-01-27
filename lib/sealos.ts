import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";

const ROOT = process.cwd();

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

export function generateRuntimeName(projectName: string) {
  const slug = slugify(projectName) || "project";
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `${slug}-agentruntime-${rand}`;
}

export async function loadYamlDocuments(filePath: string) {
  const content = await fs.readFile(filePath, "utf8");
  return yaml.parseAllDocuments(content).map((doc) => doc.toJSON());
}

export async function buildRuntimeManifests(options: {
  projectName: string;
  baseImage: string;
  ports: number[];
  domain?: string;
}) {
  const runtimeName = generateRuntimeName(options.projectName);
  const serviceName = `${runtimeName}-service`;

  const statefulsetDocs = await loadYamlDocuments(
    path.join(ROOT, "yaml/sandbox/statefulset.yaml")
  );
  const serviceDocs = await loadYamlDocuments(
    path.join(ROOT, "yaml/sandbox/service.yaml")
  );
  const ingressDocs = await loadYamlDocuments(
    path.join(ROOT, "yaml/sandbox/ingress.yaml")
  );
  const terminalDocs = await loadYamlDocuments(
    path.join(ROOT, "yaml/sandbox/terminal_ws.yaml")
  );

  const [statefulset] = statefulsetDocs;
  statefulset.metadata.name = runtimeName;
  statefulset.metadata.labels.app = runtimeName;
  statefulset.metadata.labels["cloud.sealos.io/app-deploy-manager"] = runtimeName;
  statefulset.spec.selector.matchLabels.app = runtimeName;
  statefulset.spec.serviceName = serviceName;
  statefulset.spec.template.metadata.labels.app = runtimeName;
  statefulset.spec.template.metadata.labels.restartTime = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  statefulset.spec.template.spec.containers[0].image = options.baseImage;

  const [service] = serviceDocs;
  service.metadata.name = serviceName;
  service.metadata.labels["cloud.sealos.io/app-deploy-manager"] = runtimeName;
  service.spec.selector.app = runtimeName;
  service.spec.ports = options.ports.map((port, index) => ({
    port,
    targetPort: port,
    name: `port-${index + 1}`,
    protocol: "TCP"
  }));

  const domainSuffix = process.env.SEALOS_DOMAIN_SUFFIX ?? "usw.sealos.io";
  const domain = options.domain ?? `${slugify(options.projectName)}.${domainSuffix}`;

  const ingress = ingressDocs[0];
  ingress.metadata.name = `network-${runtimeName}`;
  ingress.metadata.labels["cloud.sealos.io/app-deploy-manager"] = runtimeName;
  ingress.metadata.labels["cloud.sealos.io/app-deploy-manager-domain"] = slugify(
    options.projectName
  );
  ingress.spec.rules[0].host = domain;
  ingress.spec.rules[0].http.paths[0].backend.service.name = serviceName;
  ingress.spec.rules[0].http.paths[0].backend.service.port.number =
    options.ports[0];
  ingress.spec.tls[0].hosts = [domain];

  const terminal = terminalDocs[0];
  terminal.metadata.name = `network-ttyd-${runtimeName}`;
  terminal.metadata.labels["cloud.sealos.io/app-deploy-manager-domain"] =
    `${slugify(options.projectName)}-ttyd`;

  return {
    runtimeName,
    ingressDomain: domain,
    manifests: [statefulset, service, ingress, terminal]
  };
}

export async function buildDatabaseManifests(projectName: string) {
  const dbName = `${slugify(projectName)}-db`;
  const accountDocs = await loadYamlDocuments(
    path.join(ROOT, "yaml/database/account.yaml")
  );
  const clusterDocs = await loadYamlDocuments(
    path.join(ROOT, "yaml/database/cluster.yaml")
  );

  for (const doc of accountDocs) {
    doc.metadata.name = dbName;
    doc.metadata.labels["sealos-db-provider-cr"] = dbName;
    doc.metadata.labels["app.kubernetes.io/instance"] = dbName;
    if (doc.kind === "RoleBinding") {
      doc.roleRef.name = dbName;
      doc.subjects[0].name = dbName;
    }
  }

  const [cluster] = clusterDocs;
  cluster.metadata.name = dbName;
  cluster.metadata.labels["sealos-db-provider-cr"] = dbName;
  cluster.spec.componentSpecs[0].serviceAccountName = dbName;

  return { dbName, manifests: [...accountDocs, cluster] };
}

export function serializeManifests(manifests: unknown[]) {
  return manifests.map((doc) => yaml.stringify(doc)).join("---\n");
}
