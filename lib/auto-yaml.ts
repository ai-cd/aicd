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

type PackageJson = {
  scripts?: { start?: string };
  packageManager?: string;
};

const UTF8_ENCODING = "utf8";
const BASE64_ENCODING = "base64";
const GITHUB_API = "https://api.github.com";
const MAX_RETRY = 2;

const getHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "User-Agent": "aicd-sealos-automation",
});

async function fetchWithRetry(
  url: string,
  options: { token?: string; method?: string; body?: any },
  retry = 0
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers: getHeaders(options.token || ""),
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store" as RequestCache,
    });

    clearTimeout(timeout);

    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
      throw new Error("GitHub API rate limit exceeded");
    }

    if (res.status >= 500 && retry < MAX_RETRY) {
      await new Promise((r) => setTimeout(r, 1000 * (retry + 1)));
      return fetchWithRetry(url, options, retry + 1);
    }

    return res;
  } catch (e) {
    if (retry < MAX_RETRY) {
      await new Promise((r) => setTimeout(r, 1000 * (retry + 1)));
      return fetchWithRetry(url, options, retry + 1);
    }
    throw e;
  }
}

function safeBase64Encode(content: string): string {
  try {
    return Buffer.from(content, UTF8_ENCODING).toString(BASE64_ENCODING);
  } catch (error) {
    const clean = content
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/[^\x00-\xFF]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
    return Buffer.from(clean, UTF8_ENCODING).toString(BASE64_ENCODING);
  }
}

async function getRepositoryFiles(token: string, owner: string, repo: string, branch: string): Promise<string[]> {
  try {
    const shaRes = await fetchWithRetry(
      `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      { token }
    );
    const shaData = await shaRes.json();
    const commitSha = shaData.object?.sha;
    if (!commitSha) return [];

    const tree = await fetchWithRetry(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`,
      { token }
    );
    const treeData = await tree.json();
    if (treeData.truncated) throw new Error("Repository tree too large");
    return (treeData.tree || []).map((f: any) => f.path);
  } catch {
    return [];
  }
}

async function getPackageJson(token: string, owner: string, repo: string, branch: string): Promise<PackageJson | null> {
  try {
    const res = await fetchWithRetry(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/package.json?ref=${branch}`,
      { token }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const decoded = Buffer.from(data.content || "", "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function hasFile(files: string[], pattern: RegExp): boolean {
  return files.some((f) => pattern.test(f));
}

function detectPackageManager(files: string[], pkg?: PackageJson | null) {
  if (hasFile(files, /pnpm-lock\.yaml$/i) || pkg?.packageManager?.startsWith("pnpm")) {
    return { install: "pnpm install --frozen-lockfile", start: "pnpm start", build: "pnpm build" };
  }
  if (hasFile(files, /yarn\.lock$/i) || pkg?.packageManager?.startsWith("yarn")) {
    return { install: "yarn install --frozen-lockfile", start: "yarn start", build: "yarn build" };
  }
  return { install: "npm ci", start: "npm start", build: "npm run build" };
}

function getSmartConfig(techStack?: string[], files: string[] = [], pkg?: PackageJson | null): TechStackConfig {
  const stack = (techStack || []).map((s) => s.toLowerCase());

  if (stack.some((s) => s.includes("python")) || hasFile(files, /requirements\.txt$/i)) {
    return { baseImage: "python:3.11-slim", installCmd: "pip install --no-cache-dir -r requirements.txt", startCmd: "python app.py", port: 8000 };
  }
  if (stack.some((s) => s.includes("java")) || stack.some((s) => s.includes("spring")) || hasFile(files, /pom\.xml$/i)) {
    return { baseImage: "openjdk:17-slim", installCmd: "./mvnw clean package -DskipTests", startCmd: "java -jar target/*.jar", port: 8080 };
  }
  if (stack.some((s) => s.includes("go")) || hasFile(files, /go\.mod$/i)) {
    return { baseImage: "golang:1.21-alpine", installCmd: "go mod download", startCmd: "go run main.go", port: 8080 };
  }
  if (stack.some((s) => s.includes("rust")) || hasFile(files, /Cargo\.toml$/i)) {
    return { baseImage: "rust:1.74-slim", installCmd: "cargo build --release", startCmd: "./target/release/app", port: 8080 };
  }
  if (hasFile(files, /package\.json$/i)) {
    const pm = detectPackageManager(files, pkg);
    const start = pkg?.scripts?.start ? pm.start : "npm start";
    return { baseImage: "node:20-alpine", installCmd: pm.install, startCmd: start, port: 3000, buildCmd: pm.build };
  }

  return { baseImage: "node:20-alpine", installCmd: "npm install --production", startCmd: "npm start", port: 3000 };
}

function buildSealosYaml(repo: string, result: AnalyzeResult, files: string[], pkg?: PackageJson | null): string {
  const cfg = getSmartConfig(result.techStack, files, pkg);
  const port = result.ports?.[0] ?? cfg.port;
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
    ${cfg.buildCmd || ""}
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
  healthCheck:
    type: http
    path: /
    port: ${port}`;
}

async function checkSealosExists(token: string, owner: string, repo: string): Promise<boolean> {
  try {
    const res = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/contents/sealos.yaml`, { token });
    return res.ok;
  } catch {
    return false;
  }
}

async function getDefaultBranch(token: string, owner: string, repo: string): Promise<string> {
  const res = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}`, { token });
  if (!res.ok) throw new Error("Failed to fetch repo");
  const data = await res.json();
  return data.default_branch || "main";
}

async function getBranchSha(token: string, owner: string, repo: string, branch: string): Promise<string> {
  const res = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`, { token });
  if (!res.ok) throw new Error("Branch not found");
  const data = await res.json();
  return data.object?.sha;
}

export async function autoAnalyzeAndPushSealos(
  token: string,
  userId: string,
  owner: string,
  repo: string
): Promise<{ message?: string; prUrl?: string; error?: string }> {
  try {
    const baseBranch = await getDefaultBranch(token, owner, repo);
    if (await checkSealosExists(token, owner, repo)) {
      return { message: "sealos.yaml already exists, skipped" };
    }

    const files = await getRepositoryFiles(token, owner, repo, baseBranch);
    const pkg = await getPackageJson(token, owner, repo, baseBranch);
    const readme = await getRepoReadme(userId, owner, repo);

    let aiResult: AnalyzeResult = {};
    try {
      const aiRes = await analyzeRepository({ files: files.slice(0, 300), readme: (readme || "").slice(0, 4000) });
      aiResult = aiRes.result as AnalyzeResult;
    } catch (err) {
      console.warn("AI analysis failed, using local detection");
    }

    const yaml = buildSealosYaml(repo, aiResult, files, pkg);
    const baseSha = await getBranchSha(token, owner, repo, baseBranch);
    const branchName = `sealos-auto-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

    await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
      token,
      method: "POST",
      body: { ref: `refs/heads/${branchName}`, sha: baseSha },
    });

    await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/contents/sealos.yaml`, {
      token,
      method: "PUT",
      body: {
        message: "auto-generate sealos.yaml",
        content: safeBase64Encode(yaml),
        branch: branchName,
      },
    });

    const prRes = await fetchWithRetry(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, {
      token,
      method: "POST",
      body: {
        title: "Auto-generate Sealos config",
        head: branchName,
        base: baseBranch,
      },
    });

    const prData = await prRes.json();
    return { message: "Success", prUrl: prData.html_url };
  } catch (error: any) {
    console.error("ERROR:", error);
    return { error: error.message || "Unknown error" };
  }
}
