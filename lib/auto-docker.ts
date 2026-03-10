import { analyzeRepository, type AnalysisResult } from "./ai";

type GitHubRepoMeta = {
  default_branch: string;
};

type GitHubRef = {
  object?: {
    sha?: string;
  };
};

type GitHubCommit = {
  tree?: {
    sha?: string;
  };
};

type GitHubTreeEntry = {
  path: string;
  type: "blob" | "tree" | "commit";
};

type GitHubTree = {
  truncated?: boolean;
  tree?: GitHubTreeEntry[];
};

type GitHubContentFile = {
  sha: string;
  content?: string;
  encoding?: string;
};

type PackageJsonShape = {
  scripts?: Record<string, string>;
  packageManager?: string;
};

type CommitFilePayload = {
  path: string;
  content: string;
  message: string;
};

type DockerGenerationContext = {
  analysis: AnalysisResult;
  files: string[];
  packageJson: PackageJsonShape | null;
};

const GITHUB_API_BASE = "https://api.github.com";

function createGitHubHeaders(token: string, extraHeaders?: HeadersInit): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "aicd-auto-docker",
    ...extraHeaders
  };
}

async function githubRequest<T>(
  token: string,
  path: string,
  init?: RequestInit,
  options?: { allow404?: boolean }
): Promise<T | null> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: createGitHubHeaders(token, init?.headers),
    cache: "no-store"
  });

  if (options?.allow404 && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API request failed (${response.status}) for ${path}: ${errorBody}`);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as T;
}

function safeDecodeBase64(content?: string, encoding?: string) {
  if (!content || encoding !== "base64") {
    return null;
  }

  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

function uniquePaths(paths: string[]) {
  return Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
}

function hasFile(files: string[], matcher: RegExp) {
  return files.some((file) => matcher.test(file));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectPackageManager(files: string[], packageJson: PackageJsonShape | null) {
  const packageManagerField = packageJson?.packageManager?.toLowerCase() ?? "";

  if (packageManagerField.startsWith("pnpm") || hasFile(files, /(^|\/)pnpm-lock\.yaml$/i)) {
    return {
      installCmd: "pnpm install --frozen-lockfile",
      startCmd: "pnpm start",
      buildCmd: "pnpm run build",
      manifestFiles: ["package.json", "pnpm-lock.yaml"]
    };
  }

  if (packageManagerField.startsWith("yarn") || hasFile(files, /(^|\/)yarn\.lock$/i)) {
    return {
      installCmd: "yarn install --frozen-lockfile",
      startCmd: "yarn start",
      buildCmd: "yarn build",
      manifestFiles: ["package.json", "yarn.lock"]
    };
  }

  if (hasFile(files, /(^|\/)package-lock\.json$/i) || hasFile(files, /(^|\/)npm-shrinkwrap\.json$/i)) {
    return {
      installCmd: "npm ci",
      startCmd: "npm run start",
      buildCmd: "npm run build",
      manifestFiles: ["package.json", "package-lock.json", "npm-shrinkwrap.json"]
    };
  }

  return {
    installCmd: "npm install",
    startCmd: "npm run start",
    buildCmd: "npm run build",
    manifestFiles: ["package.json"]
  };
}

function normalizeStartCommand(command: string) {
  return command.trim().replace(/\s+/g, " ");
}

function parseCommandToJsonArray(command: string) {
  const normalized = normalizeStartCommand(command);
  const tokens = normalized.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [normalized];
  const cleanedTokens = tokens.map((token) => token.replace(/^['"]|['"]$/g, ""));
  return JSON.stringify(cleanedTokens);
}

function inferNodePlan(context: DockerGenerationContext) {
  const { analysis, files, packageJson } = context;
  const packageManager = detectPackageManager(files, packageJson);
  const scripts = packageJson?.scripts ?? {};
  const hasBuildScript = typeof scripts.build === "string" && scripts.build.trim().length > 0;
  const hasStartScript = typeof scripts.start === "string" && scripts.start.trim().length > 0;

  return {
    baseImage: analysis.baseImage || "node:20-alpine",
    installCmd: packageManager.installCmd,
    buildCmd: hasBuildScript ? packageManager.buildCmd : null,
    startCmd: hasStartScript ? packageManager.startCmd : analysis.startCmd,
    ports: analysis.ports.length > 0 ? analysis.ports : [3000],
    manifestFiles: packageManager.manifestFiles
  };
}

function inferPythonInstallCommand(files: string[]) {
  if (hasFile(files, /(^|\/)requirements\.txt$/i)) {
    return "pip install --no-cache-dir -r requirements.txt";
  }

  if (hasFile(files, /(^|\/)pyproject\.toml$/i)) {
    return "pip install --no-cache-dir .";
  }

  return "pip install --no-cache-dir -r requirements.txt";
}

function buildDockerfile(context: DockerGenerationContext) {
  const { analysis, files } = context;

  if (analysis.runtime === "node") {
    const nodePlan = inferNodePlan(context);
    const manifestFiles = nodePlan.manifestFiles
      .filter((file) => hasFile(files, new RegExp(`(^|/)${escapeRegExp(file)}$`, "i")) || file === "package.json")
      .join(" ");

    const lines = [
      `FROM ${nodePlan.baseImage}`,
      "WORKDIR /app",
      "ENV NODE_ENV=production",
      manifestFiles ? `COPY ${manifestFiles} ./` : "COPY package.json ./",
      `RUN ${nodePlan.installCmd}`,
      "COPY . ."
    ];

    if (nodePlan.buildCmd) {
      lines.push(`RUN ${nodePlan.buildCmd}`);
    }

    lines.push(`EXPOSE ${nodePlan.ports.join(" ")}`);
    lines.push(`CMD ${parseCommandToJsonArray(nodePlan.startCmd)}`);
    return `${lines.join("\n")}\n`;
  }

  if (analysis.runtime === "python") {
    const lines = [
      `FROM ${analysis.baseImage || "python:3.12-slim"}`,
      "WORKDIR /app",
      "ENV PYTHONDONTWRITEBYTECODE=1",
      "ENV PYTHONUNBUFFERED=1",
      "COPY . .",
      `RUN ${inferPythonInstallCommand(files)}`,
      `EXPOSE ${(analysis.ports.length > 0 ? analysis.ports : [8000]).join(" ")}`,
      `CMD ${parseCommandToJsonArray(analysis.startCmd || "python app.py")}`
    ];

    return `${lines.join("\n")}\n`;
  }

  if (analysis.runtime === "go") {
    const lines = [
      `FROM ${analysis.baseImage || "golang:1.22-alpine"}`,
      "WORKDIR /app",
      "COPY go.mod go.sum* ./",
      "RUN go mod download",
      "COPY . .",
      `EXPOSE ${(analysis.ports.length > 0 ? analysis.ports : [8080]).join(" ")}`,
      `CMD ${parseCommandToJsonArray(analysis.startCmd || "go run ./")}`
    ];

    return `${lines.join("\n")}\n`;
  }

  return `FROM ${analysis.baseImage}\nWORKDIR /app\nCOPY . .\nRUN ${analysis.installCmd}\nEXPOSE ${(analysis.ports.length > 0 ? analysis.ports : [3000]).join(" ")}\nCMD ${parseCommandToJsonArray(analysis.startCmd)}\n`;
}

function buildDockerIgnore(files: string[]) {
  const lines = [".git", ".github", "node_modules", ".next", "dist", "build", ".env", ".env.*"];

  if (hasFile(files, /(^|\/)pnpm-lock\.yaml$/i)) {
    lines.push(".pnpm-store");
  }

  return `${uniquePaths(lines).join("\n")}\n`;
}

function buildWorkflow(defaultBranch: string) {
  return `name: Build and Push Docker Image

on:
  push:
    branches:
      - ${defaultBranch}
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - name: Check out source code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/\${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=sha
            type=raw,value=latest,enable=\${{ github.ref == 'refs/heads/${defaultBranch}' }}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
`;
}

async function getRepoMeta(token: string, owner: string, repo: string) {
  return githubRequest<GitHubRepoMeta>(token, `/repos/${owner}/${repo}`);
}

async function getBranchSha(token: string, owner: string, repo: string, branch: string) {
  const ref = await githubRequest<GitHubRef>(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const sha = ref?.object?.sha;

  if (!sha) {
    throw new Error(`Failed to resolve HEAD SHA for ${owner}/${repo}@${branch}`);
  }

  return sha;
}

async function getTreeShaFromCommit(token: string, owner: string, repo: string, commitSha: string) {
  const commit = await githubRequest<GitHubCommit>(token, `/repos/${owner}/${repo}/git/commits/${commitSha}`);
  const treeSha = commit?.tree?.sha;

  if (!treeSha) {
    throw new Error(`Failed to resolve tree SHA for commit ${commitSha}`);
  }

  return treeSha;
}

async function getRepositoryFiles(token: string, owner: string, repo: string, branch: string) {
  const commitSha = await getBranchSha(token, owner, repo, branch);
  const treeSha = await getTreeShaFromCommit(token, owner, repo, commitSha);
  const tree = await githubRequest<GitHubTree>(token, `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);

  if (tree?.truncated) {
    throw new Error(`Repository tree for ${owner}/${repo} is too large to analyze recursively`);
  }

  return (tree?.tree ?? []).map((entry) => entry.path);
}

async function getFileContent(token: string, owner: string, repo: string, path: string, branch: string) {
  return githubRequest<GitHubContentFile>(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`,
    undefined,
    { allow404: true }
  );
}

async function fileExists(token: string, owner: string, repo: string, path: string, branch: string) {
  const file = await getFileContent(token, owner, repo, path, branch);
  return Boolean(file?.sha);
}

async function getReadmeContent(token: string, owner: string, repo: string, branch: string) {
  const readme = await getFileContent(token, owner, repo, "README.md", branch);
  return safeDecodeBase64(readme?.content, readme?.encoding);
}

async function getPackageJson(token: string, owner: string, repo: string, branch: string) {
  const file = await getFileContent(token, owner, repo, "package.json", branch);
  const decoded = safeDecodeBase64(file?.content, file?.encoding);

  if (!decoded) {
    return null;
  }

  try {
    return JSON.parse(decoded) as PackageJsonShape;
  } catch {
    return null;
  }
}

async function createBranch(token: string, owner: string, repo: string, branchName: string, sha: string) {
  await githubRequest(
    token,
    `/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha
      })
    }
  );
}

async function createOrUpdateFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  payload: CommitFilePayload
) {
  const existingFile = await getFileContent(token, owner, repo, payload.path, branch);

  await githubRequest(
    token,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(payload.path).replace(/%2F/g, "/")}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: payload.message,
        content: Buffer.from(payload.content).toString("base64"),
        branch,
        sha: existingFile?.sha
      })
    }
  );
}

async function createPR(token: string, owner: string, repo: string, branchName: string, baseBranch: string) {
  const response = await githubRequest<{ html_url?: string }>(
    token,
    `/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      body: JSON.stringify({
        title: "Add generated Docker assets for deployment",
        head: branchName,
        base: baseBranch,
        body: [
          "This PR was generated automatically by AICD.",
          "",
          "Included assets:",
          "- Dockerfile",
          "- .dockerignore",
          "- GitHub Actions workflow for building and publishing the image to GHCR"
        ].join("\n")
      })
    }
  );

  if (!response?.html_url) {
    throw new Error("GitHub did not return a pull request URL");
  }

  return response.html_url;
}

function buildAnalysisSignal(files: string[], readme: string | null) {
  const relevantFiles = files
    .filter((file) => !file.startsWith(".git/") && !file.startsWith("node_modules/") && !file.startsWith(".next/"))
    .slice(0, 500);

  return {
    files: relevantFiles,
    readme: readme?.slice(0, 4000)
  };
}

function alreadyHasContainerAssets(files: string[]) {
  return files.some((file) => /(^|\/)(dockerfile|containerfile)$/i.test(file));
}

export async function autoAnalyzeAndPush(
  token: string,
  userId: string,
  owner: string,
  repo: string
): Promise<{ message?: string; prUrl?: string }> {
  void userId;

  const repoMeta = await getRepoMeta(token, owner, repo);
  const baseBranch = repoMeta?.default_branch;

  if (!baseBranch) {
    throw new Error(`Failed to resolve default branch for ${owner}/${repo}`);
  }

  const files = await getRepositoryFiles(token, owner, repo, baseBranch);
  if (alreadyHasContainerAssets(files)) {
    return { message: "Repository already contains a container definition file." };
  }

  const readme = await getReadmeContent(token, owner, repo, baseBranch);
  const packageJson = await getPackageJson(token, owner, repo, baseBranch);
  const signal = buildAnalysisSignal(files, readme);
  const { result } = await analyzeRepository(signal);
  const dockerfileContent = buildDockerfile({
    analysis: result,
    files,
    packageJson
  });
  const dockerIgnoreContent = buildDockerIgnore(files);
  const workflowContent = buildWorkflow(baseBranch);
  const sha = await getBranchSha(token, owner, repo, baseBranch);
  const branchName = `aicd-docker-assets-${Date.now()}`;

  await createBranch(token, owner, repo, branchName, sha);

  const filesToCommit: CommitFilePayload[] = [
    {
      path: "Dockerfile",
      content: dockerfileContent,
      message: "Add generated Dockerfile"
    },
    {
      path: ".dockerignore",
      content: dockerIgnoreContent,
      message: "Add generated docker ignore rules"
    },
    {
      path: ".github/workflows/docker.yml",
      content: workflowContent,
      message: "Add container build workflow"
    }
  ];

  const workflowExists = await fileExists(token, owner, repo, ".github/workflows/docker.yml", baseBranch);
  if (workflowExists) {
    filesToCommit[2] = {
      path: ".github/workflows/docker.yml",
      content: workflowContent,
      message: "Update container build workflow"
    };
  }

  for (const file of filesToCommit) {
    await createOrUpdateFile(token, owner, repo, branchName, file);
  }

  const prUrl = await createPR(token, owner, repo, branchName, baseBranch);
  return { prUrl };
}