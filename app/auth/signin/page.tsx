"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <Card className="w-full border-foreground">
      <CardHeader>
        <CardTitle className="font-display text-3xl">Sign in / Sign up</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          使用 GitHub 授权以读取你的仓库并在 Sealos 部署。（注册与登录共用此按钮）
        </p>
        
        {error === "OAuthAccountNotLinked" && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            登录失败：该邮箱已存在，但未关联 GitHub 账号。请联系管理员或使用其他账号。
          </div>
        )}
        {error && error !== "OAuthAccountNotLinked" && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            登录失败 ({error})，请重试。
          </div>
        )}

        <Button className="w-full" onClick={() => signIn("github", { callbackUrl: "/app" })}> 
          Continue with GitHub
        </Button>
        <div className="text-xs text-muted-foreground">
          返回首页 <Link href="/" className="underline">AICD</Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignIn() {
  return (
    <div className="min-h-screen bg-background grid-shell">
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <Suspense fallback={<div>Loading...</div>}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
