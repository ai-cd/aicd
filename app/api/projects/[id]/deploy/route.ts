import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createSkillsForUser } from "@/lib/k8s";
import { slugify } from "@/lib/sealos";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { analysis: true, user: true }
  });

  if (!project || !project.analysis) {
    return NextResponse.json({ error: "Missing analysis" }, { status: 400 });
  }

  if (!project.user.kubeconfig) {
    return NextResponse.json(
      { error: "Kubeconfig not configured — please paste your Sealos kubeconfig in the console first." },
      { status: 400 }
    );
  }

  // ---- Derive deploy parameters from the AI analysis ----
  const ports = project.analysis.ports
    .split(",")
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((v) => !Number.isNaN(v));
  const mainPort = ports[0] || 3000;

  const domainSuffix = process.env.SEALOS_DOMAIN_SUFFIX ?? "usw.sealos.io";
  const appName = slugify(project.name) || "project";
  const domain = `${appName}.${domainSuffix}`;

  // ---- Create a per-request Skills instance from the user's kubeconfig ----
  const skills = createSkillsForUser(project.user.kubeconfig);
  const results: Array<{ step: string; success: boolean; message: string; data?: any }> = [];

  // 1. Deploy the container (Deployment + Service + Ingress)
  try {
    const deployResult = await skills.deploy({
      name: appName,
      image: project.analysis.baseImage,
      port: mainPort,
      enableIngress: project.analysis.needsIngress,
      domain,
      envVars: (project.analysis.envVars as Record<string, string>) ?? undefined
    });
    results.push({ step: "deploy", ...deployResult });
  } catch (error: any) {
    console.error("[deploy] Skills deploy error:", error);
    results.push({ step: "deploy", success: false, message: error?.message ?? "Unknown error" });
  }

  // 2. Optionally create a database
  let databaseName: string | null = null;
  if (project.analysis.needsDatabase) {
    databaseName = `${appName}-db`;
    try {
      const dbResult = await skills.createDB({
        name: databaseName,
        type: "postgresql"
      });
      results.push({ step: "database", ...dbResult });
    } catch (error: any) {
      console.error("[deploy] Skills createDB error:", error);
      results.push({ step: "database", success: false, message: error?.message ?? "Unknown error" });
    }
  }

  // ---- Persist deployment record ----
  const allSucceeded = results.every((r) => r.success);
  const status = allSucceeded ? "applied" : "failed";

  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      status,
      runtimeName: appName,
      ingressDomain: domain,
      databaseName,
      log: JSON.stringify(results)
    }
  });

  return NextResponse.json({ deployment, results });
}
