import * as core from "@actions/core";
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
    .map((pr) => filterPR(pr, allowlist, cutoffDate))
    .filter((result) => result.include)
    .map((result) => result.normalized);
}

function filterPR(
  pr: PR,
  allowlist: Set<string>,
  cutoffDate: Date
): { include: boolean; reasons: string[]; normalized: PR } {
  const reasons: string[] = [];

  if (pr.draft) {
    reasons.push("draft");
  }

  if (pr.labels.some((label) => label.name === SUPPRESS_LABEL)) {
    reasons.push(`label:${SUPPRESS_LABEL}`);
  }

  if (new Date(pr.created_at) < cutoffDate) {
    reasons.push("created_before_cutoff");
  }

  const allowedReviewers = pr.requested_reviewers.filter((reviewer) => allowlist.has(reviewer.login));
  if (allowedReviewers.length === 0) {
    reasons.push("no_allowlisted_reviewers");
  }

  return {
    include: reasons.length === 0,
    reasons,
    normalized: {
      ...pr,
      requested_reviewers: allowedReviewers,
    },
  };
}

export async function fetchRecentPRs(
  token: string,
  org: string,
  reviewerAllowlist: Set<string>
): Promise<RepoPR[]> {
  const octokit = new Octokit({ auth: token });

  const cutoffDate = monthsAgoDate(MONTHS_BACK);
  const query = `org:${org} is:pr is:open created:>=${formatDate(cutoffDate)} -label:${SUPPRESS_LABEL}`;

  core.info(`Search query: ${query}`);
  core.info(`Cutoff date (UTC): ${formatDate(cutoffDate)}`);
  core.info(`Reviewer allowlist size: ${reviewerAllowlist.size}`);

  const search = await octokit.rest.search.issuesAndPullRequests({
    q: query,
    sort: "created",
    order: "desc",
    per_page: MAX_RESULTS,
    page: 1,
  });

  const results: RepoPR[] = [];
  const items = search.data.items.slice(0, MAX_RESULTS);
  const reasonCounts: Record<string, number> = {};

  core.info(`Search results: ${search.data.total_count} (processing ${items.length})`);

  for (const item of items) {
    if (!item.pull_request || !item.repository_url) {
      core.debug(`Skipping issue ${item.number}: not a pull request`);
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

      const evaluation = filterPR(candidate, reviewerAllowlist, cutoffDate);
      if (!evaluation.include) {
        for (const reason of evaluation.reasons) {
          reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
        }
        core.debug(`Skipping ${owner}/${repo}#${item.number}: ${evaluation.reasons.join(", ")}`);
        continue;
      }

      results.push({ ...evaluation.normalized, repo });
    } catch (error) {
      console.warn(`Warning: Failed to fetch PR details for ${owner}/${repo}#${item.number}:`, error);
    }
  }

  const skipped = items.length - results.length;
  core.info(`Included PRs: ${results.length}. Skipped: ${skipped}.`);
  if (skipped > 0) {
    const breakdown = Object.entries(reasonCounts)
      .map(([reason, count]) => `${reason}=${count}`)
      .join(", ");
    core.info(`Skip reasons: ${breakdown}`);
  }

  return results;
}
