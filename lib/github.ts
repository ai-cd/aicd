import { prisma } from "@/lib/db";

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: { login: string };
};

/** Helper: make a GitHub API request with proper headers and error handling */
async function githubFetch(url: string, token: string, label: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "IntelliDeploy"
      },
      cache: "no-store"
    });
  } catch (err: any) {
    console.error(`[GitHub] Network error during ${label}:`, err?.message ?? err);
    throw new Error(`GitHub API network error (${label}): ${err?.message ?? "unknown"}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "<unreadable>");
    console.error(
      `[GitHub] ${label} failed — ${response.status} ${response.statusText}`,
      body.slice(0, 500)
    );
    throw new Error(
      `GitHub API error (${label}): ${response.status} ${response.statusText}`
    );
  }
  return response;
}

export async function getGitHubAccessToken(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" }
  });
  if (!account?.access_token) {
    console.warn(`[GitHub] No access token found for userId=${userId}`);
  }
  return account?.access_token ?? null;
}

export async function listGitHubRepos(userId: string) {
  const token = await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error("GitHub access token missing — please re-sign in with GitHub");
  }

  const response = await githubFetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    token,
    "listRepos"
  );

  return (await response.json()) as GitHubRepo[];
}

export async function getRepoContents(userId: string, owner: string, repo: string) {
  const token = await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error("GitHub access token missing — please re-sign in with GitHub");
  }

  const response = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents`,
    token,
    `getContents(${owner}/${repo})`
  );

  return (await response.json()) as Array<{
    name: string;
    path: string;
    type: "file" | "dir";
  }>;
}

export async function getRepoMeta(userId: string, owner: string, repo: string) {
  const token = await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error("GitHub access token missing — please re-sign in with GitHub");
  }

  const response = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    token,
    `getRepoMeta(${owner}/${repo})`
  );

  return (await response.json()) as GitHubRepo & { visibility?: string };
}

export async function getRepoReadme(userId: string, owner: string, repo: string) {
  const token = await getGitHubAccessToken(userId);
  if (!token) {
    return null;           // README is optional — don't throw for missing token
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "IntelliDeploy"
        },
        cache: "no-store"
      }
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data?.content) {
    return null;
  }

  return Buffer.from(data.content, "base64").toString("utf8");
}
