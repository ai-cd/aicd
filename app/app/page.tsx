import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SiteHeader from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProjectCreateForm from "@/components/project-create-form";
import KubeconfigForm from "@/components/kubeconfig-form";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { kubeconfig: true }
  });

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: { analysis: true, deployments: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="min-h-screen bg-background grid-shell">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            <h1 className="text-4xl font-display">项目控制台</h1>
            <p className="text-muted-foreground">
              创建 Project，连接 GitHub 仓库并在 Sealos 上部署。
            </p>

            <Card className="border-foreground/50 bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">集群凭证</CardTitle>
              </CardHeader>
              <CardContent>
                <KubeconfigForm hasKubeconfig={!!user?.kubeconfig} />
              </CardContent>
            </Card>

            <Card className="border-foreground">
              <CardHeader>
                <CardTitle>新建 Project</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectCreateForm />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display">我的 Projects</h2>
              <Badge>{projects.length} ACTIVE</Badge>
            </div>
            <div className="space-y-4">
              {projects.map((project) => {
                const latestDeployment = project.deployments[0];
                return (
                  <Card key={project.id} className="border-foreground">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{project.name}</span>
                        <Badge>{project.visibility}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="text-muted-foreground">
                        {project.repoOwner}/{project.repoName}
                      </p>
                      {project.analysis ? (
                        <p>
                          运行时: <span className="font-medium">{project.analysis.runtime}</span>
                        </p>
                      ) : (
                        <p className="text-muted-foreground">尚未分析</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          部署状态: {latestDeployment?.status ?? "未部署"}
                        </span>
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-sm underline"
                        >
                          查看详情
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
