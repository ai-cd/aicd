import Link from "next/link";
import SiteHeader from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "GitHub 权限绑定",
    desc: "授权访问私有仓库，安全读取代码结构。"
  },
  {
    title: "AI 环境分析",
    desc: "自动识别运行时、端口、依赖与数据库需求。"
  },
  {
    title: "Sealos 原生部署",
    desc: "依据模板启动容器、数据库与 Ingress。"
  }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background grid-shell">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
              AICD · GitHub → Sealos
            </p>
            <h1 className="text-5xl font-display leading-[0.95]">
              把任意 GitHub 项目
              <br />
              在 Sealos 上一键启动
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              连接代码仓库，让 AI 解析运行环境与依赖，再由 Sealos 完成容器、数据库、
              Ingress 的全流程部署。
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild className="h-12 px-8">
                <Link href="/auth/signin">连接 GitHub</Link>
              </Button>
              <Button asChild variant="secondary" className="h-12 px-8">
                <Link href="/app">进入控制台</Link>
              </Button>
            </div>
          </div>
          <div className="sharp-panel p-6">
            <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
              部署概览
            </h2>
            <div className="mt-6 space-y-4 text-sm">
              <div className="border border-foreground p-4">
                <p className="font-medium">1. 授权 GitHub</p>
                <p className="text-muted-foreground">读取仓库结构，尊重权限范围。</p>
              </div>
              <div className="border border-foreground p-4">
                <p className="font-medium">2. AI 分析仓库</p>
                <p className="text-muted-foreground">生成运行时、端口与依赖清单。</p>
              </div>
              <div className="border border-foreground p-4">
                <p className="font-medium">3. Sealos 上线</p>
                <p className="text-muted-foreground">容器、数据库、Ingress 自动就绪。</p>
              </div>
            </div>
          </div>
        </section>
        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {features.map((item) => (
            <Card key={item.title} className="border-foreground">
              <CardHeader>
                <CardTitle className="font-display text-2xl">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                {item.desc}
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
