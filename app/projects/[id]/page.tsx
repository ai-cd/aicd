import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SiteHeader from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectActions from "@/components/project-actions";

export default async function ProjectPage({
  params
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { analysis: true, deployments: { orderBy: { createdAt: "desc" } } }
  });

  if (!project) {
    notFound();
  }

  const analysis = project.analysis;
  const latestDeployment = project.deployments[0];

  return (
    <div className="min-h-screen bg-background grid-shell">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
              Project Detail
            </p>
            <h1 className="text-4xl font-display">{project.name}</h1>
            <p className="text-muted-foreground">
              {project.repoOwner}/{project.repoName}
            </p>
          </div>
          <Badge>{project.visibility}</Badge>
        </div>

        <Card className="border-foreground">
          <CardHeader>
            <CardTitle>部署操作</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectActions projectId={project.id} />
          </CardContent>
        </Card>

        <Tabs defaultValue="analysis">
          <TabsList>
            <TabsTrigger value="analysis">分析结果</TabsTrigger>
            <TabsTrigger value="deployments">部署记录</TabsTrigger>
            <TabsTrigger value="repo">仓库信息</TabsTrigger>
          </TabsList>
          <TabsContent value="analysis">
            <Card className="border-foreground">
              <CardContent className="space-y-4">
                {analysis ? (
                  <div className="grid gap-4 md:grid-cols-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">运行时</p>
                      <p className="font-medium">{analysis.runtime}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">基础镜像</p>
                      <p className="font-medium">{analysis.baseImage}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">安装命令</p>
                      <p className="font-medium">{analysis.installCmd}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">启动命令</p>
                      <p className="font-medium">{analysis.startCmd}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">端口</p>
                      <p className="font-medium">{analysis.ports}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">数据库</p>
                      <p className="font-medium">
                        {analysis.needsDatabase ? "需要" : "不需要"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">尚未运行分析</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="deployments">
            <div className="space-y-4">
              {project.deployments.length === 0 ? (
                <p className="text-muted-foreground">暂无部署记录</p>
              ) : (
                project.deployments.map((deployment) => (
                  <Card key={deployment.id} className="border-foreground">
                    <CardContent className="space-y-2 text-sm">
                      <p className="font-medium">状态: {deployment.status}</p>
                      <p className="text-muted-foreground">
                        运行时: {deployment.runtimeName}
                      </p>
                      {deployment.ingressDomain ? (
                        <p>访问地址: {deployment.ingressDomain}</p>
                      ) : null}
                      {deployment.databaseName ? (
                        <p>数据库: {deployment.databaseName}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          <TabsContent value="repo">
            <Card className="border-foreground">
              <CardContent className="space-y-3 text-sm">
                <p>
                  默认分支: <span className="font-medium">{project.defaultBranch}</span>
                </p>
                <p>
                  仓库地址:{" "}
                  <Link className="underline" href={project.repoUrl} target="_blank">
                    {project.repoUrl}
                  </Link>
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {latestDeployment?.ingressDomain ? (
          <Card className="border-foreground">
            <CardHeader>
              <CardTitle>最新部署</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                访问地址: <span className="font-medium">{latestDeployment.ingressDomain}</span>
              </p>
              <p className="text-muted-foreground">
                状态: {latestDeployment.status}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
