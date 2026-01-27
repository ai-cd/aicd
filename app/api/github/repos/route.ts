import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listGitHubRepos } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repos = await listGitHubRepos(session.user.id);
    return NextResponse.json({ repos });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}
