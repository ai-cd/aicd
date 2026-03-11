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
  } catch (error: any) {
    console.error("[/api/github/repos]", error);
    const msg = error?.message ?? "Failed to fetch repos";
    const status = msg.includes("token missing") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
