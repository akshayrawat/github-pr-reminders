import { Octokit } from "octokit";

interface PR {
  number: number;
  title: string;
  draft: boolean;
  requested_reviewers: { login: string }[];
  labels: { name: string }[];
  html_url?: string;
}

interface RepoPR extends PR {
  repo: string;
}

export function filterPRs(prs: PR[]): PR[] {
  return prs.filter(
    (pr) =>
      !pr.draft &&
      pr.requested_reviewers.length > 0 &&
      !pr.labels.some((label) => label.name === "suppress-pr-reminder")
  );
}

export async function fetchAllPRs(token: string, org: string): Promise<RepoPR[]> {
  const octokit = new Octokit({ auth: token });

  const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
    org,
    type: "all",
    per_page: 100,
  });

  const allPRs: RepoPR[] = [];

  for (const repo of repos) {
    try {
      const prs = await octokit.paginate(octokit.rest.pulls.list, {
        owner: org,
        repo: repo.name,
        state: "open",
        per_page: 100,
      });

      const filtered = filterPRs(prs as unknown as PR[]);
      for (const pr of filtered) {
        allPRs.push({ ...pr, repo: repo.name });
      }
    } catch (error) {
      console.warn(`Warning: Failed to fetch PRs for ${repo.name}:`, error);
    }
  }

  return allPRs;
}
