"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProjectCreateForm({
  onCreated
}: {
  onCreated?: () => void;
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [mode, setMode] = useState<"url" | "pick">("url");
  const [repos, setRepos] = useState<Array<{ full_name: string; html_url: string }>>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function loadRepos() {
      setLoadingRepos(true);
      try {
        const response = await fetch("/api/github/repos");
        if (response.status === 401) {
          // Token expired / bad credentials — force re-sign-in
          window.location.href = "/auth/signin";
          return;
        }
        if (!response.ok) {
          throw new Error("failed");
        }
        const data = await response.json();
        if (active) {
          setRepos(data.repos ?? []);
        }
      } catch (err) {
        if (active) {
          setRepos([]);
        }
      } finally {
        if (active) {
          setLoadingRepos(false);
        }
      }
    }
    loadRepos();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl })
      });

      if (response.status === 401) {
        window.location.href = "/auth/signin";
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create project");
      }

      setRepoUrl("");
      onCreated?.();
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "创建失败，请检查 GitHub 地址或权限");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>选择方式</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "url" ? "default" : "outline"}
            onClick={() => setMode("url")}
          >
            手动输入
          </Button>
          <Button
            type="button"
            variant={mode === "pick" ? "default" : "outline"}
            onClick={() => setMode("pick")}
          >
            从 GitHub 选择
          </Button>
        </div>
      </div>
      {mode === "url" ? (
        <div className="space-y-2">
          <Label htmlFor="repoUrl">GitHub 仓库地址</Label>
          <Input
            id="repoUrl"
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            required
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="repoPick">选择仓库</Label>
          <select
            id="repoPick"
            className="h-11 w-full border border-foreground bg-background px-3 text-sm"
            disabled={loadingRepos || repos.length === 0}
            onChange={(event) => setRepoUrl(event.target.value)}
            required
          >
            <option value="">
              {loadingRepos
                ? "加载中..."
                : repos.length === 0
                ? "未获取到仓库"
                : "请选择仓库"}
            </option>
            {repos.map((repo) => (
              <option key={repo.full_name} value={repo.html_url}>
                {repo.full_name}
              </option>
            ))}
          </select>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "正在创建..." : "创建 Project"}
      </Button>
    </form>
  );
}
