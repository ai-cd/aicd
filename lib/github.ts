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

async function getGitHubAccessToken(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" }
  });
  return account?.access_token ?? null;
}

export async function listGitHubRepos(userId: string) {
  const token = await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error("GitHub access token missing");
  }

  const response = await fetch("https://api.github.com/user/repos?per_page=100", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to load GitHub repos");
  }

  return (await response.json()) as GitHubRepo[];
}

export async function getRepoContents(userId: string, owner: string, repo: string) {
  const token = await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error("GitHub access token missing");
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch repository contents");
  }

  return (await response.json()) as Array<{
    name: string;
    path: string;
    type: "file" | "dir";
  }>;
}

export async function getRepoMeta(userId: string, owner: string, repo: string) {
  const token = await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error("GitHub access token missing");
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch repo metadata");
  }

  return (await response.json()) as GitHubRepo & { visibility?: string };
}

export async function getRepoReadme(userId: string, owner: string, repo: string) {
  const token = await getGitHubAccessToken(userId);
  if (!token) {
    throw new Error("GitHub access token missing");
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/readme`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data?.content) {
    return null;
  }

  return Buffer.from(data.content, "base64").toString("utf8");
}
