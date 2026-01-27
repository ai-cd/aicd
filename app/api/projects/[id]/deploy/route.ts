import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildDatabaseManifests,
  buildRuntimeManifests,
  serializeManifests
} from "@/lib/sealos";
import { applyManifests } from "@/lib/k8s";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = Boolean(body?.dryRun);

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { analysis: true }
  });

  if (!project || !project.analysis) {
    return NextResponse.json({ error: "Missing analysis" }, { status: 400 });
  }

  const ports = project.analysis.ports
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => !Number.isNaN(value));

  const runtime = await buildRuntimeManifests({
    projectName: project.name,
    baseImage: project.analysis.baseImage,
    ports: ports.length > 0 ? ports : [3000]
  });

  const manifests = [...runtime.manifests];
  let databaseName: string | null = null;

  if (project.analysis.needsDatabase) {
    const database = await buildDatabaseManifests(project.name);
    databaseName = database.dbName;
    manifests.push(...database.manifests);
  }

  if (dryRun) {
    return NextResponse.json({
      manifests: serializeManifests(manifests),
      runtimeName: runtime.runtimeName,
      ingressDomain: runtime.ingressDomain,
      databaseName
    });
  }

  const results = await applyManifests(manifests as any);
  const status = results.some((item) => item.status === "failed")
    ? "failed"
    : "applied";

  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      status,
      runtimeName: runtime.runtimeName,
      ingressDomain: runtime.ingressDomain,
      databaseName,
      log: JSON.stringify(results)
    }
  });

  return NextResponse.json({ deployment, results });
}
