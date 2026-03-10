import { analyzeRepository } from "./ai";
import { getRepoContents, getRepoReadme } from "./github";

interface TechStackConfig {
  baseImage: string;
  installCmd: string;
  startCmd: string;
  port: number;
  buildCmd?: string;
}

interface AnalyzeResult {
  baseImage?: string;
  installCmd?: string;
  startCmd?: string;
  ports?: number[];
  techStack?: string[];
  runtime?: "node" | "python" | "go" | "java" | "rust";
}

type PackageJsonShape = {
  scripts?: Record<string, string>;
  packageManager?: string;
};

const UTF8_ENCODING = "utf8" as const;
const BASE64_ENCODING = "base64" as const;
const GITHUB_API = "https://api.github.com";
const MAX_RETRY = 2;

const getHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
  "User-Agent": "aicd-sealos-automation"
});

async function fetchWithRetry(
  url: string,
  token: string,
  options: RequestInit,
  retry = 0
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...getHeaders(token), ...(options.headers || {}) },
      signal: controller.signal,
      cache: "no-store"
    });

    clearTimeout(timeout);

    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
      throw new Error("GitHub API rate limit exceeded");
    }

    if (res.status >= 500 && retry < MAX_RETRY) {
      await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
      return fetchWithRetry(url, token, options, retry + 1);
    }

    return res;
  } catch (e) {
    if (retry < MAX_RETRY) {
      await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
      return fetchWithRetry(url, token, options, retry + 1);
    }
    throw e;
  }
}

function safeBase64Encode(content: string): string {
  try {
    return Buffer.from(content, UTF8_ENCODING).toString(BASE64_ENCODING);
  } catch {
    const clean = content
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/[^\x00-\xFF]/g, c => `\\u${c.charCodeAt(0).toString(16)}`);
    return Buffer.from(clean, UTF8_ENCODING).toString(BASE64_ENCODING);
  }
}

async function getRepositoryFiles(token: string, owner: string, repo: string, branch: string) {
  try {
    const shaRes = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {});
    const shaData = await shaRes.json();
    const commitSha = shaData.object?.sha;
    if (!commitSha) return [];

    const tree = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`, token, {});
    const treeData = await tree.json();
    return (treeData.tree || []).map((f: any) => f.path);
  } catch {
    return [];
  }
}

async function getPackageJson(token: string, owner: string, repo: string, branch: string): Promise<PackageJsonShape | null> {
  try {
    const res = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/contents/package.json?ref=${branch}`, token, {});
    if (!res.ok) return null;
    const data = await res.json();
    const decoded = Buffer.from(data.content || "", BASE64_ENCODING).toString(UTF8_ENCODING);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function detectPackageManager(files: string[], pkg: PackageJsonShape | null) {
  const hasFile = (pattern: RegExp) => files.some(f => pattern.test(f));
  if (hasFile(/pnpm-lock\.yaml$/i) || pkg?.packageManager?.toLowerCase().startsWith("pnpm")) {
    return { install: "pnpm install --frozen-lockfile", start: "pnpm start", build: "pnpm build" };
  }
  if (hasFile(/yarn\.lock$/i) || pkg?.packageManager?.toLowerCase().startsWith("yarn")) {
    return { install: "yarn install --frozen-lockfile", start: "yarn start", build: "yarn build" };
  }
  return { install: "npm ci", start: "npm start", build: "npm run build" };
}

function getSmartConfig(techStack?: string[], files?: string[], pkg?: PackageJsonShape | null): TechStackConfig {
  const stack = (techStack || []).map(s => s.toLowerCase());
  const fileList = files || [];
  const hasFile = (pattern: RegExp) => fileList.some(f => pattern.test(f));

  if (stack.some(s => s.includes("python")) || hasFile(/requirements\.txt$/i)) {
    return { baseImage: "python:3.11-slim", installCmd: "pip install --no-cache-dir -r requirements.txt", startCmd: "python app.py", port: 8000 };
  }
  if (stack.some(s => s.includes("java")) || hasFile(/pom\.xml$/i)) {
    return { baseImage: "openjdk:17-slim", installCmd: "./mvnw clean package -DskipTests", startCmd: "java -jar target/*.jar", port: 8080 };
  }
  if (stack.some(s => s.includes("go")) || hasFile(/go\.mod$/i)) {
    return { baseImage: "golang:1.21-alpine", installCmd: "go mod download", startCmd: "go run main.go", port: 8080 };
  }
  if (hasFile(/package\.json$/i)) {
    const pm = detectPackageManager(fileList, pkg);
    return { baseImage: "node:20-alpine", installCmd: pm.install, startCmd: pkg?.scripts?.start ? pm.start : "npm start", port: 3000, buildCmd: pm.build };
  }
  return { baseImage: "node:20-alpine", installCmd: "npm install --production", startCmd: "npm start", port: 3000 };
}

function buildSealosYaml(repo: string, result: AnalyzeResult, files: string[], pkg: PackageJsonShape | null): string {
  const cfg = getSmartConfig(result.techStack, files, pkg);
  const port = result.ports?.[0] || cfg.port;
  const appName = repo.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "sealos-app";

  return `apiVersion: app.sealos.io/v1
kind: App
metadata:
  name: ${appName}
spec:
  image: ${result.baseImage || cfg.baseImage}
  run: |
    set -e
    ${result.installCmd || cfg.installCmd}
    ${cfg.buildCmd ? (cfg.buildCmd + " || true") : ""}
    ${result.startCmd || cfg.startCmd}
  containerPort: ${port}
  service:
    ports:
    - port: ${port}
      targetPort: ${port}
  resources:
    limits:
      cpu: 1
      memory: 1Gi
    requests:
      cpu: 0.5
      memory: 512Mi
`.trim();
}

export async function autoAnalyzeAndPushSealos(
  token: string,
  userId: string,
  owner: string,
  repo: string
): Promise<{ message?: string; prUrl?: string; error?: string }> {
  try {
    const repoInfoRes = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}`, token, {});
    if (!repoInfoRes.ok) throw new Error("Repository not found");
    const repoData = await repoInfoRes.json();
    const baseBranch = repoData.default_branch || "main";

    const checkRes = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/contents/sealos.yaml`, token, {});
    if (checkRes.ok) return { message: "Sealos YAML already exists, skipped" };

    const [files, pkg, readme] = await Promise.all([
      getRepositoryFiles(token, owner, repo, baseBranch),
      getPackageJson(token, owner, repo, baseBranch),
      getRepoReadme(userId, owner, repo)
    ]);

    let aiResult: AnalyzeResult = {};
    try {
      const aiRes = await analyzeRepository({ 
        files: files.slice(0, 300), 
        readme: (readme || "").slice(0, 4000) 
      });
      aiResult = aiRes.result as AnalyzeResult;
    } catch (e) {
      console.warn(e);
    }

    const yaml = buildSealosYaml(repo, aiResult, files, pkg);

    const shaRes = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`, token, {});
    const shaData = await shaRes.json();
    const baseSha = shaData.object?.sha;

    const branchName = `sealos-auto-${Date.now()}`;
    
    await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, token, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
    });

    await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/contents/sealos.yaml`, token, {
      method: "PUT",
      body: JSON.stringify({
        message: "chore: auto-generate sealos deployment config",
        content: safeBase64Encode(yaml),
        branch: branchName
      })
    });

    const prRes = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, token, {
      method: "POST",
      body: JSON.stringify({
        title: "Add Sealos Deployment configuration",
        head: branchName,
        base: baseBranch,
        body: "AICD has detected your project stack and generated this deployment configuration automatically."
      })
    });
    
    const prData = await prRes.json();
    return { message: "Success", prUrl: prData.html_url };

  } catch (error: any) {
    console.error(error);
    return { error: error.message };
  }
}