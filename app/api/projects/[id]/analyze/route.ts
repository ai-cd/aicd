import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRepoContents, getRepoReadme } from "@/lib/github";
import { analyzeRepository } from "@/lib/ai";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: session.user.id }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const contents = await getRepoContents(
      session.user.id,
      project.repoOwner,
      project.repoName
    );
    const readme = await getRepoReadme(
      session.user.id,
      project.repoOwner,
      project.repoName
    );

    const signal = {
      files: contents.map((item) => item.name),
      readme: readme?.slice(0, 4000)
    };

    const { result, raw } = await analyzeRepository(signal);

    const analysis = await prisma.analysis.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        runtime: result.runtime,
        baseImage: result.baseImage,
        installCmd: result.installCmd,
        startCmd: result.startCmd,
        ports: result.ports.join(","),
        needsDatabase: result.needsDatabase,
        needsIngress: result.needsIngress,
        envVars: result.envVars,
        rawResponse: raw ?? result
      },
      update: {
        runtime: result.runtime,
        baseImage: result.baseImage,
        installCmd: result.installCmd,
        startCmd: result.startCmd,
        ports: result.ports.join(","),
        needsDatabase: result.needsDatabase,
        needsIngress: result.needsIngress,
        envVars: result.envVars,
        rawResponse: raw ?? result
      }
    });

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error("[/api/projects/[id]/analyze]", error);
    const msg = error?.message ?? "Analysis failed";
    const status = msg.includes("token missing") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
