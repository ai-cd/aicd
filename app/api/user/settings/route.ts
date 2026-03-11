import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateKubeconfig } from "@/lib/k8s";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { kubeconfig } = await req.json();

    if (!kubeconfig || typeof kubeconfig !== "string") {
      return NextResponse.json({ error: "kubeconfig is required" }, { status: 400 });
    }

    // Validate the kubeconfig can be parsed and a namespace resolved
    let namespace: string;
    try {
      namespace = validateKubeconfig(kubeconfig);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Kubeconfig 格式无效: ${err?.message ?? "unknown"}` },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { kubeconfig }
    });

    return NextResponse.json({ success: true, namespace });
  } catch (error: any) {
    console.error("[/api/user/settings]", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
