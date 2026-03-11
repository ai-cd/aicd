"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ProjectActions({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    runtimeName: string;
    ingressDomain?: string;
    databaseName?: string | null;
  } | null>(null);

  async function runAnalysis() {
    setLoading("analysis");
    setMessage(null);
    setPrUrl(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("analysis failed");
      }
      setMessage("分析完成，刷新页面查看结果");
    } catch (error) {
      setMessage("分析失败，请稍后重试");
    } finally {
      setLoading(null);
    }
  }

  async function deploy() {
    setLoading("deploy");
    setMessage(null);
    setPrUrl(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false })
      });
      if (!response.ok) {
        throw new Error("deploy failed");
      }
      setMessage("部署请求已发送，请稍后刷新状态");
    } catch (error) {
      setMessage("部署失败，请检查 Sealos 或 kubeconfig");
    } finally {
      setLoading(null);
    }
  }

  async function dryRun() {
    setLoading("dryrun");
    setMessage(null);
    setPrUrl(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true })
      });
      if (!response.ok) {
        throw new Error("dry run failed");
      }
      const data = await response.json();
      setPreview(data.manifests ?? "");
      setPreviewMeta({
        runtimeName: data.runtimeName,
        ingressDomain: data.ingressDomain,
        databaseName: data.databaseName
      });
    } catch (error) {
      setMessage("预览失败，请先完成分析");
    } finally {
      setLoading(null);
    }
  }

  async function autoGenerateSealosYaml() {
    setLoading("auto-yaml");
    setMessage(null);
    setPrUrl(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/auto-yaml`, {
        method: "POST"
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "auto-yaml failed");
      }
      if (data.prUrl) {
        setPrUrl(data.prUrl);
        setMessage("Sealos YAML 已生成并创建 PR！");
      } else {
        setMessage(data.message ?? "操作完成");
      }
    } catch (error: any) {
      setMessage(`生成 Sealos YAML 失败: ${error.message}`);
    } finally {
      setLoading(null);
    }
  }

  async function autoBuildDocker() {
    setLoading("auto-docker");
    setMessage(null);
    setPrUrl(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/auto-docker`, {
        method: "POST"
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "auto-docker failed");
      }
      if (data.prUrl) {
        setPrUrl(data.prUrl);
        setMessage("Dockerfile + CI 工作流已生成并创建 PR！");
      } else {
        setMessage(data.message ?? "操作完成");
      }
    } catch (error: any) {
      setMessage(`生成 Docker 配置失败: ${error.message}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button onClick={runAnalysis} disabled={loading !== null}>
          {loading === "analysis" ? "分析中..." : "重新分析"}
        </Button>
        <Button
          onClick={dryRun}
          variant="outline"
          disabled={loading !== null}
        >
          {loading === "dryrun" ? "生成中..." : "预览 YAML"}
        </Button>
        <Button
          onClick={deploy}
          variant="secondary"
          disabled={loading !== null}
        >
          {loading === "deploy" ? "部署中..." : "开始部署"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-foreground pt-3">
        <Button
          onClick={autoGenerateSealosYaml}
          variant="outline"
          disabled={loading !== null}
        >
          {loading === "auto-yaml" ? "生成中..." : "Auto Generate Sealos YAML"}
        </Button>
        <Button
          onClick={autoBuildDocker}
          variant="outline"
          disabled={loading !== null}
        >
          {loading === "auto-docker" ? "生成中..." : "Auto Build Docker Image"}
        </Button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {prUrl ? (
        <p className="text-sm">
          PR 链接:{" "}
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600"
          >
            {prUrl}
          </a>
        </p>
      ) : null}
      {preview ? (
        <div className="space-y-2 border border-foreground bg-background p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            YAML Preview
          </div>
          <div className="text-sm">
            <p>Runtime: {previewMeta?.runtimeName}</p>
            {previewMeta?.ingressDomain ? (
              <p>Ingress: {previewMeta.ingressDomain}</p>
            ) : null}
            {previewMeta?.databaseName ? (
              <p>Database: {previewMeta.databaseName}</p>
            ) : null}
          </div>
          <textarea
            readOnly
            value={preview}
            className="h-64 w-full border border-foreground bg-background p-3 font-mono text-xs"
          />
        </div>
      ) : null}
    </div>
  );
}
