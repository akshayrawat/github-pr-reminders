import { WebClient } from "@slack/web-api";

interface RepoPR {
  number: number;
  title: string;
  repo: string;
  html_url?: string;
  requested_reviewers: { login: string }[];
  draft: boolean;
  labels: { name: string }[];
}

type UserMap = Record<string, string>;
type GroupedPRs = Record<string, RepoPR[]>;

export function groupByReviewer(prs: RepoPR[]): GroupedPRs {
  const grouped: GroupedPRs = {};
  for (const pr of prs) {
    for (const reviewer of pr.requested_reviewers) {
      if (!grouped[reviewer.login]) {
        grouped[reviewer.login] = [];
      }
      grouped[reviewer.login].push(pr);
    }
  }
  return grouped;
}

export function formatMessage(grouped: GroupedPRs, userMap: UserMap, org: string): string {
  const reviewers = Object.keys(grouped);

  if (reviewers.length === 0) {
    return "🎉 No PRs waiting for review! The queue is empty.";
  }

  let message = "🔍 *PRs waiting for review*\n";
  message += "Tip: add the `suppress-pr-reminder` label to hide a PR.\n";

  for (const reviewer of reviewers.sort()) {
    const slackId = userMap[reviewer];
    const mention = slackId ? `<@${slackId}>` : "Unmapped reviewer";

    message += `\n*${mention}:*\n`;

    for (const pr of grouped[reviewer]) {
      const url = pr.html_url || `https://github.com/${org}/${pr.repo}/pull/${pr.number}`;
      message += `• <${url}|${pr.repo}#${pr.number}>: ${pr.title}\n`;
    }
  }

  return message;
}

export async function postToSlack(token: string, channel: string, text: string): Promise<void> {
  const client = new WebClient(token);
  await client.chat.postMessage({ channel, text });
}
