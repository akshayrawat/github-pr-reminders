import { Octokit } from "octokit";

interface PR {
  number: number;
  title: string;
  draft: boolean;
  requested_reviewers: { login: string }[];
  labels: { name: string }[];
  html_url?: string;
  created_at: string;
}

interface RepoPR extends PR {
  repo: string;
}

const SUPPRESS_LABEL = "suppress-pr-reminder";
const MAX_RESULTS = 100;
const MONTHS_BACK = 3;

function monthsAgoDate(monthsBack: number): Date {
  const now = new Date();
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - monthsBack);
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseRepoFromUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/repos\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`Unable to parse repository from URL: ${url}`);
  }
  return { owner: match[1], repo: match[2] };
}

export function filterPRs(prs: PR[], allowlist: Set<string>, cutoffDate: Date): PR[] {
  return prs
    .map((pr) => ({
      ...pr,
      requested_reviewers: pr.requested_reviewers.filter((reviewer) => allowlist.has(reviewer.login)),
    }))
    .filter(
      (pr) =>
        !pr.draft &&
        pr.requested_reviewers.length > 0 &&
        !pr.labels.some((label) => label.name === SUPPRESS_LABEL) &&
        new Date(pr.created_at) >= cutoffDate
    );
}

export async function fetchRecentPRs(
  token: string,
  org: string,
  reviewerAllowlist: Set<string>
): Promise<RepoPR[]> {
  const octokit = new Octokit({ auth: token });

  const cutoffDate = monthsAgoDate(MONTHS_BACK);
  const query = `org:${org} is:pr is:open created:>=${formatDate(cutoffDate)} -label:${SUPPRESS_LABEL}`;

  const search = await octokit.rest.search.issuesAndPullRequests({
    q: query,
    sort: "created",
    order: "desc",
    per_page: MAX_RESULTS,
    page: 1,
  });

  const results: RepoPR[] = [];
  const items = search.data.items.slice(0, MAX_RESULTS);

  for (const item of items) {
    if (!item.pull_request || !item.repository_url) {
      continue;
    }

    const { owner, repo } = parseRepoFromUrl(item.repository_url);

    try {
      const { data: pr } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: item.number,
      });

      const candidate: PR = {
        number: pr.number,
        title: pr.title,
        draft: pr.draft,
        requested_reviewers: pr.requested_reviewers as { login: string }[],
        labels: pr.labels as { name: string }[],
        html_url: pr.html_url,
        created_at: pr.created_at,
      };

      const filtered = filterPRs([candidate], reviewerAllowlist, cutoffDate);
      if (filtered.length === 0) {
        continue;
      }

      results.push({ ...filtered[0], repo });
    } catch (error) {
      console.warn(`Warning: Failed to fetch PR details for ${owner}/${repo}#${item.number}:`, error);
    }
  }

  return results;
}
