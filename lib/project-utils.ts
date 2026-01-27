export function parseRepoUrl(repoUrl: string) {
  try {
    const url = new URL(repoUrl);
    const [owner, repo] = url.pathname.replace(/^\//, "").split("/");
    if (!owner || !repo) {
      return null;
    }
    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}
