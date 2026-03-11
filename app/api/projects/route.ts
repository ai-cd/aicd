import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseRepoUrl } from "@/lib/project-utils";
import { getRepoMeta } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: { analysis: true, deployments: true },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const repoUrl = body?.repoUrl as string;
  if (!repoUrl) {
    return NextResponse.json({ error: "Missing repoUrl" }, { status: 400 });
  }

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid repo URL" }, { status: 400 });
  }

  const existing = await prisma.project.findFirst({
    where: { userId: session.user.id, repoUrl }
  });

  if (existing) {
    return NextResponse.json({ project: existing });
  }

  try {
    const repo = await getRepoMeta(session.user.id, parsed.owner, parsed.repo);

    const project = await prisma.project.create({
      data: {
        name: repo.name,
        repoUrl: repo.html_url,
        repoOwner: repo.owner.login,
        repoName: repo.name,
        visibility: repo.visibility ?? (repo.private ? "private" : "public"),
        defaultBranch: repo.default_branch,
        userId: session.user.id
      }
    });

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error("[/api/projects POST]", error);
    const msg = error?.message ?? "Failed to create project";
    const status = msg.includes("token missing") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
