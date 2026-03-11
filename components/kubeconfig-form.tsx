"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function KubeconfigForm({
  hasKubeconfig
}: {
  hasKubeconfig: boolean;
}) {
  const [kubeconfig, setKubeconfig] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kubeconfig.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kubeconfig })
      });
      if (res.ok) {
        setKubeconfig("");
        router.refresh();
      } else {
        alert("保存失败");
      }
    } catch {
      alert("保存时发生网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>
          Sealos Kubeconfig 
          {hasKubeconfig ? (
            <span className="ml-2 text-green-600 text-xs">✓ 已配置</span>
          ) : (
            <span className="ml-2 text-destructive text-xs">未配置</span>
          )}
        </Label>
        <Textarea
          placeholder="粘贴您的 ~/.kube/config 或 Sealos Kubeconfig 内容"
          value={kubeconfig}
          onChange={(e) => setKubeconfig(e.target.value)}
          className="min-h-[120px] font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          {hasKubeconfig
            ? "重新粘贴以覆盖现有的 Kubeconfig"
            : "您必须提供有效的 kubeconfig 才能部署服务。此文件应由 Sealos 云控制台生成。"}
        </p>
      </div>
      <Button type="submit" disabled={loading || !kubeconfig.trim()} size="sm">
        {loading ? "保存中..." : "保存 Kubeconfig"}
      </Button>
    </form>
  );
}
