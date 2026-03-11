import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGitHubAccessToken } from "@/lib/github";
import { autoAnalyzeAndPush } from "@/lib/auto-docker";

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

  const token = await getGitHubAccessToken(session.user.id);
  if (!token) {
    return NextResponse.json(
      { error: "GitHub access token missing" },
      { status: 401 }
    );
  }

  try {
    const result = await autoAnalyzeAndPush(
      token,
      session.user.id,
      project.repoOwner,
      project.repoName
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[/api/projects/[id]/auto-docker]", error);
    const msg = error?.message ?? "Failed to generate Docker assets";
    const status = msg.includes("token missing") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
