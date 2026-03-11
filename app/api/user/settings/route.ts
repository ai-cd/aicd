import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { kubeconfig } = await req.json();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { kubeconfig }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[/api/user/settings]", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
