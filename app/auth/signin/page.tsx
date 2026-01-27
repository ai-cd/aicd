"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignIn() {
  return (
    <div className="min-h-screen bg-background grid-shell">
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Card className="w-full border-foreground">
          <CardHeader>
            <CardTitle className="font-display text-3xl">Sign in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              使用 GitHub 授权以读取你的仓库并在 Sealos 部署。
            </p>
            <Button className="w-full" onClick={() => signIn("github")}> 
              Continue with GitHub
            </Button>
            <div className="text-xs text-muted-foreground">
              返回首页 <Link href="/" className="underline">AICD</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
